'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Truck, User, MapPin, BadgeCheck, FileText, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDate } from '@/lib/utils';
import Image from 'next/image';
import { getInitials } from '@/lib/utils';
import Link from 'next/link';

export default function DeliveryProfilePage() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['agent-profile'],
    queryFn: () => api.get('/agent/profile').then((r) => r.data.data),
  });

  const profile = data || user;

  return (
    <div className="min-h-screen bg-space-900">
      <div className="glass border-b border-white/5 sticky top-0 z-10">
        <div className="page-container flex items-center justify-between h-[64px]">
          <div className="flex items-center gap-3">
            <Link href="/delivery/dashboard" className="w-8 h-8 rounded-xl bg-violet-gradient flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20 transition-transform hover:scale-105">
              <span className="text-white font-bold text-sm">N</span>
            </Link>
            <h1 className="font-syne text-lg font-bold gradient-text leading-none">Agent Profile</h1>
          </div>
          <Link href="/delivery/dashboard" className="text-sm text-white/60 hover:text-white transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="page-container py-8 space-y-6">
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
                  <div className="absolute -bottom-1 -right-1 bg-space-900 rounded-full p-1">
                    <BadgeCheck size={20} className="text-acid-400" />
                  </div>
                </div>
                <h2 className="font-syne font-bold text-xl text-white mb-1">{profile?.name}</h2>
                <p className="text-sm text-white/50 mb-4">{profile?.email}</p>
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
                  <h3 className="font-syne font-semibold text-lg text-white">Personal Information</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-white/40 mb-1 uppercase tracking-wider">Full Name</p>
                    <p className="text-white font-medium">{profile?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 mb-1 uppercase tracking-wider">Email Address</p>
                    <p className="text-white font-medium">{profile?.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 mb-1 uppercase tracking-wider">Operating City</p>
                    <div className="flex items-center gap-2 text-white font-medium">
                      <MapPin size={14} className="text-violet-400" />
                      {profile?.city || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 mb-1 uppercase tracking-wider">Joined Date</p>
                    <p className="text-white font-medium">{profile?.createdAt ? formatDate(profile.createdAt) : 'N/A'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-white/40 mb-1 uppercase tracking-wider">Full Address</p>
                    <p className="text-white font-medium">{profile?.address || 'N/A'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-white/40 mb-1 uppercase tracking-wider">Aadhar Number (Authenticated)</p>
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
                    <h3 className="font-syne font-semibold text-lg text-white">Vehicle Details</h3>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-acid-400 bg-acid-400/10 px-3 py-1.5 rounded-full font-medium border border-acid-400/20">
                    <BadgeCheck size={14} /> Verified by Admin
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-white/40 mb-1 uppercase tracking-wider">Vehicle Type</p>
                    <p className="text-white font-medium capitalize">{profile?.vehicleType || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 mb-1 uppercase tracking-wider">Vehicle Model</p>
                    <p className="text-white font-medium">{profile?.vehicleModel || 'N/A'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-white/40 mb-1 uppercase tracking-wider">License Plate Number</p>
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
    </div>
  );
}
