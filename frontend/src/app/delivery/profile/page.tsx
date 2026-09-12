'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Truck, User, MapPin, BadgeCheck, Clock, XCircle, FileText, Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDate } from '@/lib/utils';
import Image from 'next/image';
import { getInitials } from '@/lib/utils';
import Link from 'next/link';

export default function DeliveryProfilePage() {
  const { user } = useAuthStore();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['delivery', 'agent-profile'],
    queryFn: () => api.get('/agent/profile').then((r) => r.data.data),
  });

  const profile = data || user;

  return (
    <div className="page-container py-8 space-y-6">
        {/* The card falls back to the signed-in session when the live profile
            cannot be read — including the approval status, which must not be
            presented as current if it was not just fetched. */}
        {isError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-sm text-amber-200" role="status">
            <span>Your live profile could not be loaded. The details below are from your current session and may be out of date.</span>
            <button type="button" onClick={() => void refetch()} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-amber-300/30 px-3 text-amber-100 transition-colors hover:bg-amber-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70">
              <RefreshCw size={14} aria-hidden /> Retry
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-violet-500" size={32} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Sidebar Profile Card */}
            <div className="lg:col-span-1">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 border border-white/5 text-center">
                <div className="relative inline-block mb-4">
                  {profile?.profilePicture ? (
                    <Image src={profile.profilePicture} alt={profile.name} width={96} height={96} className="rounded-full object-cover border-4 border-violet-500/20" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-violet-600/20 border-4 border-violet-500/20 flex items-center justify-center text-3xl font-bold text-violet-300 mx-auto">
                      {getInitials(profile?.name || 'A')}
                    </div>
                  )}
                  {profile?.status === 'approved' && (
                    <div className="absolute -bottom-1 -right-1 bg-space-900 rounded-full p-1">
                      <BadgeCheck size={20} className="text-acid-400" />
                    </div>
                  )}
                </div>
                <h2 className="font-outfit font-bold text-xl text-white mb-1">{profile?.name}</h2>
                <p className="text-sm text-muted mb-4">{profile?.email}</p>
                <div className="inline-block">
                  <StatusBadge status={profile?.status || 'pending'} />
                </div>
              </motion.div>
            </div>

            {/* Main Details */}
            <div className="lg:col-span-2 space-y-6">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6 border border-white/5">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                  <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400">
                    <User size={18} />
                  </div>
                  <h3 className="font-outfit font-semibold text-lg text-white">Personal Information</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-muted mb-1 uppercase tracking-wider">Full Name</p>
                    <p className="text-white font-medium">{profile?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1 uppercase tracking-wider">Email Address</p>
                    <p className="text-white font-medium">{profile?.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1 uppercase tracking-wider">Operating City</p>
                    <div className="flex items-center gap-2 text-white font-medium">
                      <MapPin size={14} className="text-violet-400" />
                      {profile?.city || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1 uppercase tracking-wider">Joined Date</p>
                    <p className="text-white font-medium">{profile?.createdAt ? formatDate(profile.createdAt) : 'N/A'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted mb-1 uppercase tracking-wider">Full Address</p>
                    <p className="text-white font-medium">{profile?.address || 'N/A'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted mb-1 uppercase tracking-wider">Aadhar Number (Authenticated)</p>
                    <p className="text-white font-medium tracking-widest">{profile?.aadharNumber || 'N/A'}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-acid-400/10 text-acid-400">
                      <Truck size={18} />
                    </div>
                    <h3 className="font-outfit font-semibold text-lg text-white">Vehicle Details</h3>
                  </div>
                  {profile?.status === 'approved' ? (
                    <div className="badge-acid gap-1.5">
                      <BadgeCheck size={14} /> Verified by Admin
                    </div>
                  ) : profile?.status === 'pending' ? (
                    <div className="badge-amber gap-1.5">
                      <Clock size={14} /> Pending review
                    </div>
                  ) : profile?.status === 'rejected' ? (
                    <div className="badge-red gap-1.5">
                      <XCircle size={14} /> Not approved
                    </div>
                  ) : null}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-muted mb-1 uppercase tracking-wider">Vehicle Type</p>
                    <p className="text-white font-medium capitalize">{profile?.vehicleType || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1 uppercase tracking-wider">Vehicle Model</p>
                    <p className="text-white font-medium">{profile?.vehicleModel || 'N/A'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted mb-1 uppercase tracking-wider">License Plate Number</p>
                    <div className="inline-flex items-center justify-center px-4 py-2 bg-black/40 border-2 border-white/10 rounded-lg text-lg font-mono font-bold tracking-widest text-white mt-1 shadow-inner">
                      {profile?.licensePlate || 'N/A'}
                    </div>
                  </div>
                </div>
              </motion.div>
              
              <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-sm text-violet-200">
                <FileText size={18} className="shrink-0 mt-0.5" />
                <p>
                  These details were provided during registration and verified by NexMart administration. 
                  For any updates or modifications to your vehicle details, please contact admin support.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
