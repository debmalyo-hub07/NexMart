import { Request, Response } from 'express';
import { Customer } from '../models/Customer';
import { Admin } from '../models/Admin';
import { DeliveryAgent } from '../models/DeliveryAgent';
import { generateToken } from '../middleware/auth';
import { env } from '../config/env';

/**
 * Google OAuth Callback Handler
 *
 * Phase 7 of CLAUDE.md — Multi-Role Gmail Logic:
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
    const { googleId, email, name, picture } = req.body;

    if (!email || !googleId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required Google OAuth fields.',
        data: null,
      });
    }

    // Check if an existing customer with this googleId or email exists
    let customer = await Customer.findOne({
      $or: [{ googleId }, { email }],
    });

    if (customer) {
      // Returning customer — update Google ID and picture if needed
      if (!customer.googleId) {
        customer.googleId = googleId;
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

    // Phase 7: If email belongs to admin or agent — create a NEW separate customer copy.
    // DO NOT touch the original admin/agent account. Do NOT fail — create the customer.
    const adminExists = await Admin.findOne({ email });
    const agentExists = await DeliveryAgent.findOne({ email });
    const hasOverlap = !!(adminExists || agentExists);

    const newCustomer = await Customer.create({
      name: name || 'Customer',
      email,
      googleId,
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
    return res.status(500).json({
      success: false,
      message: 'Google OAuth processing failed.',
      data: null,
    });
  }
};
