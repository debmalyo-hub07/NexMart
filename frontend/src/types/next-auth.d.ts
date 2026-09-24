import type { DefaultSession } from 'next-auth';
import type { UserRole } from './index';

declare module 'next-auth' {
  interface User { role?: UserRole; accessToken?: string }
  interface Session { user: DefaultSession['user'] & { id: string; role: UserRole; accessToken?: string } }
}
declare module 'next-auth/jwt' {
  interface JWT { role?: UserRole; accessToken?: string }
}
