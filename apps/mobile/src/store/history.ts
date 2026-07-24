import { create } from 'zustand';
import type { Generation } from '@/lib/history';

/**
 * Client cache of the persistent generation history (from public.generations).
 * The History list fills it via setAll on fetch; the detail screen reads a row
 * by id from here (cold-fetching + upserting only if it was opened directly).
 * Reset on logout so one user's history can't leak to the next on the device.
 */
type HistoryState = {
  items: Record<string, Generation>;
  setAll: (list: Generation[]) => void;
  upsert: (gen: Generation) => void;
  reset: () => void;
};

export const useHistoryStore = create<HistoryState>((set) => ({
  items: {},
  setAll: (list) =>
    set({ items: Object.fromEntries(list.map((g) => [g.id, g] as const)) }),
  upsert: (gen) => set((s) => ({ items: { ...s.items, [gen.id]: gen } })),
  reset: () => set({ items: {} }),
}));
