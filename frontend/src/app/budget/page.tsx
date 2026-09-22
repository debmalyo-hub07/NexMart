import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/PageHeader';
import { BudgetTool } from '@/components/product/BudgetTool';

export const metadata: Metadata = {
  title: 'Shop by budget',
  description: 'Set a price ceiling and see everything that fits — all prices include GST.',
};

export default function BudgetPage() {
  return <main id="main-content" className="store-page">
    <div className="page-container">
      <PageHeader title="Shop by budget" description="Pick a ceiling and we'll show what fits, cheapest first. Every price includes GST." />
      <BudgetTool />
    </div>
  </main>;
}
