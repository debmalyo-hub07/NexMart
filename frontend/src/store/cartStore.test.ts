import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem } from '@/types';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api', () => ({ default: api, getApiError: () => 'The cart request could not be confirmed.' }));
const item = { _id: 'line', quantity: 1, price: 100, variant: 'sku', product: null } as CartItem;
const payload = (items: CartItem[]) => ({ data: { data: { items } } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
});

describe('cart mutation consistency', () => {
  it('serializes a quantity change and removal so an older response cannot restore the item', async () => {
    const { useCartStore: store } = await import('./cartStore');
    store.setState({ items: [item], owner: 'guest', ready: true });
    const change = deferred<ReturnType<typeof payload>>();
    api.put.mockReturnValue(change.promise); api.delete.mockResolvedValue(payload([]));
    const updating = store.getState().updateItem('line', 2);
    const removing = store.getState().removeItem('line');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(api.delete).not.toHaveBeenCalled();
    change.resolve(payload([{ ...item, quantity: 2 }]));
    await Promise.all([updating, removing]);
    expect(store.getState().items).toEqual([]);
    expect(store.getState().isLoading).toBe(false);
  });
  it('shows the server’s committed cart after a mutation response is lost', async () => {
    const { useCartStore: store } = await import('./cartStore');
    store.setState({ items: [item], owner: 'guest', ready: true });
    api.put.mockRejectedValue(new Error('response lost'));
    api.get.mockResolvedValue(payload([{ ...item, quantity: 3 }]));
    await store.getState().updateItem('line', 3);
    expect(store.getState().items[0].quantity).toBe(3);
    expect(store.getState().error).toBeTruthy();
  });
  it('discards a former account’s response after logout', async () => {
    const { useCartStore: store } = await import('./cartStore');
    store.setState({ owner: 'customer:first', ready: true });
    const change = deferred<ReturnType<typeof payload>>(); api.post.mockReturnValue(change.promise);
    const adding = store.getState().addItem('product', 'sku');
    await new Promise(resolve => setTimeout(resolve, 0));
    store.getState().reset();
    change.resolve(payload([item])); await expect(adding).rejects.toThrow('cart session changed');
    expect(store.getState().items).toEqual([]);
    expect(store.getState().isOpen).toBe(false);
  });
  it('rejects a quiet planner add when the response is lost, even after cart reconciliation', async () => {
    const { useCartStore: store } = await import('./cartStore');
    store.setState({ owner: 'guest', ready: true });
    api.post.mockRejectedValue(new Error('response lost'));
    api.get.mockResolvedValue(payload([item]));
    await expect(store.getState().addItem('product', 'sku', 1, undefined, false)).rejects.toThrow('response lost');
    expect(store.getState().items).toEqual([item]);
    expect(store.getState().isOpen).toBe(false);
  });

  it('rejects a queued add that was skipped by an account change', async () => {
    const { useCartStore: store } = await import('./cartStore');
    const loading = deferred<ReturnType<typeof payload>>();
    api.get.mockReturnValue(loading.promise);
    const fetching = store.getState().fetchCart();
    await new Promise(resolve => setTimeout(resolve, 0));
    const adding = store.getState().addItem('product', 'sku', 1, undefined, false);
    store.getState().reset();
    loading.resolve(payload([]));
    await fetching;
    await expect(adding).rejects.toThrow('cart session changed');
    expect(api.post).not.toHaveBeenCalled();
  });
});
