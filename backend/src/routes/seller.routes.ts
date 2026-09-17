import { Router } from 'express';
import { authLimit, otpLimit, registerLimit } from '../middleware/rateLimiter';
import { protectSeller, requireActiveSeller } from '../middleware/auth';
import {
  loginSeller,
  registerSeller,
  resendSellerVerification,
  verifySellerEmail,
} from '../controllers/sellerAuth.controller';
import {
  getSellerProfile,
  submitSellerOnboarding,
  updateSellerProfile,
  getSellerFinances,
  getPublicSellerStorefront,
} from '../controllers/seller.controller';
import {
  adjustSellerInventory,
  createSellerListing,
  getSellerListing,
  getSellerListings,
  pauseSellerListing,
  resumeSellerListing,
  submitSellerListing,
  updateSellerListing,
} from '../controllers/listing.controller';
import {
  createSellerShipment,
  getSellerFulfillmentGroup,
  getSellerFulfillmentGroups,
  getSellerShipments,
  updateSellerFulfillmentStatus,
} from '../controllers/sellerFulfillment.controller';

const router = Router();

router.post('/auth/register', registerLimit, registerSeller);
router.post('/auth/login', authLimit, loginSeller);
router.post('/auth/verify-otp', otpLimit, verifySellerEmail);
router.post('/auth/resend-otp', otpLimit, resendSellerVerification);
router.get('/storefront/:id', getPublicSellerStorefront);

router.use(protectSeller);
router.get('/profile', getSellerProfile);
router.put('/profile', updateSellerProfile);
router.post('/onboarding/submit', submitSellerOnboarding);

// Listing and inventory writes are active-seller operations. Ownership is
// checked again in each controller so an ID from another seller cannot widen
// access through a crafted request.
router.get('/listings', requireActiveSeller, getSellerListings);
router.post('/listings', requireActiveSeller, createSellerListing);
router.get('/listings/:id', requireActiveSeller, getSellerListing);
router.put('/listings/:id', requireActiveSeller, updateSellerListing);
router.post('/listings/:id/submit', requireActiveSeller, submitSellerListing);
router.post('/listings/:id/pause', requireActiveSeller, pauseSellerListing);
router.post('/listings/:id/resume', requireActiveSeller, resumeSellerListing);
router.post('/listings/:id/inventory/adjust', requireActiveSeller, adjustSellerInventory);

router.get('/fulfillment-groups', requireActiveSeller, getSellerFulfillmentGroups);
router.get('/fulfillment-groups/:id', requireActiveSeller, getSellerFulfillmentGroup);
router.patch('/fulfillment-groups/:id/status', requireActiveSeller, updateSellerFulfillmentStatus);
router.post('/fulfillment-groups/:id/shipment', requireActiveSeller, createSellerShipment);
router.get('/shipments', requireActiveSeller, getSellerShipments);
router.get('/finances', requireActiveSeller, getSellerFinances);

export default router;
