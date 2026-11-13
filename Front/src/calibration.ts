export interface DisplayTerrainSpec {
  width: number;
  depth: number;
  height?: number;
  rockCount?: number;
  smoothingRadius?: number;
}

export interface AssetCalibration {
  id: string;
  name: string;
  sourcePath?: string;
  environmentPath?: string;
  sourceUnit: 'meters' | 'centimeters' | 'millimeters' | 'unknown';
  calibrationScale: number;
  calibrationStatus: 'verified' | 'estimated' | 'needs-review';
  referenceDimensionsMeters?: {
    width?: number;
    height?: number;
    length?: number;
  };
  modelRotation: [number, number, number];
  localPosition: [number, number, number];
  groundOffset: number;
  terrainSpec: DisplayTerrainSpec;
  heroCamera: {
    position: [number, number, number];
    target: [number, number, number];
  };
  chapterCameras: [
    { position: [number, number, number]; target: [number, number, number] },
    { position: [number, number, number]; target: [number, number, number] },
    { position: [number, number, number]; target: [number, number, number] },
    { position: [number, number, number]; target: [number, number, number] },
    { position: [number, number, number]; target: [number, number, number] }
  ];
}

export const ASSET_CALIBRATIONS: Record<string, AssetCalibration> = {
  'eagle': {
    id: 'eagle',
    name: 'Eagle (Apollo 11 Lunar Module)',
    sourcePath: '/Models/Moon-missions-models/Apollo11/apollo_11_lunar_module.glb',
    environmentPath: '/Models/Moon-missions-models/Apollo11/apollo_11_lunar_landing_site.glb',
    sourceUnit: 'centimeters',
    // Raw mesh Y extends from -134 to 0 (height 134 units). Real LM height = 7.04m, span = 9.4m.
    // Calibrated scale factor to make it ~7m in world units:
    calibrationScale: 0.052,
    calibrationStatus: 'verified',
    referenceDimensionsMeters: { width: 9.4, height: 7.04, length: 9.4 },
    modelRotation: [0, -0.42, 0],
    localPosition: [0, 0, 0],
    groundOffset: 0.0,
    terrainSpec: {
      width: 22.0,
      depth: 20.0,
      height: 0.75,
      rockCount: 22,
      smoothingRadius: 6.2,
    },
    heroCamera: {
      position: [1.2, 3.4, 13.8],
      target: [0.4, 2.8, 0],
    },
    chapterCameras: [
      // 1. Mission: Wide establishing hero shot
      { position: [1.2, 3.4, 13.8], target: [0.4, 2.8, 0] },
      // 2. Machine: Closer shot emphasizing descent stage structure and thrusters
      { position: [-4.2, 1.8, 8.5], target: [0, 1.8, 0] },
      // 3. Journey: Low angle looking up at the ascent stage
      { position: [3.8, 2.2, 9.2], target: [0, 3.5, 0] },
      // 4. Discoveries: Focused view on the ladder and descent stage scientific bay
      { position: [-2.2, 1.6, 6.8], target: [-0.4, 1.4, 0] },
      // 5. What Remains: Wide, solemn vista of the solitary lander on Tranquility Base
      { position: [2.5, 4.2, 17.5], target: [0, 2.0, -1.0] },
    ],
  },

  'surveyor3': {
    id: 'surveyor3',
    name: 'Surveyor 3',
    sourceUnit: 'unknown',
    calibrationScale: 1.0,
    calibrationStatus: 'needs-review',
    modelRotation: [0, 0, 0],
    localPosition: [0, 0, 0],
    groundOffset: 0.0,
    terrainSpec: {
      width: 7.5,
      depth: 7.5,
      height: 0.35,
      rockCount: 16,
      smoothingRadius: 2.2,
    },
    heroCamera: {
      position: [0.8, 2.2, 7.5],
      target: [0.2, 0.6, 0],
    },
    chapterCameras: [
      { position: [0.8, 2.2, 7.5], target: [0.2, 0.6, 0] },
      { position: [-2.2, 1.8, 6.2], target: [0, 0.6, 0] },
      { position: [2.4, 1.4, 6.5], target: [0, 0.5, 0] },
      { position: [0.4, 2.2, 5.5], target: [0, 0.5, 0] },
      { position: [1.5, 3.0, 10.5], target: [0, 0.5, 0] },
    ],
  },

  'apollo15-lrv': {
    id: 'apollo15-lrv',
    name: 'Lunar Roving Vehicle (Apollo 15)',
    sourcePath: '/Models/Moon-missions-models/Apollo15/mondfahrzeug_lunar_rover.glb',
    sourceUnit: 'meters',
    // Isolated diagnostic measured the imported hierarchy at 3.10 × 1.77 × 1.78 units.
    // The source is already expressed at vehicle scale; the prior 0.010 multiplier made it 3 cm long.
    calibrationScale: 1.0,
    calibrationStatus: 'verified',
    referenceDimensionsMeters: { width: 1.83, height: 1.14, length: 3.10 },
    modelRotation: [0, 0.38, 0],
    localPosition: [0, 0, 0],
    groundOffset: 0.0,
    terrainSpec: {
      width: 8.5,
      depth: 7.5,
      height: 0.4,
      rockCount: 18,
      smoothingRadius: 2.5,
    },
    heroCamera: {
      position: [1.15, 2.35, 8.0],
      target: [0.2, 0.75, 0],
    },
    chapterCameras: [
      // 1. Mission: Wide establishing hero perspective
      { position: [1.15, 2.35, 8.0], target: [0.2, 0.75, 0] },
      // 2. Machine: Close inspection of wire-mesh wheels and chassis
      { position: [-2.6, 1.0, 4.2], target: [-0.2, 0.6, 0] },
      // 3. Journey: Low three-quarters view as if parked on Hadley Rille
      { position: [2.8, 1.2, 4.6], target: [0.1, 0.7, 0] },
      // 4. Discoveries: High-angle view showing high-gain dish antenna & control console
      { position: [0.4, 2.4, 4.2], target: [0.1, 0.9, 0] },
      // 5. What Remains: Wide view of the abandoned rover resting silently in lunar dust
      { position: [1.6, 2.4, 9.2], target: [0, 0.6, -0.5] },
    ],
  },

  'sojourner': {
    id: 'sojourner',
    name: 'Sojourner (Mars Pathfinder)',
    sourcePath: '/Models/Mars-missions-models/pathfinder-mission/mars_sojourner_rover_model.glb',
    sourceUnit: 'centimeters',
    // Scaled at 0.0038 to accurately reflect the true miniature 65 cm microwave-sized micro-rover:
    calibrationScale: 0.0038,
    calibrationStatus: 'verified',
    referenceDimensionsMeters: { width: 0.48, height: 0.30, length: 0.65 },
    modelRotation: [0, -0.45, 0],
    localPosition: [0, 0, 0],
    groundOffset: 0.0,
    terrainSpec: {
      width: 3.8,
      depth: 3.5,
      height: 0.18,
      rockCount: 16,
      smoothingRadius: 1.2,
    },
    heroCamera: {
      position: [0.55, 1.15, 3.8],
      target: [0.05, 0.18, 0],
    },
    chapterCameras: [
      // 1. Mission: Wide establishing hero reveal on Ares Vallis
      { position: [0.55, 1.15, 3.8], target: [0.05, 0.18, 0] },
      // 2. Machine: Inspection of the 6-wheel rocker-bogie suspension system
      { position: [-1.2, 0.7, 2.6], target: [-0.05, 0.16, 0] },
      // 3. Journey: Low angle alongside rover treads on Martian regolith
      { position: [1.3, 0.65, 2.7], target: [0, 0.16, 0] },
      // 4. Discoveries: View of APXS spectrometer instrument and solar panel array
      { position: [0.3, 1.2, 2.4], target: [0.05, 0.2, 0] },
      // 5. What Remains: Solitary perspective of the miniature rover on Ares Vallis
      { position: [1.1, 1.6, 5.2], target: [0, 0.2, -0.4] },
    ],
  },

  'spirit': {
    id: 'spirit',
    name: 'Spirit (MER-A)',
    sourcePath: '/Models/Mars-missions-models/Spirit & Opportunity-missions/24883_MER_static.glb',
    environmentPath: '/Models/Mars-missions-models/Spirit & Opportunity-missions/Mars - Spirit Landing Site.glb',
    sourceUnit: 'meters',
    // Raw mesh is already in metric units: 2.28m wide x 1.58m tall x 1.65m long.
    calibrationScale: 1.0,
    calibrationStatus: 'verified',
    referenceDimensionsMeters: { width: 2.3, height: 1.5, length: 1.6 },
    modelRotation: [0, 0.42, 0],
    localPosition: [0, 0, 0],
    groundOffset: 0.0,
    terrainSpec: {
      width: 7.5,
      depth: 6.8,
      height: 0.38,
      rockCount: 20,
      smoothingRadius: 2.3,
    },
    heroCamera: {
      position: [0.8, 2.0, 5.8],
      target: [0.2, 0.85, 0],
    },
    chapterCameras: [
      // 1. Mission: Wide hero composition at Gusev Crater
      { position: [0.8, 2.0, 5.8], target: [0.2, 0.85, 0] },
      // 2. Machine: Close inspection of the Pancam mast and solar wings
      { position: [-2.2, 1.5, 4.4], target: [-0.2, 0.95, 0] },
      // 3. Journey: Low angle along rover wheel tracks in the volcanic plains
      { position: [2.4, 1.2, 4.8], target: [0.1, 0.8, 0] },
      // 4. Discoveries: Focus on the robotic arm (IDD) and microscopic imager
      { position: [-0.6, 1.3, 3.6], target: [-0.3, 0.6, 0] },
      // 5. What Remains: Quiet wider scene at Columbia Hills where Spirit fell silent
      { position: [1.5, 2.4, 9.5], target: [0, 0.8, -0.8] },
    ],
  },

  'opportunity': {
    id: 'opportunity',
    name: 'Opportunity (MER-B)',
    sourcePath: '/Models/Mars-missions-models/Spirit & Opportunity-missions/24883_MER_static.glb',
    environmentPath: '/Models/Mars-missions-models/Spirit & Opportunity-missions/Mars- Opportunity Landing Site.glb',
    sourceUnit: 'meters',
    calibrationScale: 1.0,
    calibrationStatus: 'verified',
    referenceDimensionsMeters: { width: 2.3, height: 1.5, length: 1.6 },
    modelRotation: [0, -0.32, 0],
    localPosition: [0, 0, 0],
    groundOffset: 0.0,
    terrainSpec: {
      width: 7.5,
      depth: 6.8,
      height: 0.38,
      rockCount: 20,
      smoothingRadius: 2.3,
    },
    heroCamera: {
      position: [-0.8, 2.0, 5.8],
      target: [-0.2, 0.85, 0],
    },
    chapterCameras: [
      // 1. Mission: Wide hero vista over Meridiani Planum
      { position: [-0.8, 2.0, 5.8], target: [-0.2, 0.85, 0] },
      // 2. Machine: Frontal view showing solar panels and forward hazard cameras
      { position: [2.2, 1.5, 4.4], target: [0.2, 0.9, 0] },
      // 3. Journey: View looking down into Endurance Crater rim
      { position: [-2.5, 1.3, 4.8], target: [-0.1, 0.8, 0] },
      // 4. Discoveries: Focus on hematite spherules ('blueberries') inspection position
      { position: [0.5, 1.3, 3.6], target: [0.2, 0.55, 0] },
      // 5. What Remains: Final view across Perseverance Valley under darkening skies
      { position: [-1.6, 2.6, 9.8], target: [0, 0.8, -1.0] },
    ],
  },
};

export const DEFAULT_CALIBRATION: AssetCalibration = {
  id: 'default',
  name: 'Default Spacecraft',
  sourceUnit: 'meters',
  calibrationScale: 1.0,
  calibrationStatus: 'estimated',
  modelRotation: [0, 0, 0],
  localPosition: [0, 0, 0],
  groundOffset: 0.0,
  terrainSpec: {
    width: 8.0,
    depth: 8.0,
    height: 0.35,
    rockCount: 18,
    smoothingRadius: 2.5,
  },
  heroCamera: {
    position: [0.8, 1.8, 6.0],
    target: [0.2, 0.75, 0],
  },
  chapterCameras: [
    { position: [0.8, 1.8, 6.0], target: [0.2, 0.75, 0] },
    { position: [-2.0, 1.4, 4.5], target: [0, 0.7, 0] },
    { position: [2.0, 1.2, 4.8], target: [0, 0.6, 0] },
    { position: [0, 1.8, 4.0], target: [0, 0.7, 0] },
    { position: [1.2, 2.4, 9.0], target: [0, 0.6, 0] },
  ],
};
