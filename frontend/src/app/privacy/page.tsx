import { PolicyLayout } from '@/components/layout/PolicyLayout';
import { storefrontPolicies } from '@/lib/storefrontPolicies';
import { businessDetails } from '@/lib/businessDetails';

export const metadata = { title: 'Privacy notice', robots: { index: businessDetails.policiesApproved, follow: true } };
export default function Page() {
  return <PolicyLayout policy={storefrontPolicies.privacy} path="/privacy" />;
}
