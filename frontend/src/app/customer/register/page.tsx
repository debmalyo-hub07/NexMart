import { AuthForm } from '@/components/auth/AuthForm';

export const metadata = { title: 'Customer Register | NexMart' };

export default function CustomerRegister() {
  return (
    <AuthForm
      type="register"
      portal="customer"
      title="Make yourself at home."
      submitText="Create your account"
      linkText="Already have an account? Sign in"
      linkHref="/customer/login"
      redirectUrl="/customer/login"
      showGoogle
      fields={[
        { name: 'name', label: 'Full Name', type: 'text' },
        { name: 'email', label: 'Email Address', type: 'email' },
        { name: 'password', label: 'Password', type: 'password' },
        { name: 'confirmPassword', label: 'Confirm Password', type: 'password' },
      ]}
    />
  );
}
