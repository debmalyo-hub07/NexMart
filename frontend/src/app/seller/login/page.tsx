import { AuthForm } from '@/components/auth/AuthForm';

export const metadata = { title: 'Seller Sign In | NexMart' };

export default function SellerLoginPage() {
  return (
    <AuthForm
      type="login"
      portal="seller"
      title="Seller sign in"
      submitText="Sign in to seller desk"
      linkText="New seller? Start an application"
      linkHref="/seller/register"
      redirectUrl="/seller/dashboard"
      note="Seller access is separate from customer accounts and requires email verification."
      fields={[
        { name: 'email', label: 'Business email', type: 'email' },
        { name: 'password', label: 'Password', type: 'password' },
      ]}
    />
  );
}
