import { create } from 'zustand';

/**
 * The pending capture handed from the Create screen to the style-picker screen.
 * We pass it through a tiny store rather than router params so the local image
 * file URI (and optional text) don't have to be URL-encoded through navigation.
 */
type Draft = {
  imageUri: string;
  prompt: string;
  /** Night mode: relight the result to night-time. */
  night: boolean;
};

type DraftState = {
  draft: Draft | null;
  setDraft: (draft: Draft) => void;
  clearDraft: () => void;
};

export const useDraftStore = create<DraftState>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  clearDraft: () => set({ draft: null }),
}));
