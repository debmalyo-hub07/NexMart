'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, ChevronRight, Search, Check, X, Loader2, FolderTree } from 'lucide-react';
import api from '@/lib/api';
import { useUIStore } from '@/store/uiStore';
import { liveQueryOptions } from '@/lib/syncConfig';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

type Category = {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  parent?: { _id: string; name: string } | null;
  displayOrder: number;
  isActive: boolean;
};

const categorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  icon: z.string().optional(),
  description: z.string().max(500, 'Description must be under 500 characters').optional(),
  parent: z.string().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

const defaultValues: CategoryFormData = { name: '', icon: '', description: '', parent: '', displayOrder: 0 };

const EMOJI_PRESETS = ['📱', '💻', '📺', '👗', '💄', '🏠', '🛒', '⚽', '📚', '🎮', '🍕', '🚗', '✈️', '💊', '🎨', '📷', '🎵', '🧸'];

export default function CategoriesPage() {
  const qc = useQueryClient();
  const { showToast } = useUIStore();
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues,
  });

  const formName = watch('name') || '';
  const formIcon = watch('icon') || '';

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'categories-manager'],
    queryFn: () => api.get('/categories?includeInactive=true').then(r => {
      const res = r.data;
      // Handle both {data: [...]} and plain array responses
      return Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
    }),
    ...liveQueryOptions,
  });

  const categories: Category[] = Array.isArray(data) ? data : [];
  const parents = useMemo(() => categories.filter(c => !c.parent), [categories]);
  const filteredParents = useMemo(() =>
    parents.filter(p => p.name.toLowerCase().includes(search.toLowerCase())),
    [parents, search]
  );

  const getChildren = (parentId: string) =>
    categories.filter(c => c.parent?._id === parentId);

  const openCreate = (parentId = '') => {
    setEditId(null);
    reset({ ...defaultValues, parent: parentId });
    setShowForm(true);
  };

  const openEdit = (cat: Category) => {
    setEditId(cat._id);
    reset({
      name: cat.name,
      icon: cat.icon || '',
      description: cat.description || '',
      parent: cat.parent?._id || '',
      displayOrder: cat.displayOrder,
    });
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: (values: CategoryFormData) => {
      const payload = { ...values, parent: values.parent || null };
      return editId
        ? api.put(`/categories/${editId}`, payload)
        : api.post('/categories', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'categories-manager'] });
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      showToast(editId ? 'Category updated' : 'Category created');
      setShowForm(false);
      reset(defaultValues);
      setEditId(null);
    },
    onError: () => showToast('Failed to save category', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'categories-manager'] });
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      showToast('Category deleted');
      setPendingDeleteId(null);
    },
    onError: () => {
      showToast('Failed to delete category', 'error');
      setPendingDeleteId(null);
    },
  });

  const toggleExpand = (id: string) =>
    setExpandedParents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-syne font-bold text-2xl text-white flex items-center gap-3">
            <FolderTree size={24} className="text-violet-400" />
            Category Manager
          </h1>
          <p className="text-sm text-white/40 mt-1">{categories.length} categories across the store</p>
        </div>
        <button onClick={() => openCreate()} className="btn-primary" suppressHydrationWarning>
          <Plus size={16} /> Add Category
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search categories..."
          className="input pl-9"
          suppressHydrationWarning
        />
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass rounded-2xl p-6 border border-violet-500/20 space-y-4"
          >
            <div className="flex justify-between items-center">
              <h2 className="font-syne font-semibold text-white">{editId ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => { setShowForm(false); setEditId(null); reset(defaultValues); }} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5" suppressHydrationWarning>
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/60 mb-1.5 block">Category Name *</label>
                <input {...register('name')} className="input" placeholder="e.g. Electronics" suppressHydrationWarning />
                {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1.5 block">Parent Category</label>
                <select {...register('parent')} className="input bg-space-900 appearance-none" suppressHydrationWarning>
                  <option value="">None (Top Level)</option>
                  {parents.map(p => (
                    <option key={p._id} value={p._id}>{p.icon} {p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1.5 block">Icon Emoji</label>
                <div className="space-y-2">
                  <input {...register('icon')} className="input" placeholder="e.g. 📱" suppressHydrationWarning />
                  <div className="flex flex-wrap gap-2">
                    {EMOJI_PRESETS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setValue('icon', emoji, { shouldValidate: true })}
                        className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all ${formIcon === emoji ? 'bg-violet-500/30 border border-violet-500' : 'bg-white/5 hover:bg-white/10 border border-transparent'}`}
                        suppressHydrationWarning
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1.5 block">Display Order</label>
                <input type="number" {...register('displayOrder')} className="input" placeholder="0" suppressHydrationWarning />
                {errors.displayOrder && <p className="text-xs text-red-400 mt-1">{errors.displayOrder.message}</p>}
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1.5 block">Description</label>
                <textarea {...register('description')} className="input py-2" rows={3} placeholder="Optional category description" suppressHydrationWarning />
                {errors.description && <p className="text-xs text-red-400 mt-1">{errors.description.message}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
              <button onClick={() => { setShowForm(false); setEditId(null); reset(defaultValues); }} className="btn-secondary" suppressHydrationWarning>Cancel</button>
              <button onClick={handleSubmit(values => saveMutation.mutate(values))} disabled={!formName.trim() || saveMutation.isPending} className="btn-primary" suppressHydrationWarning>
                {saveMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <><Check size={15} /> {editId ? 'Update' : 'Create'}</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Tree */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-violet-400" /></div>
      ) : (
        <div className="space-y-3">
          {filteredParents.map(parent => {
            const children = getChildren(parent._id);
            const isExpanded = expandedParents.has(parent._id);
            return (
              <div key={parent._id} className="glass rounded-2xl border border-white/5 overflow-hidden">
                {/* Parent row */}
                <div className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors group">
                  <button
                    onClick={() => toggleExpand(parent._id)}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                    suppressHydrationWarning
                  >
                    <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
                      <ChevronRight size={16} className="text-white/40" />
                    </motion.div>
                  </button>
                  <span className="text-2xl">{parent.icon || '📦'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{parent.name}</p>
                    <p className="text-xs text-white/40">{children.length} subcategories · /{parent.slug}</p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openCreate(parent._id)} className="p-2 rounded-lg text-white/40 hover:text-violet-400 hover:bg-violet-400/10 transition-colors text-xs flex items-center gap-1.5" suppressHydrationWarning>
                      <Plus size={13} /> Sub
                    </button>
                    <button onClick={() => openEdit(parent)} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors" suppressHydrationWarning>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setPendingDeleteId(parent._id)} className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors" suppressHydrationWarning>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Children */}
                <AnimatePresence>
                  {isExpanded && children.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-white/5"
                    >
                      {children.map((child, i) => (
                        <div key={child._id} className={`flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors group ${i < children.length - 1 ? 'border-b border-white/5' : ''}`}>
                          <div className="w-8" />
                          <div className="w-2 h-2 rounded-full bg-violet-500/50 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white/80">{child.name}</p>
                            <p className="text-xs text-white/30">/{child.slug}</p>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(child)} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors" suppressHydrationWarning>
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setPendingDeleteId(child._id)} className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors" suppressHydrationWarning>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {filteredParents.length === 0 && (
            <div className="text-center py-20 text-white/30">
              <FolderTree size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-lg">No categories found</p>
              <button onClick={() => openCreate()} className="btn-primary mt-4" suppressHydrationWarning>
                <Plus size={16} /> Create First Category
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Delete Category"
        description="Are you sure you want to delete this category? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => pendingDeleteId && deleteMutation.mutate(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
