'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import * as Tabs from '@radix-ui/react-tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Edit2, Loader2, Plus, Trash2 } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { indianPhone } from '@/lib/address';
import type { Address, ApiResponse, User } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { getInitials } from '@/lib/utils';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { QueryError } from '@/components/common/QueryError';
import { ProfileSkeleton } from '@/components/common/SkeletonLoader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Overlay } from '@/components/common/Overlay';
import { AddressForm, type AddressFormData } from '@/components/profile/AddressForm';
import { PasswordModal } from '@/components/profile/PasswordModal';

const schema = z.object({ name: z.string().trim().min(2, 'Enter your name').max(100), phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number').or(z.literal('')), gender: z.enum(['', 'male', 'female', 'other', 'prefer_not_to_say']) });
type Values = z.infer<typeof schema>;
const profileValues = (user: User): Values => ({ name: user.name, phone: indianPhone(user.phone), gender: (user.gender as Values['gender']) || '' });

export default function ProfilePage() {
  const client = useQueryClient();
  const toast = useUIStore(s => s.showToast);
  const query = useQuery({ queryKey: ['customer', 'profile'], queryFn: ({ signal }) => api.get<ApiResponse<User>>('/customer/profile', { signal }).then(r => r.data.data) });
  const profile = query.data;
  const [error, setError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [address, setAddress] = useState<Address | 'new' | null>(null);
  const [deleteAddress, setDeleteAddress] = useState<Address | null>(null);
  const [addressBusy, setAddressBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const pendingAddress = useRef(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', phone: '', gender: '' }, mode: 'onTouched' });
  const { reset, formState: { isDirty, isSubmitting, errors } } = form;
  useEffect(() => { if (profile && !isDirty) reset(profileValues(profile)); }, [profile, isDirty, reset]);
  function accept(user: User) { client.setQueryData(['customer', 'profile'], user); useAuthStore.setState(state => ({ user: { ...state.user, ...user } })); }
  async function save(values: Values) {
    setError('');
    try { const response = await api.put<ApiResponse<User>>('/customer/profile', values); if (response.data.data) { accept(response.data.data); reset(profileValues(response.data.data)); } toast('Profile saved'); }
    catch (error) { setError(getApiError(error)); }
  }
  async function saveAddress(values: AddressFormData) {
    if (pendingAddress.current) return;
    pendingAddress.current = true; setAddressBusy(true); setAddressError('');
    try {
      if (address && address !== 'new') await api.put(`/customer/address/${address._id}`, values);
      else await api.post('/customer/address', values);
      await query.refetch(); setAddress(null); toast('Address saved');
    } catch (error) { setAddressError(getApiError(error) + ' Check your saved addresses before retrying.'); }
    finally { pendingAddress.current = false; setAddressBusy(false); }
  }
  async function removeAddress() {
    if (!deleteAddress || pendingAddress.current) return;
    pendingAddress.current = true; setAddressBusy(true);
    try { await api.delete(`/customer/address/${deleteAddress._id}`); await query.refetch(); toast('Address removed'); }
    catch (error) { setError(getApiError(error)); void query.refetch(); }
    finally { pendingAddress.current = false; setAddressBusy(false); setDeleteAddress(null); }
  }
  async function upload(file?: File) {
    if (!file || avatarBusy) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Choose a JPEG, PNG or WebP image up to 5 MB.'); return; }
    setAvatarBusy(true); setError('');
    try { const data = new FormData(); data.append('avatar', file); const response = await api.put<ApiResponse<User>>('/customer/avatar', data, { headers: { 'Content-Type': 'multipart/form-data' } }); if (response.data.data) accept(response.data.data); toast('Profile photo updated'); }
    catch (error) { setError(getApiError(error)); }
    finally { setAvatarBusy(false); }
  }
  return <main id="main-content" className="store-page"><div className="page-container"><PageHeader title="Your account" description="Manage your profile, delivery addresses, and sign-in details." actions={<><Link href="/orders" className="btn-secondary">Your orders</Link><Link href="/wishlist" className="btn-secondary">Saved products</Link></>} />
    {error && <p role="alert" className="mb-5 rounded-xl border border-red-400/30 p-4 text-sm text-red-300">{error}</p>}
    {query.isError ? <QueryError label="Your profile" onRetry={() => void query.refetch()} /> : query.isPending ? <ProfileSkeleton /> : profile && <Tabs.Root defaultValue="profile">
      <Tabs.List aria-label="Account sections" className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-white/15 p-1">{['profile', 'addresses', 'security'].map(tab => <Tabs.Trigger key={tab} value={tab} className="min-h-11 flex-1 rounded-lg px-4 text-sm capitalize text-secondary data-[state=active]:bg-violet-500/15 data-[state=active]:text-white">{tab}</Tabs.Trigger>)}</Tabs.List>
      <Tabs.Content value="profile" className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]"><section className="card h-fit"><div className="mb-4 flex items-center gap-3">{profile.profilePicture ? <Image src={profile.profilePicture} alt="" width={56} height={56} className="rounded-full object-cover" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-500/15 font-semibold text-violet-200">{getInitials(profile.name)}</span>}<p className="min-w-0 break-words font-medium">{profile.name}</p></div><label htmlFor="profile-photo" className="field-label">Profile photo</label><input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full min-w-0 text-sm text-secondary file:mr-2 file:min-h-11 file:rounded-lg file:border-0 file:bg-space-700 file:px-3 file:text-white" disabled={avatarBusy} onChange={event => { void upload(event.target.files?.[0]); event.currentTarget.value = ''; }} /><p className="field-hint">JPEG, PNG or WebP. Up to 5 MB.</p>{avatarBusy && <p role="status" className="text-sm text-secondary">Uploading photo…</p>}</section>
        <section className="card"><h2 className="mb-5 text-xl">Personal details</h2><form onSubmit={form.handleSubmit(save)} noValidate><fieldset disabled={isSubmitting} className="space-y-5"><div><label htmlFor="profile-name" className="field-label">Full name</label><input id="profile-name" {...form.register('name')} autoComplete="name" className="input" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'profile-name-error' : undefined} />{errors.name && <p id="profile-name-error" className="field-error" role="alert">{errors.name.message}</p>}</div><div><label htmlFor="profile-email" className="field-label">Email address</label><input id="profile-email" readOnly value={profile.email || ''} className="input" autoComplete="email" /></div><div><label htmlFor="profile-phone" className="field-label">Mobile number (optional)</label><input id="profile-phone" {...form.register('phone')} type="tel" inputMode="numeric" maxLength={10} autoComplete="tel-national" className="input" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'profile-phone-error' : undefined} />{errors.phone && <p id="profile-phone-error" className="field-error" role="alert">{errors.phone.message}</p>}</div><div><label htmlFor="profile-gender" className="field-label">Gender (optional)</label><select id="profile-gender" {...form.register('gender')} className="input"><option value="">Not specified</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></div><button type="submit" className="btn-primary" disabled={!isDirty}>{isSubmitting && <Loader2 className="animate-spin" size={17} aria-hidden />}{isSubmitting ? 'Saving…' : 'Save changes'}</button></fieldset></form></section>
      </Tabs.Content>
      <Tabs.Content value="addresses"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl">Saved addresses</h2><button type="button" className="btn-primary" onClick={() => { setAddressError(''); setAddress('new'); }}><Plus size={17} aria-hidden />Add address</button></div>{!profile.addresses?.length ? <EmptyState title="No saved addresses" description="Save a delivery address to make checkout quicker." /> : <ul className="grid gap-4 md:grid-cols-2">{profile.addresses.map(item => <li key={item._id} className="card"><div className="mb-3 flex flex-wrap items-center gap-2"><h3 className="text-lg">{item.label}</h3>{item.isDefault && <span className="badge-acid">Default address</span>}</div><address className="break-words text-sm not-italic text-secondary"><p className="font-medium text-white">{item.fullName}</p><p>{item.addressLine1}</p><p>{item.addressLine2}</p><p>{item.city}, {item.state} {item.pincode}</p><p className="mt-2">{item.phone}</p></address><div className="mt-4 flex flex-wrap gap-3"><button type="button" className="btn-secondary" onClick={() => { setAddressError(''); setAddress(item); }}><Edit2 size={16} aria-hidden />Edit<span className="sr-only"> {item.label} address</span></button><button type="button" className="btn-secondary text-red-300" onClick={() => setDeleteAddress(item)}><Trash2 size={16} aria-hidden />Remove<span className="sr-only"> {item.label} address</span></button></div></li>)}</ul>}</Tabs.Content>
      <Tabs.Content value="security" className="card max-w-2xl"><h2 className="mb-5 text-xl">Sign-in and security</h2><p className="break-words text-sm text-secondary">Email: {profile.email}</p><p className="mt-2 text-sm text-secondary">{profile.emailVerified ? 'Your email is verified.' : 'Your email is not verified.'}</p>{profile.authProviders?.includes('email') ? <button type="button" className="btn-secondary mt-5" onClick={() => setPasswordOpen(true)}>Change password</button> : <p className="mt-5 text-sm text-muted">Manage sign-in security through your linked provider.</p>}</Tabs.Content>
    </Tabs.Root>}
    <Overlay open={!!address} onClose={() => setAddress(null)} title={address === 'new' ? 'Add address' : 'Edit address'} busy={addressBusy}>{addressError && <p role="alert" className="field-error mb-4">{addressError}</p>}{address && <AddressForm key={address === 'new' ? 'new' : address._id} initialData={address === 'new' ? undefined : address} onSubmit={saveAddress} onCancel={() => setAddress(null)} isLoading={addressBusy} />}</Overlay>
    <ConfirmDialog open={!!deleteAddress} title="Remove this address?" description="This removes the saved address from your account. Existing orders keep their delivery address." confirmLabel="Remove address" onConfirm={() => void removeAddress()} onCancel={() => setDeleteAddress(null)} isLoading={addressBusy} />
    <PasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} />
  </div></main>;
}
