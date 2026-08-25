import type { ExportPackage } from "@/features/lib/generator/export";
import type {
  GenerationResult,
  GeneratorLayer,
  GeneratorSettings,
} from "@/features/lib/generator/types";

export type GeneratorPhase = "idle" | "generating" | "composing" | "packaging" | "ready";
export type StudioStep = "generate" | "preview" | "export";

export interface GeneratorProgress {
  phase: GeneratorPhase;
  done: number;
  total: number;
  label: string;
}

export const IDLE_PROGRESS: GeneratorProgress = { phase: "idle", done: 0, total: 0, label: "" };

/** The slice of studio state generation actions may read. */
export interface GeneratorSnapshot {
  settings: GeneratorSettings;
  layers: GeneratorLayer[];
  result: GenerationResult | null;
}

/** What generation actions may write back. */
export interface GeneratorPatch {
  result?: GenerationResult | null;
  exportPackage?: ExportPackage | null;
  progress?: GeneratorProgress;
  error?: string | null;
  step?: StudioStep;
  selectedTokenId?: number | null;
  editLayerId?: string | null;
  filters?: Record<string, string[]>;
}

/** Composited PNG bytes + object URLs, kept outside React state. */
export interface ArtworkRegistry {
  images: Map<number, Uint8Array>;
  track: (...urls: (string | undefined)[]) => void;
  release: () => void;
}

/** Ports every generation action runs against — trivially fakeable in tests. */
export interface GeneratorContext {
  get: () => GeneratorSnapshot;
  set: (patch: GeneratorPatch) => void;
  artwork: ArtworkRegistry;
}

export interface ReplaceNftTraitInput {
  tokenId: number;
  layerId: string;
  traitId: string;
}

export interface RenameNftInput {
  tokenId: number;
  name: string;
}
