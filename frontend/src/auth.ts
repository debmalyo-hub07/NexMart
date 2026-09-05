import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { BACKEND_SESSION_MAX_AGE_SECONDS } from '@/lib/sessionConstants';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        role: { label: 'Role', type: 'text' },
      },
      async authorize(credentials) {
        const parsed = z.object({
          email: z.string().email(),
          password: z.string().min(1),
          role: z.enum(['admin', 'customer', 'agent']).default('customer'),
        }).safeParse(credentials);

        if (!parsed.success) return null;

        try {
          const endpoint = `${process.env.API_URL}/api/v1/${parsed.data.role}/auth/login`;
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: parsed.data.email, password: parsed.data.password }),
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            // Throwing error allows us to catch message in SignIn page
            throw new Error(data.message || 'Login failed');
          }

          return {
            id: data.data.user.id,
            name: data.data.user.name,
            email: data.data.user.email,
            image: data.data.user.profilePicture,
            role: data.data.user.role,
            accessToken: data.data.token,
          };
        } catch (error: any) {
          throw new Error(error.message);
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Handle Google OAuth — sync with backend
      if (account?.provider === 'google') {
        try {
          const res = await fetch(`${process.env.API_URL}/api/v1/auth/google/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              googleId: account.providerAccountId,
              email: user.email,
              name: user.name,
              picture: user.image,
            }),
          });

          const data = await res.json();
          if (data.success) {
            (user as typeof user & { role: string; accessToken: string }).role = data.data.user.role;
            (user as typeof user & { role: string; accessToken: string }).accessToken = data.data.token;
          }
        } catch {
          return false; // Prevent sign-in on backend error
        }
      }
      return true;
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as any).role || 'customer';
        token.accessToken = (user as any).accessToken;
      }
      if (trigger === 'update' && session?.role) {
        token.role = session.role;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).accessToken = token.accessToken;
      }
      return session;
    },
  },
  pages: {
    signIn: '/customer/login',
    error: '/customer/login',
  },
  session: {
    strategy: 'jwt',
    // Never outlive the backend session cookies (7d) — see lib/sessionConstants
    maxAge: BACKEND_SESSION_MAX_AGE_SECONDS,
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
});
