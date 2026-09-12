import { AuthForm } from '@/components/auth/AuthForm';

export const metadata = { title: 'Customer Register | NexMart' };

export default function CustomerRegister() {
  return (
    <AuthForm
      type="register"
      portal="customer"
      title="Create Account"
      submitText="Create Customer Account"
      linkText="Already a customer? Login here"
      linkHref="/customer/login"
      redirectUrl="/customer/login"
      showGoogle
      fields={[
        { name: 'name', label: 'Full Name', type: 'text' },
        { name: 'email', label: 'Email Address', type: 'email' },
        { name: 'password', label: 'Password', type: 'password' },
        { name: 'confirmPassword', label: 'Confirm Password', type: 'password' },
        { name: 'address', label: 'Address', type: 'text' },
        { name: 'city', label: 'City', type: 'text' },
        { name: 'phone', label: 'Phone (10-digit mobile)', type: 'tel' },
        { name: 'state', label: 'State', type: 'text' },
        { name: 'pincode', label: 'Pincode', type: 'text' },
      ]}
    />
  );
}
