import { AuthForm } from '@/components/auth/AuthForm';

export const metadata = { title: 'Customer Login | NexMart' };

export default function CustomerLogin() {
  return (
    <AuthForm
      type="login"
      portal="customer"
      title="Welcome back."
      submitText="Sign in"
      linkText="New to NexMart? Create an account"
      linkHref="/customer/register"
      redirectUrl="/"
      showGoogle
      fields={[
        { name: 'email', label: 'Email Address', type: 'email' },
        { name: 'password', label: 'Password', type: 'password' },
      ]}
    />
  );
}
