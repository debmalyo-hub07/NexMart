import { describe, it, expect, vi, beforeEach } from 'vitest';

// Regression test for the audit §3.1 account-takeover: POST /auth/google/callback
// must verify the Google ID token server-side and check account status.

const findCustomer = vi.hoisted(() => vi.fn());
const createCustomer = vi.hoisted(() => vi.fn());
const findAdmin = vi.hoisted(() => vi.fn());
const findAgent = vi.hoisted(() => vi.fn());
const verifyToken = vi.hoisted(() => vi.fn());
const generateToken = vi.hoisted(() => vi.fn());

vi.mock('../../models/Customer', () => ({
  Customer: { findOne: findCustomer, create: createCustomer },
}));
vi.mock('../../models/Admin', () => ({ Admin: { findOne: findAdmin } }));
vi.mock('../../models/DeliveryAgent', () => ({ DeliveryAgent: { findOne: findAgent } }));
vi.mock('../../services/googleToken.service', () => ({
  verifyGoogleIdToken: (t: string) => verifyToken(t),
}));
vi.mock('../../middleware/auth', () => ({
  generateToken: (payload: any, secret: any, expires: any) => generateToken(payload, secret, expires),
}));
vi.mock('../../config/env', () => ({
  env: {
    JWT_SECRET_CUSTOMER: 'cust-secret',
    JWT_EXPIRES_IN: '7d',
  },
}));

import { googleAuthCallback } from '../../controllers/googleAuth.controller';

function makeReq(body: any) {
  return { body } as any;
}
function makeRes() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

describe('googleAuthCallback (audit §3.1: server-side verification)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a forged login with NO id token (the original takeover)', async () => {
    // The exact probe that previously returned a working token for any email
    const res = makeRes();
    await googleAuthCallback(
      makeReq({ googleId: 'totally-fake-123', email: 'victim@example.com', name: 'Attacker' }),
      res
    );

    expect(verifyToken).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringMatching(/ID token/i) })
    );
    expect(findCustomer).not.toHaveBeenCalled();
  });

  it('rejects when Google token verification fails (bad signature/expired)', async () => {
    verifyToken.mockRejectedValue(new Error('Google sign-in failed: invalid or expired token.'));
    const res = makeRes();
    await googleAuthCallback(makeReq({ idToken: 'forged.jwt' }), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(findCustomer).not.toHaveBeenCalled();
    expect(generateToken).not.toHaveBeenCalled();
  });

  it('does NOT log in a suspended customer (B3 consistency)', async () => {
    verifyToken.mockResolvedValue({ googleId: 'g1', email: 'suspended@x.com', emailVerified: true });
    findCustomer.mockResolvedValue({ _id: 'c1', email: 'suspended@x.com', isActive: false, googleId: 'g1' });
    const res = makeRes();
    await googleAuthCallback(makeReq({ idToken: 'good.jwt' }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/suspended/i) })
    );
    expect(generateToken).not.toHaveBeenCalled();
  });

  it('logs in a verified active customer and returns a token', async () => {
    verifyToken.mockResolvedValue({ googleId: 'g1', email: 'real@x.com', emailVerified: true, name: 'Real', picture: 'pic' });
    const customer = {
      _id: 'c1', email: 'real@x.com', name: 'Real', role: 'customer',
      googleId: 'g1', isActive: true, save: vi.fn(),
    };
    findCustomer.mockResolvedValue(customer);
    generateToken.mockReturnValue('jwt-token');

    const res = makeRes();
    await googleAuthCallback(makeReq({ idToken: 'good.jwt' }), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ token: 'jwt-token', user: expect.objectContaining({ email: 'real@x.com' }) }),
      })
    );
    expect(verifyToken).toHaveBeenCalledWith('good.jwt');
  });

  it('creates a customer for a brand-new verified Google identity', async () => {
    verifyToken.mockResolvedValue({ googleId: 'g2', email: 'new@x.com', emailVerified: true, name: 'New User', picture: 'p' });
    findCustomer.mockResolvedValue(null);
    findAdmin.mockResolvedValue(null);
    findAgent.mockResolvedValue(null);
    generateToken.mockReturnValue('jwt-new');
    createCustomer.mockResolvedValue({
      _id: 'c2', email: 'new@x.com', name: 'New User', role: 'customer', profilePicture: 'p',
    });

    const res = makeRes();
    await googleAuthCallback(makeReq({ idToken: 'good.jwt' }), res);

    expect(createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@x.com', googleId: 'g2', emailVerified: true })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ token: 'jwt-new' }) })
    );
  });

  it('uses the VERIFIED identity from the token, never the request body', async () => {
    verifyToken.mockResolvedValue({ googleId: 'real-sub', email: 'real@x.com', emailVerified: true });
    const customer = {
      _id: 'c1', email: 'real@x.com', name: 'Real', role: 'customer', isActive: true,
      googleId: 'real-sub', save: vi.fn(),
    };
    findCustomer.mockImplementation(async (query: any) =>
      query?.$or?.some((c: any) => c.email === 'real@x.com') ? customer : null
    );

    const res = makeRes();
    // Body tries to claim a DIFFERENT identity — must be ignored entirely
    await googleAuthCallback(makeReq({ idToken: 'good.jwt', googleId: 'fake', email: 'victim@x.com' }), res);

    expect(findCustomer).toHaveBeenCalledWith({ $or: [{ googleId: 'real-sub' }, { email: 'real@x.com' }] });
    expect(generateToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1', role: 'customer' }),
      'cust-secret',
      '7d'
    );
  });
});
