/**
 * A small demo project so the studio is never an empty screen.
 * Assets are inline SVG data URIs generated here — no binaries shipped.
 */
import type { GeneratorLayer, GeneratorProject } from "./types";

const svg = (body: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100">${body}</svg>`,
  )}`;

interface SampleTrait {
  name: string;
  weight: number;
  body: string;
}

const layerSpecs: { name: string; traits: SampleTrait[] }[] = [
  {
    name: "Background",
    traits: [
      { name: "Ash", weight: 50, body: `<rect width="100" height="100" fill="#1b1b22"/>` },
      { name: "Ember", weight: 30, body: `<rect width="100" height="100" fill="#3b1608"/>` },
      { name: "Solar", weight: 20, body: `<rect width="100" height="100" fill="#f7a13b"/>` },
    ],
  },
  {
    name: "Body",
    traits: [
      { name: "Iron", weight: 60, body: `<circle cx="50" cy="58" r="28" fill="#8d8f9a"/>` },
      { name: "Copper", weight: 30, body: `<circle cx="50" cy="58" r="28" fill="#c4703a"/>` },
      { name: "Molten", weight: 10, body: `<circle cx="50" cy="58" r="28" fill="#ff4d21"/>` },
    ],
  },
  {
    name: "Eyes",
    traits: [
      {
        name: "Calm",
        weight: 70,
        body: `<g fill="#0b0b0f"><circle cx="42" cy="52" r="4"/><circle cx="58" cy="52" r="4"/></g>`,
      },
      {
        name: "Blaze",
        weight: 25,
        body: `<g fill="#ffd166"><circle cx="42" cy="52" r="5"/><circle cx="58" cy="52" r="5"/></g>`,
      },
      {
        name: "Void",
        weight: 5,
        body: `<g fill="#7c3aed"><circle cx="42" cy="52" r="6"/><circle cx="58" cy="52" r="6"/></g>`,
      },
    ],
  },
  {
    name: "Crest",
    traits: [
      { name: "None", weight: 55, body: `<g/>` },
      { name: "Spike", weight: 35, body: `<polygon points="50,16 58,34 42,34" fill="#e2e8f0"/>` },
      {
        name: "Halo",
        weight: 10,
        body: `<ellipse cx="50" cy="22" rx="18" ry="5" fill="none" stroke="#ffd166" stroke-width="3"/>`,
      },
    ],
  },
];

export function createSampleLayers(): GeneratorLayer[] {
  return layerSpecs.map((spec, order) => {
    const layerId = `layer-${spec.name.toLowerCase()}`;
    return {
      id: layerId,
      name: spec.name,
      enabled: true,
      order,
      traits: spec.traits.map((trait) => ({
        id: `${layerId}-${trait.name.toLowerCase()}`,
        layerId,
        filename: `${trait.name.toLowerCase()}.svg`,
        name: trait.name,
        weight: trait.weight,
        enabled: true,
        src: svg(trait.body),
      })),
    };
  });
}

export function createSampleProject(): GeneratorProject {
  return {
    settings: {
      name: "Ember Sentinels",
      description: "Forged guardians of the hive, generated layer by layer.",
      itemPrefix: "Ember Sentinel",
      supply: 25,
      width: 512,
      height: 512,
    },
    layers: createSampleLayers(),
  };
}
