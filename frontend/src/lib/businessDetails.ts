/** Publish only operator-verified details here. Never infer a legal identity from the brand. */
export const businessDetails: {
  brand: string;
  legalName: string | null;
  registeredAddress: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  supportHours: string | null;
  grievanceOfficer: string | null;
  grievanceEmail: string | null;
  policiesApproved: boolean;
  policyUpdated: string;
} = {
  brand: 'NexMart',
  legalName: null,
  registeredAddress: null,
  supportEmail: null,
  supportPhone: null,
  supportHours: null,
  grievanceOfficer: null,
  grievanceEmail: null,
  policiesApproved: false,
  policyUpdated: '18 September 2026',
};

export const policyLinks = [
  { href: '/terms', label: 'Terms & conditions' },
  { href: '/privacy', label: 'Privacy notice' },
  { href: '/shipping', label: 'Shipping & delivery' },
  { href: '/returns', label: 'Returns & cancellations' },
  { href: '/contact', label: 'Contact & grievances' },
];
