import { AuthForm } from '@/components/auth/AuthForm';

export const metadata = { title: 'Apply To Sell | NexMart' };

export default function SellerRegisterPage() {
  return (
    <AuthForm
      type="register"
      portal="seller"
      title="Apply to sell"
      submitText="Create seller account"
      linkText="Already have a seller account? Sign in"
      linkHref="/seller/login"
      redirectUrl="/seller/login"
      note="Your account starts in draft. NexMart reviews the business details before listings can be published."
      fields={[
        { name: 'name', label: 'Account owner name', type: 'text' },
        { name: 'email', label: 'Business email', type: 'email' },
        { name: 'phone', label: 'Business phone', type: 'tel' },
        { name: 'legalBusinessName', label: 'Legal business name', type: 'text' },
        { name: 'storefrontName', label: 'Storefront name', type: 'text' },
        { name: 'businessType', label: 'Business type', type: 'select', options: [
          { value: 'individual', label: 'Individual' },
          { value: 'proprietorship', label: 'Proprietorship' },
          { value: 'partnership', label: 'Partnership' },
          { value: 'llp', label: 'LLP' },
          { value: 'private_limited', label: 'Private limited company' },
          { value: 'other', label: 'Other' },
        ] },
        { name: 'password', label: 'Password', type: 'password' },
        { name: 'confirmPassword', label: 'Confirm password', type: 'password' },
      ]}
    />
  );
}
