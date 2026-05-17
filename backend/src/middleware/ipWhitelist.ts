import { Request, Response, NextFunction } from 'express';

export const checkIP = (Model: any) => async (req: Request, res: Response, next: NextFunction) => {
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
