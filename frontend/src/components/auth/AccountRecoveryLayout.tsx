import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/common/Logo';

export function AccountRecoveryLayout({ children }: { children: React.ReactNode }) {
  return <main id="main-content" className="auth-page">
    <aside className="auth-story">
      <Image src="/images/collections/living-room.webp" alt="" fill priority sizes="50vw" />
      <div className="auth-story-shade" aria-hidden />
      <Link href="/" className="brand-wordmark"><Logo size={36} /><span>NexMart</span></Link>
      <div className="auth-story-copy"><span className="eyebrow">Your account, within reach</span><h2>A fresh start.<br />A familiar place.</h2><p>Get back to your saved finds, shopping plans and order updates.</p></div>
    </aside>
    <section className="auth-panel" aria-label="Account access"><div className="auth-panel-inner">
      <Link href="/customer/login" className="auth-back"><ArrowLeft size={16} aria-hidden />Back to sign in</Link>
      <Link href="/" className="brand-wordmark auth-mobile-brand mt-5"><Logo size={32} /><span>NexMart</span></Link>
      <p className="eyebrow mt-8">Your NexMart account</p>
      {children}
    </div></section>
  </main>;
}
