import { Request, Response } from 'express';
import { Customer } from '../models/Customer';
import { Admin } from '../models/Admin';
import { DeliveryAgent } from '../models/DeliveryAgent';
import { generateToken } from '../middleware/auth';
import { env } from '../config/env';
import { verifyGoogleIdToken } from '../services/googleToken.service';
import { logger } from '../utils/logger';

/**
 * Google OAuth Callback Handler
 *
 * SECURITY (audit 2026-09-07 §3.1): the client sends ONLY the Google ID token.
 * The identity (googleId, email, name, picture) comes from Google's own
 * tokeninfo endpoint after server-side verification — audience checked
 * against OUR client id, email must be verified at Google. Nothing in the
 * request body is trusted. Suspended accounts are refused (B3 consistency).
 *
 * Multi-Role Gmail Logic (unchanged):
 *
 * - If the Google email belongs to an Admin → create a NEW customer account copy.
 *   The original admin account remains fully intact and protected.
 * - If the Google email belongs to a DeliveryAgent → same: create a NEW customer copy.
 * - If the email belongs to an existing customer → just log them in (merge/link).
 * - If the email is brand new → create a fresh customer account.
 *
 * This behavior ONLY applies to Google OAuth (not email+password).
 * Email+password cross-role login is rejected at the loginCustomer endpoint.
 */
export const googleAuthCallback = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Google sign-in requires an ID token.',
        data: null,
      });
    }

    // Fails CLOSED: invalid/expired token, wrong audience, unverified email,
    // or Google unreachable — no identity is trusted without this.
    let identity;
    try {
      identity = await verifyGoogleIdToken(idToken);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: err instanceof Error ? err.message : 'Google sign-in failed.',
        data: null,
      });
    }

    const { googleId, email, name, picture } = identity;

    // Check if an existing customer with this googleId or email exists
    const customer = await Customer.findOne({
      $or: [{ googleId }, { email }],
    });

    if (customer) {
      // Suspended customers are refused here too — the per-request guard
      // would block the token anyway; refuse at issuance for consistency (B3).
      if (customer.isActive === false) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been suspended. Please contact support.',
          data: null,
        });
      }

      // Returning customer — update Google ID and picture if needed
      if (!customer.googleId) {
        customer.googleId = googleId;
        customer.emailVerified = true; // verified at Google
        if (picture && !customer.profilePicture) {
          customer.profilePicture = picture;
        }
        await customer.save();
      }

      const token = generateToken(
        { id: customer._id, role: 'customer' },
        env.JWT_SECRET_CUSTOMER,
        env.JWT_EXPIRES_IN
      );

      return res.json({
        success: true,
        message: 'Google login successful',
        data: {
          token,
          user: {
            id: customer._id,
            name: customer.name,
            email: customer.email,
            role: customer.role,
            profilePicture: customer.profilePicture,
          },
        },
      });
    }

    // If email belongs to admin or agent — create a NEW separate customer copy.
    // DO NOT touch the original admin/agent account. Do NOT fail — create the customer.
    const adminExists = await Admin.findOne({ email });
    const agentExists = await DeliveryAgent.findOne({ email });
    const hasOverlap = !!(adminExists || agentExists);

    const newCustomer = await Customer.create({
      name: name || 'Customer',
      email,
      googleId,
      emailVerified: true, // verified at Google
      profilePicture: picture || '',
      role: 'customer',
      authProviders: ['google'],
      createdViaCustomerGoogleOverlap: hasOverlap,
    });

    const token = generateToken(
      { id: newCustomer._id, role: 'customer' },
      env.JWT_SECRET_CUSTOMER,
      env.JWT_EXPIRES_IN
    );

    return res.status(201).json({
      success: true,
      message: 'Customer account created via Google',
      data: {
        token,
        user: {
          id: newCustomer._id,
          name: newCustomer.name,
          email: newCustomer.email,
          role: newCustomer.role,
          profilePicture: newCustomer.profilePicture,
        },
      },
    });
  } catch (error: any) {
    logger.error('Google OAuth processing failed:', error?.message);
    return res.status(500).json({
      success: false,
      message: 'Google OAuth processing failed.',
      data: null,
    });
  }
};
