/** Deterministic PRNG so SSR and client generate identical mock data. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const HUES = [205, 160, 25, 45, 285, 320];

/**
 * Generates a deterministic SVG artwork data-URI. No external image APIs.
 */
export function generateArtwork(seedKey: string): string {
  const rand = mulberry32(hashString(seedKey));
  const baseHue = HUES[hashString(seedKey) % HUES.length] ?? 205;
  const h1 = (baseHue + Math.floor(rand() * 40) - 20 + 360) % 360;
  const h2 = (h1 + 40 + Math.floor(rand() * 90)) % 360;
  const rot = Math.floor(rand() * 360);
  const shapes: string[] = [];
  const count = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < count; i++) {
    const cx = Math.floor(rand() * 400);
    const cy = Math.floor(rand() * 400);
    const r = 40 + Math.floor(rand() * 150);
    const op = (0.08 + rand() * 0.22).toFixed(2);
    const hue = rand() > 0.5 ? h1 : h2;
    if (rand() > 0.45) {
      shapes.push(
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="hsl(${hue} 85% 65%)" opacity="${op}"/>`,
      );
    } else {
      shapes.push(
        `<rect x="${cx - r / 2}" y="${cy - r / 2}" width="${r}" height="${r}" rx="${Math.floor(r / 5)}" fill="hsl(${hue} 80% 60%)" opacity="${op}" transform="rotate(${Math.floor(rand() * 90)} ${cx} ${cy})"/>`,
      );
    }
  }
  const gx = Math.floor(rand() * 200);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
<defs>
<linearGradient id="g" gradientTransform="rotate(${rot} 0.5 0.5)">
<stop offset="0%" stop-color="hsl(${h1} 70% 18%)"/>
<stop offset="55%" stop-color="hsl(${h2} 65% 26%)"/>
<stop offset="100%" stop-color="hsl(${(h2 + 30) % 360} 60% 12%)"/>
</linearGradient>
<radialGradient id="r" cx="${30 + gx / 10}%" cy="30%">
<stop offset="0%" stop-color="hsl(${h1} 95% 70%)" stop-opacity="0.45"/>
<stop offset="100%" stop-color="hsl(${h1} 95% 70%)" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="400" height="400" fill="url(#g)"/>
${shapes.join("")}
<rect width="400" height="400" fill="url(#r)"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function mockTxId(rand: () => number = Math.random): string {
  const chars = "0123456789ABCDEF";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(rand() * chars.length)];
  return `MOCK-HIVE-${out}`;
}
