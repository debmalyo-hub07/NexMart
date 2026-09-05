'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2, Upload, X, Zap, Search, ChevronRight } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useUIStore } from '@/store/uiStore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

const productSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  description: z.string().min(10, 'Description is required'),
  richDescription: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  subCategory: z.string().optional(),
  brand: z.string().optional(),
  isPublished: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  variants: z.array(z.object({
    sku: z.string().min(1, 'SKU is required'),
    price: z.number().min(0, 'Price must be positive'),
    comparePrice: z.number().optional(),
    stock: z.number().min(0, 'Stock must be positive'),
  })).min(1, 'At least one variant is required'),
});

type ProductFormData = z.infer<typeof productSchema>;

type Category = {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  parent?: { _id: string; name: string } | null;
};

// ─── Premium Category Picker ─────────────────────────────────────────────────
function CategoryPicker({
  categories,
  value,
  subValue,
  onSelect,
  onSubSelect,
  error,
}: {
  categories: Category[];
  value: string;
  subValue: string;
  onSelect: (id: string) => void;
  onSubSelect: (id: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hoveredParent, setHoveredParent] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const parents = useMemo(() => categories.filter(c => !c.parent), [categories]);
  const filteredParents = useMemo(
    () => parents.filter(p => p.name.toLowerCase().includes(search.toLowerCase())),
    [parents, search]
  );

  const getChildren = useCallback(
    (parentId: string) => categories.filter(c => c.parent?._id === parentId),
    [categories]
  );

  const selectedParent = parents.find(p => p._id === value);
  const children = value ? getChildren(value) : [];
  const selectedChild = categories.find(c => c._id === subValue);
  const activeHover: string | null = hoveredParent ?? (open ? (parents[0]?._id ?? null) : null);
  const hoverChildren = activeHover ? getChildren(activeHover) : [];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayLabel = selectedParent
    ? `${selectedParent.icon || '📦'} ${selectedParent.name}${selectedChild ? ` › ${selectedChild.name}` : ''}`
    : 'Select Category';

  return (
    <div ref={ref} className="relative">
      <label className="text-xs text-white/60 mb-1.5 flex justify-between items-center">
        <span>Category</span>
        <Link href="/admin/categories" className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors">
          Manage categories ↗
        </Link>
      </label>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        suppressHydrationWarning
        className={`w-full input text-left flex items-center justify-between gap-2 transition-[color,border-color,box-shadow] ${open ? 'border-violet-500/50 ring-1 ring-violet-500/20' : ''} ${!selectedParent ? 'text-white/30' : 'text-white'}`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronRight size={14} className={`shrink-0 text-white/30 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full left-0 right-0 mt-2 z-50 bg-space-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
          >
            {/* Search */}
            <div className="p-2 border-b border-white/5">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search categories…"
                  className="w-full bg-white/5 text-sm text-white placeholder-white/30 rounded-lg py-1.5 pl-7 pr-3 outline-none border border-transparent focus:border-violet-500/40"
                  suppressHydrationWarning
                  autoFocus
                />
              </div>
            </div>

            <div className="flex min-h-[200px] max-h-[280px]">
              {/* Parent list */}
              <div className="w-[48%] border-r border-white/5 overflow-y-auto p-1.5 space-y-0.5">
                {filteredParents.length === 0 ? (
                  <p className="text-xs text-white/30 px-3 py-4 text-center">No results</p>
                ) : filteredParents.map(cat => (
                  <button
                    key={cat._id}
                    type="button"
                    suppressHydrationWarning
                    onMouseEnter={() => setHoveredParent(cat._id)}
                    onClick={() => {
                      onSelect(cat._id);
                      onSubSelect('');
                      if (getChildren(cat._id).length === 0) setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left transition-colors ${
                      value === cat._id
                        ? 'bg-violet-600/20 text-white border border-violet-500/30'
                        : hoveredParent === cat._id
                        ? 'bg-white/[0.08] text-white border border-white/10'
                        : 'text-white/60 hover:text-white border border-transparent'
                    }`}
                  >
                    <span className="text-base leading-none">{cat.icon || '📦'}</span>
                    <span className="flex-1 truncate font-medium">{cat.name}</span>
                    {getChildren(cat._id).length > 0 && (
                      <ChevronRight size={12} className="shrink-0 opacity-40" />
                    )}
                  </button>
                ))}
              </div>

              {/* Subcategory panel */}
              <div className="w-[52%] overflow-y-auto p-1.5 space-y-0.5">
                {hoverChildren.length > 0 ? (
                  <>
                    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-3 py-1.5">Subcategories</p>
                    {hoverChildren.map(sub => (
                      <button
                        key={sub._id}
                        type="button"
                        suppressHydrationWarning
                        onClick={() => {
                          onSelect(activeHover!);
                          onSubSelect(sub._id);
                          setOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-colors ${
                          subValue === sub._id
                            ? 'bg-violet-600/20 text-white border border-violet-500/30'
                            : 'text-white/55 hover:text-white hover:bg-white/[0.06] border border-transparent'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400/50 shrink-0" />
                        {sub.name}
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-white/20 text-center px-4">
                      {filteredParents.length > 0 ? 'Hover a category to see subcategories' : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-white/5 flex justify-between items-center">
              <span className="text-[10px] text-white/25">{parents.length} categories</span>
              <Link
                href="/admin/categories"
                onClick={() => setOpen(false)}
                className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
              >
                + New category
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main ProductForm ─────────────────────────────────────────────────────────
export function ProductForm({ initialData, productId }: { initialData?: any; productId?: string }) {
  const router = useRouter();
  const { showToast } = useUIStore();
  const queryClient = useQueryClient();
  const [images, setImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>(initialData?.images || []);
  const [isDragging, setIsDragging] = useState(false);

  const { data: categoriesData } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => api.get('/categories').then(r => r.data),
    staleTime: 30_000,
  });

  const categories: Category[] = useMemo(() => {
    const raw = categoriesData;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  }, [categoriesData]);

  const { register, control, handleSubmit, setValue, getValues, watch, formState: { errors, isSubmitting } } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: initialData ? {
      name: initialData.name,
      description: initialData.description,
      category: typeof initialData.category === 'object' ? initialData.category._id : initialData.category,
      subCategory: initialData.subCategory,
      brand: initialData.brand,
      isPublished: initialData.isPublished,
      isFeatured: initialData.isFeatured,
      variants: initialData.variants,
    } : {
      isPublished: false,
      isFeatured: false,
      variants: [{ sku: '', price: 0, stock: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' });

  const selectedCategory = watch('category');
  const selectedSubCategory = watch('subCategory') || '';

  const generateSKU = (index: number) => {
    const brandStr = getValues('brand')?.substring(0, 3).toUpperCase() || 'NXM';
    const catId = getValues('category');
    const cat = categories.find(c => c._id === catId);
    const catStr = cat?.name?.substring(0, 4).toUpperCase() || 'GEN';
    const hash = Math.random().toString(36).substring(2, 6).toUpperCase();
    setValue(`variants.${index}.sku`, `${brandStr}-${catStr}-${hash}-${index + 1}`, { shouldValidate: true });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      setImages(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  }, []);

  const onSubmit = async (data: ProductFormData) => {
    try {
      if (productId) {
        const payload = { ...data, images: existingImages };
        await api.put(`/products/${productId}`, payload);
        if (images.length > 0) {
          const imageForm = new FormData();
          images.forEach(img => imageForm.append('images', img));
          await api.post(`/products/${productId}/images`, imageForm, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
        showToast('Product updated successfully');
      } else {
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
          if (key === 'variants') formData.append(key, JSON.stringify(value));
          else formData.append(key, value as any);
        });
        images.forEach(img => formData.append('images', img));
        await api.post('/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        showToast('Product created successfully');
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      router.push('/admin/products');
    } catch {
      showToast('Failed to save product', 'error');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left: main fields ── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl p-6 border border-white/5 space-y-4">
            <h2 className="font-syne font-semibold text-white">Basic Information</h2>

            <div>
              <label className="text-xs text-white/60 mb-1.5 block">Product Name</label>
              <input {...register('name')} className="input" placeholder="e.g. Wireless Noise Cancelling Headphones" suppressHydrationWarning />
              {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="text-xs text-white/60 mb-1.5 block">Description</label>
              <textarea {...register('description')} className="input min-h-[120px] py-3" placeholder="Detailed product description..." suppressHydrationWarning />
              {errors.description && <p className="text-xs text-red-400 mt-1">{errors.description.message}</p>}
            </div>
          </div>

          {/* Variants */}
          <div className="glass rounded-2xl p-6 border border-white/5 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="font-syne font-semibold text-white">Variants & Pricing</h2>
                <p className="text-xs text-white/40 mt-1">Manage SKUs, stock and pricing</p>
              </div>
              <button type="button" onClick={() => append({ sku: '', price: 0, stock: 0 })} className="btn-secondary py-1.5 px-3 text-xs" suppressHydrationWarning>
                <Plus size={14} /> Add Variant
              </button>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="p-5 rounded-xl border border-white/10 bg-white/5 relative group transition-colors hover:bg-white/10">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                      <label className="text-xs text-white/60 mb-1.5 flex justify-between items-center">
                        <span>SKU</span>
                        <button type="button" onClick={() => generateSKU(index)} className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1" suppressHydrationWarning>
                          <Zap size={10} /> Auto-Gen
                        </button>
                      </label>
                      <input {...register(`variants.${index}.sku`)} className="input text-sm" placeholder="SKU-123" suppressHydrationWarning />
                      {errors.variants?.[index]?.sku && <p className="text-xs text-red-400 mt-1">{errors.variants[index]?.sku?.message}</p>}
                    </div>
                    <div>
                      <label className="text-xs text-white/60 mb-1.5 block">Price (₹)</label>
                      <input type="number" {...register(`variants.${index}.price`, { valueAsNumber: true })} className="input text-sm" placeholder="0" suppressHydrationWarning />
                      {errors.variants?.[index]?.price && <p className="text-xs text-red-400 mt-1">{errors.variants[index]?.price?.message}</p>}
                    </div>
                    <div>
                      <label className="text-xs text-white/60 mb-1.5 block">MRP (₹)</label>
                      <input type="number" step="0.01" {...register(`variants.${index}.comparePrice`, { setValueAs: (v) => (v === '' ? undefined : Number(v)) })} className="input text-sm" placeholder="MRP (optional)" suppressHydrationWarning />
                      {errors.variants?.[index]?.comparePrice && <p className="text-xs text-red-400 mt-1">{errors.variants[index]?.comparePrice?.message}</p>}
                    </div>
                    <div>
                      <label className="text-xs text-white/60 mb-1.5 block">Stock</label>
                      <input type="number" {...register(`variants.${index}.stock`, { valueAsNumber: true })} className="input text-sm" placeholder="0" suppressHydrationWarning />
                      {errors.variants?.[index]?.stock && <p className="text-xs text-red-400 mt-1">{errors.variants[index]?.stock?.message}</p>}
                    </div>
                  </div>
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(index)} className="absolute -top-3 -right-3 p-1.5 rounded-full bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white" suppressHydrationWarning>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {errors.variants?.root && <p className="text-xs text-red-400">{errors.variants.root.message}</p>}
            </div>
          </div>
        </div>

        {/* ── Right: sidebar ── */}
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6 border border-white/5 space-y-4">
            <h2 className="font-syne font-semibold text-white">Organization</h2>

            {/* Premium Category Picker */}
            <CategoryPicker
              categories={categories}
              value={selectedCategory}
              subValue={selectedSubCategory}
              onSelect={id => setValue('category', id, { shouldValidate: true })}
              onSubSelect={id => setValue('subCategory', id)}
              error={errors.category?.message}
            />

            <div>
              <label className="text-xs text-white/60 mb-1.5 block">Brand</label>
              <input {...register('brand')} className="input" placeholder="Brand name" suppressHydrationWarning />
            </div>

            <div className="pt-4 border-t border-white/5 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                  <input type="checkbox" {...register('isPublished')} className="peer sr-only" />
                  <div className="w-10 h-5 bg-white/10 rounded-full peer-checked:bg-acid-400/20 transition-colors" />
                  <div className="absolute left-1 top-1 w-3 h-3 bg-white/50 rounded-full peer-checked:translate-x-5 peer-checked:bg-acid-400 transition-transform" />
                </div>
                <span className="text-sm text-white/70 group-hover:text-white transition-colors">Publish Product</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                  <input type="checkbox" {...register('isFeatured')} className="peer sr-only" />
                  <div className="w-10 h-5 bg-white/10 rounded-full peer-checked:bg-violet-500/20 transition-colors" />
                  <div className="absolute left-1 top-1 w-3 h-3 bg-white/50 rounded-full peer-checked:translate-x-5 peer-checked:bg-violet-400 transition-transform" />
                </div>
                <span className="text-sm text-white/70 group-hover:text-white transition-colors">Featured Product</span>
              </label>
            </div>
          </div>

          {/* Media */}
          <div className="glass rounded-2xl p-6 border border-white/5 space-y-4">
            <h2 className="font-syne font-semibold text-white">Media</h2>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${isDragging ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 hover:bg-white/5'}`}
            >
              <input type="file" multiple accept="image/*" className="hidden" id="images"
                onChange={(e) => { if (e.target.files) setImages(prev => [...prev, ...Array.from(e.target.files!)]); }}
              />
              <label htmlFor="images" className="cursor-pointer flex flex-col items-center">
                <Upload size={24} className={`${isDragging ? 'text-violet-400' : 'text-white/40'} mb-2 transition-colors`} />
                <span className="text-sm text-white/60">Drag & drop or <span className="text-violet-400">click to upload</span></span>
                <span className="text-xs text-white/40 mt-1">PNG, JPG up to 5MB</span>
              </label>
            </div>

            {(images.length > 0 || existingImages.length > 0) && (
              <div className="grid grid-cols-3 gap-2 mt-4">
                {existingImages.map((url, i) => (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} key={i} className="relative aspect-square rounded-lg overflow-hidden bg-white/5 border border-white/10 group">
                    <Image src={url} alt="" fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <button type="button" onClick={() => setExistingImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 p-1 bg-black/50 rounded-md text-white/70 hover:text-white hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100" suppressHydrationWarning>
                      <X size={12} />
                    </button>
                  </motion.div>
                ))}
                {images.map((img, i) => (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} key={i} className="relative aspect-square rounded-lg overflow-hidden bg-white/5 border border-white/10 group">
                    <Image src={URL.createObjectURL(img)} alt="" fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <button type="button" onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 p-1 bg-black/50 rounded-md text-white/70 hover:text-white hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100" suppressHydrationWarning>
                      <X size={12} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-6 border-t border-white/5">
        <button type="button" onClick={() => router.back()} className="btn-secondary" suppressHydrationWarning>Cancel</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary" suppressHydrationWarning>
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : (productId ? 'Update Product' : 'Save Product')}
        </button>
      </div>
    </form>
  );
}
