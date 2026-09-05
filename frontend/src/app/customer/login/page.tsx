import { AuthForm } from '@/components/auth/AuthForm';

export const metadata = { title: 'Customer Login | NexMart' };

export default function CustomerLogin() {
  return (
    <AuthForm
      type="login"
      role="customer"
      title="Sign In"
      submitText="Customer Login"
      linkText="New here? Register"
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
