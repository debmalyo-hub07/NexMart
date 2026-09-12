import { AuthForm } from '@/components/auth/AuthForm';

export const metadata = { title: 'Admin Register | NexMart' };

export default function AdminRegister() {
  return (
    <AuthForm
      type="register"
      portal="admin"
      title="Admin Registration"
      submitText="Register as Admin"
      linkText="Already have an account? Admin Login"
      linkHref="/admin/login"
      redirectUrl="/admin/login"
      note="⚠️ Admin registration requires the master secret key. Only authorized personnel can register."
      fields={[
        { name: 'name', label: 'Full Name', type: 'text' },
        { name: 'email', label: 'Email Address', type: 'email' },
        { name: 'password', label: 'Password', type: 'password' },
        { name: 'confirmPassword', label: 'Confirm Password', type: 'password' },
        { name: 'secretKey', label: 'Admin Secret Key', type: 'password' },
      ]}
    />
  );
}
