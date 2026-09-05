'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { useUIStore } from '@/store/uiStore';
import { Loader2, Mail, User, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const MOCK_ACTIVITY = [
  { action: 'Admin Profile Updated', time: 'Just now', ip: '127.0.0.1' },
  { action: 'Database backup completed', time: '2 hours ago', ip: 'System' },
  { action: 'Delivery Agent Approved: Rahul K.', time: '1 day ago', ip: '192.168.1.10' },
  { action: 'Bulk stock update for Electronics', time: '3 days ago', ip: '192.168.1.10' },
];

const profileSchema = z.object({
  name: z.string().min(2, 'Enter your full name'),
  email: z.string().min(1, 'Enter your email address').email('Enter a valid email address'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function AdminProfilePage() {
  const { user, refreshUser } = useAuthStore();
  const { showToast } = useUIStore();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
    },
  });

  const formName = watch('name');
  const formEmail = watch('email');

  const onSubmit = async (values: ProfileFormData) => {
    setLoading(true);

    try {
      const res = await api.put('/admin/profile', values);
      if (res.data.success) {
        showToast('Profile updated successfully', 'success');
        await refreshUser(); // Update the local user state
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to update profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 font-syne">Admin Control Center</h1>
        <p className="text-white/50 text-sm">Manage your admin details and view security logs.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card & Quick Link */}
        <div className="lg:col-span-1 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card flex flex-col items-center text-center p-6 space-y-4"
          >
            <div className="w-20 h-20 rounded-full bg-violet-600/20 border-4 border-violet-500/20 flex items-center justify-center text-2xl font-bold text-violet-300">
              {formName ? formName.charAt(0).toUpperCase() : 'A'}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white font-syne">{formName || 'Admin'}</h2>
              <p className="text-sm text-white/40">{formEmail}</p>
            </div>
            <div className="badge-violet text-xs font-semibold px-3 py-1.5 rounded-full uppercase tracking-wider">
              Admin
            </div>
            <div className="w-full pt-4 border-t border-white/5">
              <Link href="/admin" className="btn-primary w-full text-center py-2.5">
                Go to Dashboard
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Update Form & Activity Log */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            <h3 className="text-lg font-semibold text-white mb-4 font-syne">Account Details</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70 ml-1">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User size={18} className="text-white/40" />
                  </div>
                  <input
                    type="text"
                    {...register('name')}
                    className="w-full bg-black/40 border border-white/[0.08] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 focus:bg-[#1a1a24] transition-all"
                    placeholder="Enter your full name"
                  />
                </div>
                {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70 ml-1">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail size={18} className="text-white/40" />
                  </div>
                  <input
                    type="email"
                    {...register('email')}
                    className="w-full bg-black/40 border border-white/[0.08] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 focus:bg-[#1a1a24] transition-all"
                    placeholder="Enter your email address"
                  />
                </div>
                {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
                <p className="text-xs text-amber-400/80 mt-2 px-1">
                  Warning: If you change your email, you must use the new email to log in next time.
                </p>
              </div>

              <div className="pt-4 border-t border-white/5">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex items-center gap-2"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <h3 className="text-lg font-semibold text-white mb-4 font-syne">Security & Activity Log</h3>
            <div className="space-y-3">
              {MOCK_ACTIVITY.map((act, index) => (
                <div key={index} className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm">
                  <div>
                    <p className="text-white/80 font-medium">{act.action}</p>
                    <p className="text-xs text-white/40">IP: {act.ip}</p>
                  </div>
                  <span className="text-xs text-white/30 shrink-0">{act.time}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
