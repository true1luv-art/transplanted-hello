/**
 * Canvas composition — browser only.
 *
 * Layers are drawn bottom-up in `order`, then encoded as PNG. The PNG bytes
 * feed the ZIP export; the object URL feeds the preview grid.
 */
import { activeLayers } from "./engine";
import type { GeneratedNFT, GeneratorLayer } from "./types";

const imageCache = new Map<string, HTMLImageElement>();

async function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Could not load trait image: ${src}`));
    el.src = src;
  });
  imageCache.set(src, image);
  return image;
}

export interface ComposedImage {
  bytes: Uint8Array;
  url: string;
  /** Downscaled object URL used by the collection grid. */
  thumbnailUrl: string;
}

export interface ComposeSize {
  width: number;
  height: number;
}

/** Grid thumbnails are capped at this edge length so 100 items stay cheap. */
export const THUMBNAIL_EDGE = 256;

const normalizeSize = (size: number | ComposeSize): ComposeSize =>
  typeof size === "number" ? { width: size, height: size } : size;

async function drawStack(sources: string[], size: ComposeSize): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(size.width));
  canvas.height = Math.max(1, Math.floor(size.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const src of sources) {
    if (!src) continue;
    const image = await loadImage(src);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode PNG"))),
      "image/png",
    ),
  );

/** Stacks arbitrary trait sources bottom-up into one PNG plus a thumbnail. */
export async function composeSources(
  sources: string[],
  size: number | ComposeSize,
): Promise<ComposedImage> {
  const full = await drawStack(sources, normalizeSize(size));
  const blob = await toBlob(full);

  const scale = Math.min(1, THUMBNAIL_EDGE / Math.max(full.width, full.height));
  let thumbnailUrl: string;
  if (scale >= 1) {
    thumbnailUrl = URL.createObjectURL(blob);
  } else {
    const thumb = document.createElement("canvas");
    thumb.width = Math.max(1, Math.round(full.width * scale));
    thumb.height = Math.max(1, Math.round(full.height * scale));
    const ctx = thumb.getContext("2d");
    if (ctx) ctx.drawImage(full, 0, 0, thumb.width, thumb.height);
    thumbnailUrl = URL.createObjectURL(await toBlob(thumb));
  }

  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    url: URL.createObjectURL(blob),
    thumbnailUrl,
  };
}

/** Trait image sources for one NFT, in layer order (bottom first). */
export function sourcesFor(nft: GeneratedNFT, layers: GeneratorLayer[]): string[] {
  const byLayer = new Map(activeLayers(layers).map((layer) => [layer.id, layer]));
  const sources: string[] = [];
  for (const ref of nft.traits) {
    const trait = byLayer
      .get(ref.layerId)
      ?.traits.find((candidate) => candidate.id === ref.traitId);
    if (trait?.src) sources.push(trait.src);
  }
  return sources;
}

/** Draws one NFT and returns its PNG bytes plus preview object URLs. */
export async function composeNFT(
  nft: GeneratedNFT,
  layers: GeneratorLayer[],
  size: number | ComposeSize,
): Promise<ComposedImage> {
  return composeSources(sourcesFor(nft, layers), size);
}

/** Composes every NFT sequentially, reporting progress and yielding to the UI. */
export async function composeAll(
  nfts: GeneratedNFT[],
  layers: GeneratorLayer[],
  size: number | ComposeSize,
  onProgress?: (done: number, total: number) => void,
): Promise<Map<number, ComposedImage>> {
  const images = new Map<number, ComposedImage>();
  let done = 0;
  for (const nft of nfts) {
    images.set(nft.tokenId, await composeNFT(nft, layers, size));
    done += 1;
    onProgress?.(done, nfts.length);
    // Yield so the progress UI can paint.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return images;
}
