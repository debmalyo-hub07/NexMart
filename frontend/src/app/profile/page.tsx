'use client';

import { useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { User, Mail, MapPin, Plus, Trash2, Edit2, Loader2, Camera, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { getInitials } from '@/lib/utils';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ProfileSkeleton } from '@/components/common/SkeletonLoader';
import { AddressForm, type AddressFormData } from '@/components/profile/AddressForm';
import { PasswordModal } from '@/components/profile/PasswordModal';
import { Address } from '@/types';

const profileSchema = z.object({
  name: z.string().min(2),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional().or(z.literal('')),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be in E.164 format').optional().or(z.literal('')),
});

type ProfileTabs = 'profile' | 'addresses' | 'security';

export default function ProfilePage() {
  const { user, refreshUser } = useAuthStore();
  const { showToast } = useUIStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ProfileTabs>('profile');
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [deleteAddr, setDeleteAddr] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const { data: userData, isLoading } = useQuery({
    queryKey: ['customer-profile'],
    queryFn: () => api.get('/customer/profile').then((r) => r.data.data),
    staleTime: 0,
  });

  const profile = userData || user;

  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: {
      name: profile?.name || '',
      gender: (profile?.gender as 'male' | 'female' | 'other' | 'prefer_not_to_say') || undefined,
      phone: profile?.phone || '',
    },
  });

  const handleTabChange = useCallback((key: ProfileTabs) => setTab(key), []);

  const onSave = async (data: z.infer<typeof profileSchema>) => {
    try {
      const payload: Record<string, string> = { name: data.name };
      if (data.gender) payload.gender = data.gender;
      if (data.phone) payload.phone = data.phone;
      const res = await api.put('/customer/profile', payload);
      const updated = res.data.data;
      reset({
        name: updated?.name || data.name,
        gender: (updated?.gender as 'male' | 'female' | 'other' | 'prefer_not_to_say') || undefined,
        phone: updated?.phone || data.phone || '',
      });
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['customer-profile'] });
      showToast('Profile updated successfully!');
    } catch {
      showToast('Failed to update profile', 'error');
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    const form = new FormData();
    form.append('avatar', file);
    try {
      await api.put('/customer/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshUser();
      showToast('Avatar updated');
    } catch {
      showToast('Failed to upload image', 'error');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await api.delete(`/customer/address/${id}`);
      queryClient.invalidateQueries({ queryKey: ['customer-profile'] });
      showToast('Address deleted');
    } catch {
      showToast('Failed to delete address', 'error');
    } finally {
      setDeleteAddr(null);
    }
  };

  const handleAddressSubmit = async (data: AddressFormData) => {
    setAddressLoading(true);
    try {
      if (editingAddress) {
        await api.put(`/customer/address/${editingAddress._id}`, data);
        showToast('Address updated');
      } else {
        await api.post('/customer/address', data);
        showToast('Address added');
      }
      queryClient.invalidateQueries({ queryKey: ['customer-profile'] });
      setShowAddressForm(false);
      setEditingAddress(null);
    } catch {
      showToast('Failed to save address', 'error');
    } finally {
      setAddressLoading(false);
    }
  };

  const tabs: { key: ProfileTabs; label: string; icon: any }[] = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'addresses', label: 'Addresses', icon: MapPin },
    { key: 'security', label: 'Security', icon: Mail },
  ];

  return (
    <div className="min-h-screen bg-space-900">      <div className="pt-[72px]">
        <div className="page-container py-12">
          <h1 className="font-syne text-3xl font-bold text-white mb-8">My Profile</h1>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="glass rounded-2xl p-6 border border-white/5 text-center mb-4">
                <div className="relative inline-block mb-4">
                  {profile?.profilePicture ? (
                    <Image src={profile.profilePicture} alt={profile.name} width={80} height={80} className="rounded-full object-cover" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-2xl font-bold text-violet-300 mx-auto">
                      {getInitials(profile?.name || 'U')}
                    </div>
                  )}
                  <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center cursor-pointer hover:bg-violet-500 transition-colors">
                    {avatarLoading ? <Loader2 size={12} className="animate-spin text-white" /> : <Camera size={12} className="text-white" />}
                    <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  </label>
                </div>
                <p className="font-syne font-semibold text-white">{profile?.name}</p>
                <p className="text-xs text-white/40 mt-1">{profile?.email}</p>
                <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                  {profile?.authProviders?.map((p: string) => (
                    <span key={p} className="badge-violet text-[10px]">{p}</span>
                  ))}
                </div>
              </div>

              <nav className="glass rounded-2xl p-2 border border-white/5 space-y-1">
                {tabs.map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => handleTabChange(key)}
                    className={`nav-item w-full ${tab === key ? 'active' : ''}`}
                    suppressHydrationWarning
                  >
                    <Icon size={15} />{label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="lg:col-span-3">
              {isLoading ? <ProfileSkeleton /> : (
                <motion.div key={tab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                  {tab === 'profile' && (
                    <div className="glass rounded-2xl p-8 border border-white/5">
                      <h2 className="font-syne font-semibold text-xl text-white mb-6">Personal Information</h2>
                      <form onSubmit={handleSubmit(onSave)} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className="text-xs text-white/60 mb-1.5 block">Full Name</label>
                            <input {...register('name')} className="input" suppressHydrationWarning />
                            {errors.name?.message && <p className="text-xs text-red-400 mt-1">{errors.name.message as string}</p>}
                          </div>
                          <div>
                            <label className="text-xs text-white/60 mb-1.5 block">Gender</label>
                            <div className="relative">
                              <select {...register('gender')} className="input appearance-none pr-10 bg-space-900" suppressHydrationWarning>
                                <option value="" disabled className="bg-space-900 text-white/40">Select gender</option>
                                <option value="male" className="bg-space-900">Male</option>
                                <option value="female" className="bg-space-900">Female</option>
                                <option value="other" className="bg-space-900">Other</option>
                                <option value="prefer_not_to_say" className="bg-space-900">Prefer not to say</option>
                              </select>
                              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-white/60 mb-1.5 block">Email</label>
                            <input value={profile?.email || ''} disabled className="input opacity-50 cursor-not-allowed" suppressHydrationWarning />
                          </div>
                          <div>
                            <label className="text-xs text-white/60 mb-1.5 block">Phone</label>
                            <input {...register('phone')} placeholder="+91 9876543210" className="input" suppressHydrationWarning />
                            {errors.phone?.message && <p className="text-xs text-red-400 mt-1">{errors.phone.message as string}</p>}
                          </div>
                        </div>
                        <button type="submit" disabled={isSubmitting} className="btn-primary" suppressHydrationWarning>
                          {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : 'Save Changes'}
                        </button>
                      </form>
                    </div>
                  )}

                  {tab === 'addresses' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="font-syne font-semibold text-xl text-white">Saved Addresses</h2>
                        {!showAddressForm && (
                          <button onClick={() => { setEditingAddress(null); setShowAddressForm(true); }} className="btn-primary py-2 px-4 text-xs">
                            <Plus size={14} /> Add Address
                          </button>
                        )}
                      </div>

                      {showAddressForm ? (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                          <AddressForm
                            initialData={editingAddress || undefined}
                            onSubmit={handleAddressSubmit}
                            onCancel={() => { setShowAddressForm(false); setEditingAddress(null); }}
                            isLoading={addressLoading}
                          />
                        </motion.div>
                      ) : (
                        <>
                          {(profile?.addresses || []).map((addr: Address) => (
                            <div key={addr._id} className="glass rounded-2xl p-5 border border-white/5 flex gap-4">
                              <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 h-fit">
                                <MapPin size={18} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium text-white text-sm">{addr.fullName}</p>
                                  <span className="badge-violet text-[10px]">{addr.label}</span>
                                  {addr.isDefault && <span className="badge-acid text-[10px]">Default</span>}
                                </div>
                                <p className="text-xs text-white/60">{addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''}</p>
                                <p className="text-xs text-white/60">{addr.city}, {addr.state} - {addr.pincode}</p>
                                <p className="text-xs text-white/50 mt-1">{addr.phone}</p>
                              </div>
                              <div className="flex flex-col gap-2">
                                <button onClick={() => { setEditingAddress(addr); setShowAddressForm(true); }} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                                  <Edit2 size={14} />
                                </button>
                                <button onClick={() => setDeleteAddr(addr._id!)} className="p-2 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}

                          {(profile?.addresses || []).length === 0 && (
                            <div className="text-center py-12 text-white/40 glass rounded-2xl border border-white/5">
                              <MapPin size={32} className="mx-auto mb-3 opacity-30" />
                              <p className="mb-4">No saved addresses</p>
                              <button onClick={() => { setEditingAddress(null); setShowAddressForm(true); }} className="btn-secondary py-2 px-4 text-xs mx-auto">
                                <Plus size={14} /> Add Your First Address
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {tab === 'security' && (
                    <div className="glass rounded-2xl p-8 border border-white/5">
                      <h2 className="font-syne font-semibold text-white mb-6">Security Settings</h2>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 glass rounded-xl border border-white/5">
                          <div>
                            <p className="text-sm font-medium text-white">Email Verification</p>
                            <p className="text-xs text-white/40">{profile?.email}</p>
                          </div>
                          <span className={profile?.emailVerified ? 'badge-acid' : 'badge-amber'}>
                            {profile?.emailVerified ? 'Verified' : 'Unverified'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-4 glass rounded-xl border border-white/5">
                          <div>
                            <p className="text-sm font-medium text-white">Password</p>
                            <p className="text-xs text-white/40">Update your account password</p>
                          </div>
                          <button onClick={() => setShowPasswordModal(true)} className="btn-secondary text-xs px-3 py-1.5">Change</button>
                        </div>
                        <div className="flex items-center justify-between p-4 glass rounded-xl border border-white/5">
                          <div>
                            <p className="text-sm font-medium text-white">Connected Accounts</p>
                            <p className="text-xs text-white/40">{profile?.authProviders?.join(', ')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteAddr}
        title="Delete Address"
        description="Are you sure you want to delete this address? This cannot be undone."
        onConfirm={() => deleteAddr && handleDeleteAddress(deleteAddr)}
        onCancel={() => setDeleteAddr(null)}
      />

      <PasswordModal 
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />    </div>
  );
}
