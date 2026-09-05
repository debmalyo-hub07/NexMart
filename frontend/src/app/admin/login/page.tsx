import { AuthForm } from '@/components/auth/AuthForm';
import { auth } from '@/auth';

export const metadata = { title: 'Admin Login | NexMart' };

export default async function AdminLogin() {
  // The register page requires an existing admin session (middleware) —
  // only show the link to admins. First admin comes from the seed script.
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

  return (
    <AuthForm
      type="login"
      role="admin"
      title="Admin Portal"
      submitText="Admin Login"
      linkText={isAdmin ? 'Register New Admin' : ''}
      linkHref="/admin/register"
      redirectUrl="/admin"
      fields={[
        { name: 'email', label: 'Email Address', type: 'email' },
        { name: 'password', label: 'Password', type: 'password' },
      ]}
    />
  );
}
