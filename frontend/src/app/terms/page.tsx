import { PolicyLayout } from '@/components/layout/PolicyLayout';
import { storefrontPolicies } from '@/lib/storefrontPolicies';
import { businessDetails } from '@/lib/businessDetails';

export const metadata = { title: 'Terms & conditions', robots: { index: businessDetails.policiesApproved, follow: true } };
export default function Page() {
  return <PolicyLayout policy={storefrontPolicies.terms} path="/terms" />;
}
