import type { Application } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import type { Response } from 'supertest';
import { createApp } from '../app';

// The CSRF gate in app.ts rejects any mutating request whose Origin/Referer
// does not match CORS_ORIGIN. In the test env that defaults to localhost:3000.
export const TEST_ORIGIN = 'http://localhost:3000';

let memoryServer: MongoMemoryServer | MongoMemoryReplSet | undefined;

export async function startTestDb(dbName: string): Promise<void> {
  // Plain server, not a replica set: no auth path uses a transaction, and the
  // plain server starts several seconds faster.
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri(), { dbName });
}

/** Replica-set database for tests that exercise Mongo transactions. */
export async function startReplicaTestDb(dbName: string): Promise<void> {
  memoryServer = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: '127.0.0.1' } });
  await mongoose.connect(memoryServer.getUri(), { dbName });
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await memoryServer?.stop();
  memoryServer = undefined;
}

export async function clearCollections(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

export function testApp(): Application {
  return createApp();
}

export function post(app: Application, path: string, body: unknown, cookie?: string) {
  const req = request(app).post(path).set('Origin', TEST_ORIGIN).send(body as object);
  return cookie ? req.set('Cookie', cookie) : req;
}

export function put(app: Application, path: string, body: unknown, cookie?: string) {
  const req = request(app).put(path).set('Origin', TEST_ORIGIN).send(body as object);
  return cookie ? req.set('Cookie', cookie) : req;
}

export function patch(app: Application, path: string, body: unknown, cookie?: string) {
  const req = request(app).patch(path).set('Origin', TEST_ORIGIN).send(body as object);
  return cookie ? req.set('Cookie', cookie) : req;
}

export function get(app: Application, path: string, cookie?: string) {
  const req = request(app).get(path);
  return cookie ? req.set('Cookie', cookie) : req;
}

export function sessionCookie(res: Response): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = list.find((c: string) => c.startsWith('nexmart_customer_session='));
  if (!found) throw new Error('No customer session cookie on response');
  return found.split(';')[0];
}

/** A verified, logged-in customer plus their session cookie. */
export async function registerAndVerify(
  app: Application,
  email: string,
  password: string,
): Promise<{ cookie: string; customerId: string }> {
  const { Customer } = await import('../models/Customer');
  const { hashResetCode } = await import('../utils/resetCode');
  await post(app, '/api/v1/customer/auth/register', { name: 'Test Customer', email, password });
  // Codes are stored SHA-256 hashed (audit 2026-09-22 §B2), so the plaintext
  // only ever exists inside the mocked email transport. Stamp a known code in
  // exactly the shape production writes it, then verify with the plaintext.
  const KNOWN_CODE = '123456';
  await Customer.updateOne(
    { email },
    { $set: { otp: hashResetCode(KNOWN_CODE), otpExpiry: new Date(Date.now() + 10 * 60 * 1000), otpAttempts: 0 } },
  );
  await post(app, '/api/v1/customer/auth/verify-otp', { email, otp: KNOWN_CODE });
  const login = await post(app, '/api/v1/customer/auth/login', { email, password });
  const customer = await Customer.findOne({ email });
  return { cookie: sessionCookie(login), customerId: String(customer?._id) };
}
