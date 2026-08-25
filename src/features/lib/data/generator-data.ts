/**
 * Generation Studio data implementation — deliberately NOT persisted: it holds
 * object URLs and PNG bytes that must never be written to localStorage.
 */
import { create } from "zustand";

import {
  IDLE_PROGRESS,
  type ArtworkRegistry,
  type GeneratorProgress,
  type StudioStep,
} from "@/features/types/generation";
import type { ExportPackage } from "@/features/lib/generator/export";
import type {
  GenerationResult,
  GeneratorLayer,
  GeneratorSettings,
} from "@/features/lib/generator/types";

export interface GeneratorData {
  settings: GeneratorSettings;
  layers: GeneratorLayer[];
  activeLayerId: string | null;
  step: StudioStep;
  result: GenerationResult | null;
  exportPackage: ExportPackage | null;
  progress: GeneratorProgress;
  error: string | null;
  /** tokenId of the NFT open in Item details. */
  selectedTokenId: number | null;
  /** Layer whose traits are offered in the replacement panel. */
  editLayerId: string | null;
  /** layerId -> selected traitIds. Empty = no filter for that layer. */
  filters: Record<string, string[]>;
}

export interface GeneratorDataStore extends GeneratorData {
  patch: (partial: Partial<GeneratorData>) => void;
  update: (updater: (state: GeneratorData) => Partial<GeneratorData>) => void;
}

export const emptySettings = (): GeneratorSettings => ({
  name: "",
  description: "",
  itemPrefix: "",
  supply: 10,
  width: 512,
  height: 512,
});

export const emptyGeneratorData = (): GeneratorData => ({
  settings: emptySettings(),
  layers: [],
  activeLayerId: null,
  step: "generate",
  result: null,
  exportPackage: null,
  progress: IDLE_PROGRESS,
  error: null,
  selectedTokenId: null,
  editLayerId: null,
  filters: {},
});

export const useGeneratorData = create<GeneratorDataStore>()((set) => ({
  ...emptyGeneratorData(),
  patch: (partial) => set(partial),
  update: (updater) => set((state) => updater(state)),
}));

/** Composited PNG bytes and object URLs, kept outside React state. */
let objectUrls: string[] = [];

export const artworkRegistry: ArtworkRegistry = {
  images: new Map<number, Uint8Array>(),
  track: (...urls) => {
    for (const url of urls) if (url?.startsWith("blob:")) objectUrls.push(url);
  },
  release: () => {
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls = [];
    artworkRegistry.images.clear();
  },
};
