import { AuthForm } from '@/components/auth/AuthForm';

export const metadata = { title: 'Admin Login | NexMart' };

export default function AdminLogin() {
  return (
    <AuthForm
      type="login"
      role="admin"
      title="Admin Portal"
      submitText="Admin Login"
      linkText="Register Admin Account"
      linkHref="/admin/register"
      redirectUrl="/admin"
      fields={[
        { name: 'email', label: 'Email Address', type: 'email' },
        { name: 'password', label: 'Password', type: 'password' },
      ]}
    />
  );
}
