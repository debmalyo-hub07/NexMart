import { AuthForm } from '@/components/auth/AuthForm';

export const metadata = { title: 'Agent Login | NexMart' };

export default function AgentLogin() {
  return (
    <AuthForm
      type="login"
      portal="agent"
      title="Delivery Portal"
      submitText="Agent Login"
      linkText="Register as an Agent"
      linkHref="/delivery/register"
      redirectUrl="/delivery/dashboard"
      fields={[
        { name: 'email', label: 'Email Address', type: 'email' },
        { name: 'password', label: 'Password', type: 'password' },
      ]}
    />
  );
}
