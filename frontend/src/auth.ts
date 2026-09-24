import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { BACKEND_SESSION_MAX_AGE_SECONDS } from '@/lib/sessionConstants';
import { serverApiFetch } from '@/lib/serverApi';
import { backendApiBase } from '@/lib/apiUrl';

const roleSchema = z.enum(['admin', 'customer', 'agent', 'seller']);
const profileSchema = z.object({ _id: z.string(), name: z.string(), email: z.string(), role: roleSchema, profilePicture: z.string().optional() });

async function verifyBackendIdentity(accessToken: string, role: z.infer<typeof roleSchema>, request?: Request) {
  const response = await serverApiFetch(`${backendApiBase()}/${role}/profile`, {
    request, headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return null;
  const body = await response.json();
  const profile = profileSchema.safeParse(body?.data);
  if (!body.success || !profile.success || profile.data.role !== role) return null;
  return { id: profile.data._id, name: profile.data.name, email: profile.data.email, image: profile.data.profilePicture, role: profile.data.role, accessToken };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! }),
    Credentials({
      name: 'credentials',
      credentials: { accessToken: { type: 'text' }, role: { type: 'text' } },
      async authorize(credentials, request) {
        const parsed = z.object({ accessToken: z.string().min(1).max(8192), role: roleSchema }).safeParse(credentials);
        if (!parsed.success) return null;
        // Password authentication has already happened once at the API. Verify
        // that very same session, rather than minting a second backend token.
        try { return await verifyBackendIdentity(parsed.data.accessToken, parsed.data.role, request); }
        catch { return null; }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return true;
      if (!account.id_token) return false;
      try {
        const response = await serverApiFetch(`${backendApiBase()}/auth/google/callback`, {
          method: 'POST', body: JSON.stringify({ idToken: account.id_token }), signal: AbortSignal.timeout(20000),
        });
        const data = await response.json();
        if (!response.ok || !data.success || !data.data?.token || data.data.user?.role !== 'customer') return false;
        user.id = data.data.user.id;
        user.role = 'customer';
        user.accessToken = data.data.token;
        return true;
      } catch { return false; }
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role || 'customer';
        token.accessToken = user.accessToken;
      }
      // A password change can rotate a token, but may never change identity.
      // The browser cannot grant itself a role with useSession().update().
      if (trigger === 'update' && typeof session?.accessToken === 'string' && session.accessToken.length <= 8192 && token.role) {
        const role = roleSchema.safeParse(token.role);
        if (role.success) {
          try {
            const identity = await verifyBackendIdentity(session.accessToken, role.data);
            if (identity && identity.id === token.sub) token.accessToken = identity.accessToken;
          } catch { /* Keep the established identity if refresh is unavailable. */ }
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub || '';
      const role = roleSchema.safeParse(token.role);
      session.user.role = role.success ? role.data : 'customer';
      session.user.accessToken = typeof token.accessToken === 'string' ? token.accessToken : undefined;
      return session;
    },
  },
  pages: { signIn: '/customer/login', error: '/customer/login' },
  session: { strategy: 'jwt', maxAge: BACKEND_SESSION_MAX_AGE_SECONDS },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
});
