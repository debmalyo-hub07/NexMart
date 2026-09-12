import { AuthForm } from '@/components/auth/AuthForm';

export const metadata = { title: 'Agent Register | NexMart' };

export default function AgentRegister() {
  return (
    <AuthForm
      type="register"
      portal="agent"
      title="Agent Application"
      submitText="Apply as Delivery Agent"
      linkText="Already registered? Login"
      linkHref="/delivery/login"
      redirectUrl="/delivery/login"
      note="Your account will be reviewed by an admin before activation."
      fields={[
        { name: 'name', label: 'Full Name', type: 'text' },
        { name: 'email', label: 'Email Address', type: 'email' },
        { name: 'password', label: 'Password', type: 'password' },
        { name: 'confirmPassword', label: 'Confirm Password', type: 'password' },
        { name: 'vehicleType', label: 'Vehicle Type (e.g., Bike, Van)', type: 'text' },
        { name: 'vehicleModel', label: 'Vehicle Model (e.g., Honda Activa)', type: 'text' },
        { name: 'licensePlate', label: 'License Plate Number', type: 'text' },
        { name: 'city', label: 'City', type: 'text' },
        { name: 'address', label: 'Full Address', type: 'text' },
        { name: 'aadharNumber', label: 'Aadhar Number (Authenticated)', type: 'text' },
      ]}
    />
  );
}
