/**
 * Generation Studio store facade.
 *
 * Layer/trait editing is plain UI state; generation, export and trait
 * replacement delegate to feature actions in `features/<domain>/*`.
 */
import { exportNfts } from "@/features/events/export-nfts/action";
import { generateNfts } from "@/features/events/generate-nfts/action";
import { renameNft } from "@/features/events/rename-nft/action";
import { replaceNftTrait } from "@/features/events/replace-nft-trait/action";
import type {
  GeneratorContext,
  GeneratorPatch,
  GeneratorSnapshot,
  StudioStep,
} from "@/features/types/generation";
import { createSampleProject } from "@/features/lib/generator/sample";
import type { GeneratorLayer, GeneratorTrait } from "@/features/lib/generator/types";
import type { GeneratorSettings } from "@/features/lib/generator/types";
import {
  artworkRegistry,
  emptyGeneratorData,
  useGeneratorData,
  type GeneratorData,
} from "@/features/lib/data/generator-data";
import { newId } from "@/features/mocks/data/activity/model";

const reorder = (layers: GeneratorLayer[]): GeneratorLayer[] =>
  [...layers].sort((a, b) => a.order - b.order).map((layer, index) => ({ ...layer, order: index }));

const patch = (partial: Partial<GeneratorData>) => useGeneratorData.getState().patch(partial);
const update = (updater: (state: GeneratorData) => Partial<GeneratorData>) =>
  useGeneratorData.getState().update(updater);

const ctx: GeneratorContext = {
  get: (): GeneratorSnapshot => {
    const { settings, layers, result } = useGeneratorData.getState();
    return { settings, layers, result };
  },
  set: (next: GeneratorPatch) => patch(next),
  artwork: artworkRegistry,
};

const actions = {
  setStep: (step: StudioStep) => patch({ step }),
  setActiveLayer: (activeLayerId: string) => patch({ activeLayerId }),

  updateSettings: (settingsPatch: Partial<GeneratorSettings>) =>
    update((state) => ({ settings: { ...state.settings, ...settingsPatch } })),

  addLayer: (name: string) =>
    update((state) => {
      const id = newId("layer");
      return {
        activeLayerId: id,
        layers: reorder([
          ...state.layers,
          {
            id,
            name: name.trim() || `Layer ${state.layers.length + 1}`,
            enabled: true,
            order: state.layers.length,
            traits: [],
          },
        ]),
      };
    }),

  renameLayer: (layerId: string, name: string) =>
    update((state) => ({
      layers: state.layers.map((l) => (l.id === layerId ? { ...l, name } : l)),
    })),

  removeLayer: (layerId: string) =>
    update((state) => {
      const layers = reorder(state.layers.filter((l) => l.id !== layerId));
      return {
        layers,
        activeLayerId:
          state.activeLayerId === layerId
            ? (layers[layers.length - 1]?.id ?? null)
            : state.activeLayerId,
      };
    }),

  toggleLayer: (layerId: string, enabled: boolean) =>
    update((state) => ({
      layers: state.layers.map((l) => (l.id === layerId ? { ...l, enabled } : l)),
    })),

  moveLayer: (layerId: string, direction: -1 | 1) =>
    update((state) => {
      const sorted = reorder(state.layers);
      const index = sorted.findIndex((l) => l.id === layerId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= sorted.length) return { layers: sorted };
      const next = [...sorted];
      const a = next[index]!;
      const b = next[target]!;
      next[index] = { ...b, order: index };
      next[target] = { ...a, order: target };
      return { layers: next };
    }),

  addTraits: (layerId: string, traits: { filename: string; name: string; src: string }[]) =>
    update((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              traits: [
                ...layer.traits,
                ...traits.map((trait) => ({
                  id: newId("trait"),
                  layerId,
                  filename: trait.filename,
                  name: trait.name,
                  weight: 50,
                  enabled: true,
                  src: trait.src,
                })),
              ],
            }
          : layer,
      ),
    })),

  updateTrait: (layerId: string, traitId: string, traitPatch: Partial<GeneratorTrait>) =>
    update((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              traits: layer.traits.map((t) => (t.id === traitId ? { ...t, ...traitPatch } : t)),
            }
          : layer,
      ),
    })),

  removeTrait: (layerId: string, traitId: string) =>
    update((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === layerId
          ? { ...layer, traits: layer.traits.filter((t) => t.id !== traitId) }
          : layer,
      ),
    })),

  loadSample: () => {
    const fresh = createSampleProject();
    artworkRegistry.release();
    patch({
      ...emptyGeneratorData(),
      settings: { ...fresh.settings },
      layers: fresh.layers,
      activeLayerId: fresh.layers[fresh.layers.length - 1]?.id ?? null,
    });
  },

  reset: () => {
    artworkRegistry.release();
    patch(emptyGeneratorData());
  },

  generate: () => generateNfts(ctx),
  buildExport: () => exportNfts(ctx),

  selectNft: (tokenId: number | null) => patch({ selectedTokenId: tokenId, editLayerId: null }),
  setEditLayer: (editLayerId: string | null) => patch({ editLayerId }),

  renameNft: (tokenId: number, name: string) => renameNft({ tokenId, name }, ctx),

  replaceNftTrait: (tokenId: number, layerId: string, traitId: string) =>
    replaceNftTrait({ tokenId, layerId, traitId }, ctx),

  toggleFilter: (layerId: string, traitId: string) =>
    update((state) => {
      const current = state.filters[layerId] ?? [];
      const next = current.includes(traitId)
        ? current.filter((id) => id !== traitId)
        : [...current, traitId];
      const filters = { ...state.filters };
      if (next.length === 0) delete filters[layerId];
      else filters[layerId] = next;
      return { filters };
    }),

  clearFilters: () => patch({ filters: {} }),
} as const;

export type GeneratorStoreView = GeneratorData & typeof actions;

export function useGeneratorStore(): GeneratorStoreView;
export function useGeneratorStore<T>(selector: (state: GeneratorStoreView) => T): T;
export function useGeneratorStore<T>(selector?: (state: GeneratorStoreView) => T) {
  const state = useGeneratorData();
  const merged = { ...state, ...actions } as GeneratorStoreView;
  return selector ? selector(merged) : merged;
}

useGeneratorStore.getState = (): GeneratorStoreView => ({
  ...useGeneratorData.getState(),
  ...actions,
});
