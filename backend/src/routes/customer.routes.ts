import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { protectCustomer, generateToken } from '../middleware/auth';
import { env } from '../config/env';
import { checkIP } from '../middleware/ipWhitelist';
import { authLimit, otpLimit, registerLimit } from '../middleware/rateLimiter';
import { Customer } from '../models/Customer';
import { imageUpload } from '../middleware/upload';
import { uploadImageBuffer } from '../services/cloudinary.service';
import {
  registerCustomer,
  loginCustomer,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
} from '../controllers/roleAuth.controller';
import { getWishlist, addToWishlist, removeFromWishlist } from '../controllers/wishlist.controller';
import { passwordChangeSchema, profileUpdateSchema, setPasswordSchema, addressSchema } from '../utils/validation';
import { generateResetCode, hashResetCode, RESET_CODE_TTL_MS, RESET_CODE_MAX_ATTEMPTS } from '../utils/resetCode';
import { sendEmail, buildResetEmail } from '../services/email.service';

const router = Router();

// --- Auth Routes (Unprotected but rate-limited) ---
// Register sits behind the same 3/hour registerLimit as the /auth/customer
// alias and agent signup (B9 alignment) — authLimit (10/min) was 200× weaker.
router.post('/auth/register', registerLimit, registerCustomer);
router.post('/auth/login', authLimit, loginCustomer);

// OTP verification routes (rate-limited with otpLimit — stricter)
router.post('/auth/verify-otp', otpLimit, verifyOtp);
router.post('/auth/resend-otp', otpLimit, resendOtp);

// Password recovery — opaque on request, uniform on failure (see controller).
router.post('/auth/forgot-password', otpLimit, forgotPassword);
router.post('/auth/reset-password', otpLimit, resetPassword);

// --- Protected Routes ---
router.use(protectCustomer, checkIP(Customer));

router.get('/profile', async (req: any, res) => {
  const customer = await Customer.findById(req.user.id).select('-password -otp -otpExpiry');
  res.json({ success: true, data: customer });
});

router.put('/profile', async (req: any, res) => {
  // Previously unvalidated — req.body was spread straight into $set.
  const values = profileUpdateSchema.parse(req.body);
  const customer = await Customer.findByIdAndUpdate(
    req.user.id,
    { $set: values },
    { new: true }
  ).select('-password -otp -otpExpiry');
  res.json({ success: true, data: customer, message: 'Profile updated' });
});

router.put('/password', async (req: any, res) => {
  // B5: requires the CURRENT password (verified with bcrypt) and enforces the
  // same strength policy as the frontend modal — previously any authenticated
  // request could set a 1-character password without knowing the old one.
  const { currentPassword, password } = passwordChangeSchema.parse(req.body);

  const customer = await Customer.findById(req.user.id);
  if (!customer || !customer.password) {
    return res.status(404).json({ success: false, message: 'Account not found' });
  }

  const isMatch = await bcrypt.compare(currentPassword, customer.password);
  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  // Changing the password invalidates every session issued earlier (audit §B4)
  // — a stolen cookie must not survive the victim's password change. The
  // caller's own device gets a freshly minted token here, so only OTHER
  // devices are signed out (mint time ≥ credentialsChangedAt survives).
  const changed = await Customer.updateOne({ _id: req.user.id, password: customer.password, isActive: true }, {
    $set: { password: hashedPassword, credentialsChangedAt: new Date() },
    $unset: { resetOtpHash: 1, resetOtpExpiry: 1, resetOtpAttempts: 1 },
  });
  if (changed.modifiedCount !== 1) return res.status(409).json({ success: false, message: 'Your credentials changed. Sign in again before updating your password.' });
  const token = generateToken({ id: req.user.id, role: 'customer' }, env.JWT_SECRET_CUSTOMER, env.JWT_EXPIRES_IN);
  res.cookie('nexmart_customer_session', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  res.json({ success: true, message: 'Password updated successfully', data: { token } });
});

/**
 * Ask for a code to set a FIRST password. Only reachable by an authenticated
 * customer, so there is nothing to enumerate — but an account that already has
 * a password must use the current-password route instead, which proves
 * ownership without needing the inbox.
 */
router.post('/set-password/request', otpLimit, async (req: any, res) => {
  const customer = await Customer.findById(req.user.id);
  if (!customer) return res.status(404).json({ success: false, message: 'Account not found' });
  if (customer.password) {
    return res.status(409).json({ success: false, message: 'This account already has a password. Change it from your security settings.' });
  }

  const code = generateResetCode();
  await Customer.findByIdAndUpdate(customer._id, {
    $set: { resetOtpHash: hashResetCode(code), resetOtpExpiry: new Date(Date.now() + RESET_CODE_TTL_MS), resetOtpAttempts: 0 },
  });
  try {
    await sendEmail({ to: customer.email, subject: 'NexMart — Set your password', html: buildResetEmail(customer.name, code) });
  } catch (emailErr: unknown) {
    console.error('[SetPassword] SMTP failed:', emailErr instanceof Error ? emailErr.message : String(emailErr));
  }
  res.status(202).json({ success: true, message: 'If your account can take a password, we have sent a code.', data: null });
});

/** Complete the first-password flow with the emailed code. */
router.post('/set-password', async (req: any, res) => {
  const { otp, password } = setPasswordSchema.parse(req.body);
  const customer = await Customer.findById(req.user.id).select('+resetOtpHash +resetOtpExpiry +resetOtpAttempts');
  if (!customer) return res.status(404).json({ success: false, message: 'Account not found' });
  if (customer.password) {
    return res.status(409).json({ success: false, message: 'This account already has a password.' });
  }

  const fail = () => res.status(400).json({ success: false, message: 'Unable to set a password with that code. Please request a new one.', data: null });
  if (!customer.resetOtpHash || !customer.resetOtpExpiry) return fail();
  if (customer.resetOtpExpiry.getTime() < Date.now()) return fail();
  if ((customer.resetOtpAttempts ?? 0) >= RESET_CODE_MAX_ATTEMPTS) return fail();
  if (hashResetCode(otp) !== customer.resetOtpHash) {
    await Customer.updateOne({ _id: customer._id, resetOtpHash: customer.resetOtpHash, resetOtpAttempts: { $lt: RESET_CODE_MAX_ATTEMPTS } }, { $inc: { resetOtpAttempts: 1 } });
    return fail();
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const changed = await Customer.updateOne({ _id: customer._id, isActive: true, password: { $exists: false }, resetOtpHash: customer.resetOtpHash, resetOtpExpiry: { $gt: new Date() }, resetOtpAttempts: { $lt: RESET_CODE_MAX_ATTEMPTS } }, {
    $set: { password: hashedPassword },
    $unset: { resetOtpHash: 1, resetOtpExpiry: 1, resetOtpAttempts: 1 },
    $addToSet: { authProviders: 'email' },
  });
  if (changed.modifiedCount !== 1) return fail();
  res.json({ success: true, message: 'Password set. You can now sign in with your email too.', data: null });
});

/**
 * Sign out everywhere. Stamps credentialsChangedAt, which protectCustomer
 * checks against each token's mint time — so every session, including this
 * one, stops working immediately.
 */
router.post('/sign-out-everywhere', async (req: any, res) => {
  await Customer.findByIdAndUpdate(req.user.id, { $set: { credentialsChangedAt: new Date() } });
  res.clearCookie('nexmart_customer_session', { path: '/' });
  res.json({ success: true, message: 'Signed out on all devices.', data: null });
});

router.post('/address', async (req: any, res) => {
  try {
    // Validated and allow-listed (audit §C1): the raw body used to be pushed
    // straight into the subdocument.
    const parsed = addressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid address' });
    }
    const customer = await Customer.findById(req.user.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Not found' });
    
    if (parsed.data.isDefault) {
      customer.addresses?.forEach(a => { a.isDefault = false; });
    }
    
    if (!customer.addresses) customer.addresses = [];
    customer.addresses.push(parsed.data as never);
    await customer.save();
    
    res.json({ success: true, data: customer.addresses, message: 'Address added' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to add address' });
  }
});

router.put('/address/:id', async (req: any, res) => {
  try {
    // Partial update, still allow-listed (audit §C1): Object.assign used to
    // take every incoming key, including ones the schema never declared.
    const parsed = addressSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid address' });
    }
    const customer = await Customer.findById(req.user.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Not found' });

    if (parsed.data.isDefault) {
      customer.addresses?.forEach(a => { a.isDefault = false; });
    }

    const addr = customer.addresses?.find(a => a._id?.toString() === req.params.id);
    if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });

    Object.assign(addr, parsed.data);
    customer.markModified('addresses');
    await customer.save();

    res.json({ success: true, data: customer.addresses, message: 'Address updated' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to update address' });
  }
});

router.delete('/address/:id', async (req: any, res) => {
  try {
    const customer = await Customer.findById(req.user.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Not found' });

    customer.addresses = customer.addresses?.filter(a => a._id?.toString() !== req.params.id) || [];
    await customer.save();

    res.json({ success: true, data: customer.addresses, message: 'Address deleted' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to delete address' });
  }
});

router.put('/avatar', imageUpload.single('avatar'), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No image provided' });

  try {
    const upload = await uploadImageBuffer(req.file.buffer, 'avatars');
    const customer = await Customer.findByIdAndUpdate(
      req.user.id,
      { profilePicture: upload.url },
      { new: true }
    ).select('-password -otp -otpExpiry');
    
    res.json({ success: true, data: customer, message: 'Avatar updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to upload image' });
  }
});

// --- Wishlist ---
router.get('/wishlist', getWishlist);
router.post('/wishlist/:productId', addToWishlist);
router.delete('/wishlist/:productId', removeFromWishlist);

export default router;
