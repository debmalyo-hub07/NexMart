import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export const checkIP = (Model: any) => async (req: Request, res: Response, next: NextFunction) => {
  // Disabled by default: pinning an account to its first-seen IP locks out legitimate
  // users who roam between networks (wifi ↔ cellular) and relies on a spoofable
  // x-forwarded-for header. Enable only behind a trusted proxy via IP_WHITELIST_ENABLED=true.
  if (env.IP_WHITELIST_ENABLED !== 'true') return next();
  try {
    const incomingIP = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const user = await Model.findById((req as any).user.id);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    if (!user.whitelistedIP) {
      // First login - store IP
      user.whitelistedIP = incomingIP;
      await user.save();
      return next();
    }

    if (user.whitelistedIP !== incomingIP) {
      return res.status(403).json({ success: false, message: 'Access denied: IP mismatch.' });
    }

    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error in IP validation' });
  }
};
