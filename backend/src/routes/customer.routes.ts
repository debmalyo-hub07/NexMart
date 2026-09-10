import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { protectCustomer } from '../middleware/auth';
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
} from '../controllers/roleAuth.controller';
import { getWishlist, addToWishlist, removeFromWishlist } from '../controllers/wishlist.controller';
import { passwordChangeSchema } from '../utils/validation';

const router = Router();

// --- Auth Routes (Unprotected but rate-limited) ---
// Register sits behind the same 3/hour registerLimit as the /auth/customer
// alias and agent signup (B9 alignment) — authLimit (10/min) was 200× weaker.
router.post('/auth/register', registerLimit, registerCustomer);
router.post('/auth/login', authLimit, loginCustomer);

// OTP verification routes (rate-limited with otpLimit — stricter)
router.post('/auth/verify-otp', otpLimit, verifyOtp);
router.post('/auth/resend-otp', otpLimit, resendOtp);

// --- Protected Routes ---
router.use(protectCustomer, checkIP(Customer));

router.get('/profile', async (req: any, res) => {
  const customer = await Customer.findById(req.user.id).select('-password -otp -otpExpiry');
  res.json({ success: true, data: customer });
});

router.put('/profile', async (req: any, res) => {
  const { name, phone, gender, address, city } = req.body;
  const customer = await Customer.findByIdAndUpdate(
    req.user.id,
    { $set: {
      ...(name && { name }),
      ...(phone && { phone }),
      ...(gender && { gender }),
      ...(address && { address }),
      ...(city && { city }),
    }},
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
  await Customer.findByIdAndUpdate(req.user.id, { password: hashedPassword });
  res.json({ success: true, message: 'Password updated successfully' });
});

router.post('/address', async (req: any, res) => {
  try {
    const customer = await Customer.findById(req.user.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Not found' });
    
    if (req.body.isDefault) {
      customer.addresses?.forEach(a => { a.isDefault = false; });
    }
    
    if (!customer.addresses) customer.addresses = [];
    customer.addresses.push(req.body);
    await customer.save();
    
    res.json({ success: true, data: customer.addresses, message: 'Address added' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to add address' });
  }
});

router.put('/address/:id', async (req: any, res) => {
  try {
    const customer = await Customer.findById(req.user.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Not found' });

    if (req.body.isDefault) {
      customer.addresses?.forEach(a => { a.isDefault = false; });
    }

    const addr = customer.addresses?.find(a => a._id?.toString() === req.params.id);
    if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });

    Object.assign(addr, req.body);
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
