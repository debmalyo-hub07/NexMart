'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, Send } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { useUIStore } from '@/store/uiStore';

type Address = { fullName: string; phone: string; addressLine1: string; city: string; state: string; pincode: string; country: 'India' };
type Profile = { lifecycleStatus: string; pickupAddress?: Address; returnAddress?: Address; policyAcceptedAt?: string; prohibitedProductsAcknowledgedAt?: string };
const emptyAddress = (): Address => ({ fullName: '', phone: '', addressLine1: '', city: '', state: '', pincode: '', country: 'India' });

export default function SellerOnboardingPage() {
  const router = useRouter();
  const { showToast } = useUIStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pickup, setPickup] = useState<Address>(emptyAddress());
  const [returns, setReturns] = useState<Address>(emptyAddress());
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [prohibited, setProhibited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    api.get('/seller/profile').then((response) => {
      if (!mounted) return;
      const data = response.data.data as Profile;
      setProfile(data);
      if (data.pickupAddress) setPickup({ ...emptyAddress(), ...data.pickupAddress });
      if (data.returnAddress) setReturns({ ...emptyAddress(), ...data.returnAddress });
      setPolicyAccepted(Boolean(data.policyAcceptedAt));
      setProhibited(Boolean(data.prohibitedProductsAcknowledgedAt));
    }).catch((requestError) => { if (mounted) setError(getApiError(requestError)); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  function update(setter: React.Dispatch<React.SetStateAction<Address>>, key: keyof Address, value: string) { setter((current) => ({ ...current, [key]: value })); }

  async function save(submit: boolean) {
    setSaving(true); setError('');
    try {
      await api.put('/seller/profile', { pickupAddress: pickup, returnAddress: returns, ...(policyAccepted ? { policyAccepted: true } : {}), ...(prohibited ? { prohibitedProductsAcknowledged: true } : {}) });
      if (submit) {
        await api.post('/seller/onboarding/submit');
        showToast('Application submitted for review', 'success');
        router.push('/seller/dashboard');
      } else showToast('Store setup saved', 'success');
    } catch (requestError) { setError(getApiError(requestError)); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex min-h-48 items-center justify-center"><Loader2 className="animate-spin text-violet-300" size={24} aria-label="Loading store setup" /></div>;
  if (error && !profile) return <div role="alert" className="border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>;
  const disabled = saving || !['draft', 'rejected'].includes(profile?.lifecycleStatus || 'draft');

  function addressFields(label: string, value: Address, setter: React.Dispatch<React.SetStateAction<Address>>) {
    return <fieldset className="space-y-4 border-t border-white/10 pt-5" disabled={disabled}><legend className="font-outfit text-lg font-semibold">{label}</legend><div className="grid gap-4 sm:grid-cols-2">{(['fullName', 'phone', 'addressLine1', 'city', 'state', 'pincode'] as const).map((key) => <label key={key} className="space-y-1.5 text-sm text-secondary"><span>{key === 'addressLine1' ? 'Address' : key === 'fullName' ? 'Contact name' : key === 'pincode' ? 'Pincode' : key[0].toUpperCase() + key.slice(1)}</span><input required value={value[key]} onChange={(event) => update(setter, key, event.target.value)} className="min-h-11 w-full rounded-lg border border-white/15 bg-space-900 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70" /></label>)}</div></fieldset>;
  }

  return <div className="space-y-7"><div><p className="text-sm text-violet-300">Store setup</p><h1 className="mt-1 font-outfit text-3xl font-semibold">Pickup, returns, and policies</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">These details help NexMart review your application and route future orders. You can save progress and return later.</p></div>{error && <p role="alert" className="border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<form onSubmit={(event) => { event.preventDefault(); void save(true); }} className="space-y-6">{addressFields('Pickup address', pickup, setPickup)}{addressFields('Return address', returns, setReturns)}<fieldset disabled={disabled} className="space-y-4 border-t border-white/10 pt-5"><legend className="font-outfit text-lg font-semibold">Marketplace policies</legend><label className="flex min-h-11 items-start gap-3 text-sm text-secondary"><input type="checkbox" checked={policyAccepted} onChange={(event) => setPolicyAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-violet-500" />I have read and accept the NexMart marketplace terms and seller policies.</label><label className="flex min-h-11 items-start gap-3 text-sm text-secondary"><input type="checkbox" checked={prohibited} onChange={(event) => setProhibited(event.target.checked)} className="mt-1 h-4 w-4 accent-violet-500" />I will not submit products prohibited by NexMart policy or applicable law.</label></fieldset><div className="flex flex-wrap gap-3"><button type="button" disabled={saving || disabled} onClick={() => void save(false)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 px-4 text-sm font-semibold text-white hover:bg-white/5 disabled:opacity-50"><Save size={16} aria-hidden /> Save progress</button><button type="submit" disabled={saving || disabled || !policyAccepted || !prohibited} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-black hover:bg-violet-100 disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />} Submit for review</button></div></form></div>;
}
