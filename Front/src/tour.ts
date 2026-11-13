import type { Artifact } from './catalog';

export type PlanetId = 'earth' | 'moon' | 'mars';
export type World = 'moon' | 'mars';
export type ArtifactId = Artifact['id'];

export const tourConfig = {
  autoTransition: import.meta.env.VITE_AUTO_TRANSITION !== 'false',
  autoAdvanceChapters: false, // User-controlled pacing by default
  chaptersPerArtifact: 5,
  worlds: {
    moon: ['eagle', 'surveyor3', 'apollo15-lrv'],
    mars: ['sojourner', 'spirit', 'opportunity'],
  },
} as const;

/** Selected artifact first, remaining home-world canon, then other-world canon. */
export function buildTour(world: World, selected: ArtifactId): ArtifactId[] {
  const current = [...tourConfig.worlds[world]] as ArtifactId[];
  const otherWorld: World = world === 'moon' ? 'mars' : 'moon';
  if (!current.includes(selected)) {
    throw new Error(`${selected} is not a ${world} artifact`);
  }
  return [selected, ...current.filter(id => id !== selected), ...tourConfig.worlds[otherWorld]];
}

export function validateTour(ids: ArtifactId[]): boolean {
  const all: readonly string[] = [...tourConfig.worlds.moon, ...tourConfig.worlds.mars];
  return ids.length === 6 && new Set(ids).size === 6 && ids.every(id => all.includes(id));
}
