import type { World } from './tour';

export type ArtifactSpecs = {
  coordinates: string;
  siteName: string;
  mass: string;
  duration: string;
  hardwareStatus: string;
};

export type ArchiveImage = {
  src: string;
  alt: string;
  caption: string;
};

export type Artifact = {
  id: string;
  name: string;
  mission: string;
  year: string;
  planet: World;
  model?: string;
  environment?: string;
  fitSize?: number;
  modelNote?: string;
  gallery?: ArchiveImage[];
  tag: string;
  summary: string;
  specs: ArtifactSpecs;
  chapters: { title: string; text: string }[];
};

const ch = (a: string, b: string, c: string, d: string, e: string) =>
  ['The Mission', 'The Machine', 'The Journey', 'The Discoveries', 'What Remains'].map((title, i) => ({
    title,
    text: [a, b, c, d, e][i],
  }));

export const artifacts: Artifact[] = [
  {
    id: 'eagle',
    name: 'Eagle',
    mission: 'Apollo 11',
    year: '1969',
    planet: 'moon',
    model: '/Models/Moon-missions-models/Apollo11/apollo_11_lunar_module.glb',
    environment: '/Models/Moon-missions-models/Apollo11/apollo_11_lunar_landing_site.glb',
    fitSize: 2.9,
    modelNote:
      'Full Lunar Module model shown for context; the ascent stage returned to orbit and the descent stage remained on the Moon.',
    tag: 'LUNAR MODULE · DESCENT STAGE',
    summary: 'The first human landing on another world.',
    specs: {
      coordinates: '0.67408° N, 23.47297° E',
      siteName: 'Statio Tranquillitatis (Sea of Tranquility)',
      mass: '15,103 kg (Total) · 2,150 kg (Descent Stage on Surface)',
      duration: '21h 36m Surface Stay',
      hardwareStatus: 'Permanent Historic Lunar Monument',
    },
    chapters: ch(
      'On July 20, 1969, Apollo 11’s Lunar Module carried two astronauts from lunar orbit to the surface.',
      'Eagle brought Neil Armstrong and Buzz Aldrin to the Sea of Tranquility while Michael Collins remained in lunar orbit.',
      'Its descent stage supported the landing and served as the launch platform for the ascent stage.',
      'The ascent stage carried the astronauts back to orbit. The descent stage remained on the Moon.',
      'The abandoned descent stage marks the place where humanity first walked on another world.'
    ),
  },
  {
    id: 'surveyor3',
    name: 'Surveyor 3',
    mission: 'Surveyor 3',
    year: '1967',
    planet: 'moon',
    modelNote: 'Three archival views document the lander, its lunar site, and its later visit by Apollo 12.',
    gallery: [
      {
        src: '/images/surveyor3/surveyor3-1-9de24081.webp',
        alt: 'Surveyor 3 standing on the lunar surface.',
        caption: 'Surveyor 3 at its Oceanus Procellarum landing site',
      },
      {
        src: '/images/surveyor3/surveyor3-2-b7be4d6f.webp',
        alt: 'Archival view of the Surveyor 3 spacecraft against a dark background.',
        caption: 'Surveyor 3 spacecraft and landing gear',
      },
      {
        src: '/images/surveyor3/surveyor3-3-b168e3d0.webp',
        alt: 'An Apollo astronaut standing beside Surveyor 3 on the Moon.',
        caption: 'Apollo 12 astronaut beside Surveyor 3',
      },
    ],
    tag: 'ROBOTIC LUNAR LANDER',
    summary: 'A robotic visitor later examined by Apollo 12.',
    specs: {
      coordinates: '3.015° S, 23.418° W',
      siteName: 'Oceanus Procellarum (Ocean of Storms)',
      mass: '302 kg (On Lunar Surface)',
      duration: '32.5 Earth Days Active Operation',
      hardwareStatus: 'Visited by Apollo 12 · Remains on Moon',
    },
    chapters: ch(
      'Surveyor 3 made a soft landing on the Moon on April 20, 1967.',
      'The uncrewed spacecraft tested lunar soil and photographed its surroundings.',
      'Its surface sampler dug trenches and helped investigate the properties of the lunar ground.',
      'Apollo 12 astronauts visited Surveyor 3 in 1969 and collected selected components.',
      'Some returned hardware became a rare artifact carried from one world back to Earth.'
    ),
  },
  {
    id: 'apollo15-lrv',
    name: 'Lunar Roving Vehicle',
    mission: 'Apollo 15',
    year: '1971',
    planet: 'moon',
    model: '/Models/Moon-missions-models/Apollo15/mondfahrzeug_lunar_rover.glb',
    fitSize: 2.1,
    tag: 'LUNAR ROVER',
    summary: 'The first car driven on the Moon.',
    specs: {
      coordinates: '26.132° N, 3.633° E',
      siteName: 'Hadley-Apennine Region',
      mass: '210 kg (Earth) · 35 kg (Lunar Weight)',
      duration: '67h Exploration · 27.8 km Traversed',
      hardwareStatus: 'Parked at Hadley Rille Final Staging Site',
    },
    chapters: ch(
      'Apollo 15 brought a battery-powered rover to the lunar surface in 1971.',
      'The Lunar Roving Vehicle expanded the astronauts’ range during the first mission focused on extended lunar surface exploration.',
      'Astronauts drove across the Hadley–Apennine region, carrying tools and samples.',
      'At mission’s end, the rover was parked on the Moon.',
      'Its tracks remain alongside a machine that made the lunar landscape newly traversable.'
    ),
  },
  {
    id: 'sojourner',
    name: 'Sojourner',
    mission: 'Mars Pathfinder',
    year: '1997',
    planet: 'mars',
    model: '/Models/Mars-missions-models/pathfinder-mission/mars_sojourner_rover_model.glb',
    fitSize: 2.0,
    tag: 'MARS PATHFINDER ROVER',
    summary: 'A small rover that changed how we explore Mars.',
    specs: {
      coordinates: '19.33° N, 33.55° W',
      siteName: 'Ares Vallis (Carl Sagan Memorial Station)',
      mass: '11.5 kg (Earth) · 4.35 kg (Mars Weight)',
      duration: '83 Sols (85 Earth Days)',
      hardwareStatus: 'Stationary beside Pathfinder Base Station',
    },
    chapters: ch(
      'In 1997, a small rover rolled onto Mars from the Pathfinder lander.',
      'Sojourner was a technology demonstration for mobile robotic exploration on another planet.',
      'It examined nearby rocks and soil, sending images and measurements to Earth through Pathfinder.',
      'The mission ended after contact with the lander was lost in September 1997.',
      'Sojourner showed that a rover could explore beyond its landing site.'
    ),
  },
  {
    id: 'spirit',
    name: 'Spirit',
    mission: 'Mars Exploration Rover',
    year: '2004',
    planet: 'mars',
    model: '/Models/Mars-missions-models/Spirit & Opportunity-missions/24883_MER_static.glb',
    environment: '/Models/Mars-missions-models/Spirit & Opportunity-missions/Mars - Spirit Landing Site.glb',
    fitSize: 2.4,
    modelNote: 'Shared MER model asset; supplied file does not identify this specific rover as Spirit or Opportunity.',
    tag: 'MARS EXPLORATION ROVER',
    summary: 'A rover that found evidence of ancient water.',
    specs: {
      coordinates: '14.5684° S, 175.4726° E',
      siteName: 'Gusev Crater (Home Plate Plateau)',
      mass: '185 kg (Earth) · 70 kg (Mars Weight)',
      duration: '2,208 Sols (6+ Earth Years) · 7.73 km Traversed',
      hardwareStatus: 'Resting on Low Ridge of Home Plate',
    },
    chapters: ch(
      'Spirit landed in Gusev Crater on January 4, 2004.',
      'The Mars Exploration Rover mission searched for evidence of past water on Mars.',
      'Spirit studied rocks and soil, finding evidence of water-related alteration.',
      'Spirit’s last communication came on March 22, 2010. NASA ended recovery efforts on May 25, 2011.',
      'The rover remains on Mars, a record of years of discovery across a distant landscape.'
    ),
  },
  {
    id: 'opportunity',
    name: 'Opportunity',
    mission: 'Mars Exploration Rover',
    year: '2004',
    planet: 'mars',
    model: '/Models/Mars-missions-models/Spirit & Opportunity-missions/24883_MER_static.glb',
    environment: '/Models/Mars-missions-models/Spirit & Opportunity-missions/Mars- Opportunity Landing Site.glb',
    fitSize: 2.4,
    modelNote: 'Shared MER model asset; supplied file does not identify this specific rover as Spirit or Opportunity.',
    tag: 'MARS EXPLORATION ROVER',
    summary: 'A rover that kept going for almost fifteen years.',
    specs: {
      coordinates: '1.9483° S, 354.4742° E',
      siteName: 'Meridiani Planum (Perseverance Valley)',
      mass: '185 kg (Earth) · 70 kg (Mars Weight)',
      duration: '5,352 Sols (14.2 Earth Years) · 45.16 km Driven',
      hardwareStatus: 'Silent at Rim of Endeavour Crater',
    },
    chapters: ch(
      'Opportunity landed in Meridiani Planum on January 25, 2004.',
      'Designed for a 90-sol mission, the rover operated for almost 15 years.',
      'It investigated rocks and minerals shaped by water and traveled more than 45 kilometers.',
      'Its final communication was received June 10, 2018. NASA announced the mission’s completion on February 13, 2019.',
      'Opportunity’s long journey left a trail of evidence and a lasting mark on Mars exploration.'
    ),
  },
];

export const fallbackAnswer = (a: Artifact, q: string) => ({
  answer: `The Archive is offline, so I can’t retrieve a sourced answer right now. In this chapter, ${a.name} is presented as: ${a.summary} Your question was “${q}”.`,
  sources: [] as { title: string; url?: string }[],
});
