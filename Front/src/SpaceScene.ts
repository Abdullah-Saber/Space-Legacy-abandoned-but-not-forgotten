import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { gsap } from 'gsap';
import type { Artifact } from './catalog';
import type { PlanetId, World } from './tour';
import { ASSET_CALIBRATIONS, DEFAULT_CALIBRATION, type AssetCalibration } from './calibration';
import { createArtifactDisplayTerrain } from './displayTerrain';

export type AssetState = {
  id: string;
  path: string;
  status: 'loading' | 'ready' | 'error' | 'missing';
  error?: string;
  dimensions?: string;
  meshes?: number;
  textures?: number;
  diagnostic?: string;
};

export type CameraMode =
  | 'WELCOME'
  | 'PLANET_SELECTION'
  | 'TRAVEL'
  | 'HERO_REVEAL'
  | 'SCROLL_STORY'
  | 'INSPECTION'
  | 'FINALE';

const PLANET_ASSET_PATHS: Record<PlanetId, string> = {
  earth: '/Models/Earth_1_12756.glb',
  moon: '/Models/moon_small.glb',
  mars: '/Models/24881_Mars_1_6792.glb',
};

export interface LightingPreset {
  exposure: number;
  environmentIntensity: number;
  shadowBias?: number;
  key: {
    color: number;
    intensity: number;
    position: [number, number, number];
  };
  fill: {
    color: number;
    intensity: number;
    position: [number, number, number];
  };
  rim: {
    color: number;
    intensity: number;
    position: [number, number, number];
  };
  hemi: {
    skyColor: number;
    groundColor: number;
    intensity: number;
  };
}

export const LIGHTING_PRESETS: Record<'lunar' | 'martian' | 'orbital', LightingPreset> = {
  // Lunar: Airless high-contrast world with brilliant sun, deep shadows, cool starlight fill
  lunar: {
    exposure: 1.08,
    environmentIntensity: 0.28,
    shadowBias: 0.00005,
    key: {
      color: 0xfffcf2,      // Direct unfiltered extraterrestrial sunlight
      intensity: 3.85,
      position: [-6.8, 12.0, 7.8],
    },
    fill: {
      color: 0x425870,      // Cool slate starlight/earthlight fill
      intensity: 1.05,
      position: [5.8, 4.5, 8.8],
    },
    rim: {
      color: 0x88b0d8,      // Crisp cool specular rim on metal edges
      intensity: 0.78,
      position: [1.2, 5.8, -9.5],
    },
    hemi: {
      skyColor: 0x223040,   // Deep void starlight
      groundColor: 0x181a1e,// Dusty lunar regolith bounce
      intensity: 0.32,
    },
  },

  // Martian: Dusty atmosphere, warm solar radiation, oxidized rust ground bounce, amber rim
  martian: {
    exposure: 1.28,
    environmentIntensity: 0.48,
    shadowBias: 0.00005,
    key: {
      color: 0xfff2e5,      // Crisp, high-output solar beam through Martian atmosphere
      intensity: 5.4,       // High key intensity revealing full mechanical and chassis relief
      position: [-6.8, 12.5, 7.5],
    },
    fill: {
      color: 0xe09575,      // Warm dusty peach/salmon fill (high reflectance from iron-rich dust)
      intensity: 2.2,       // Strong fill to clearly reveal wheels, undercarriage, instruments
      position: [6.5, 4.5, 8.5],
    },
    rim: {
      color: 0xffb87a,      // Radiant golden-copper rim highlight
      intensity: 1.6,       // Strong silhouette separation against the dark void
      position: [1.2, 6.2, -9.5],
    },
    hemi: {
      skyColor: 0xa86448,   // Salmon/butterscotch Martian sky bounce
      groundColor: 0x5a2818,// Rich red-brown iron oxide dust bounce
      intensity: 0.85,      // High upward regolith bounce
    },
  },

  // Orbital: Deep space planetary vista, clear terminator, dark sky
  orbital: {
    exposure: 0.95,
    environmentIntensity: 0.22,
    shadowBias: 0.00005,
    key: {
      color: 0xfff8ee,
      intensity: 2.6,
      position: [-8.0, 4.0, 9.0],
    },
    fill: {
      color: 0x22364c,
      intensity: 0.35,
      position: [7.0, 2.0, 6.0],
    },
    rim: {
      color: 0x5078a4,
      intensity: 0.45,
      position: [-1.0, 6.0, -10.0],
    },
    hemi: {
      skyColor: 0x0f1822,
      groundColor: 0x06090d,
      intensity: 0.18,
    },
  },
};

export const TRAVEL_CONFIG = {
  samePlanet: {
    departure: 1.5,      // Stage 1: Majestic pull away framing planetary sphere
    acceleration: 2.2,   // Stage 2: Star streaks surge & warp rush
    approach: 2.0,       // Stage 3: Deceleration toward surface, terrain horizon expands
    descent: 1.8,        // Stage 4: Thruster descent burn with landing vibration
    blackoutFade: 1.4,   // Stage 5: Progressive cinematic fade into deep black
    blackoutHold: 0.8,   // Stage 5: Breathless hold in absolute darkness during swap
    reveal: 4.2,         // Stage 6: Dramatic 4-second orbital turnaround & monumental reveal
  },
  crossPlanet: {
    departure: 2.2,      // Stage 1: Interplanetary departure into deep cosmic void
    acceleration: 4.8,   // Stage 2: Deep space hyper-cruise through starfield
    approach: 3.2,       // Stage 3: Target planet appears and looms dynamically
    descent: 2.2,        // Stage 4: High-speed atmospheric entry with vibration
    blackoutFade: 1.6,   // Stage 5: Atmospheric compression & progressive blackout
    blackoutHold: 0.9,   // Stage 5: Breathless hold in darkness during swap
    reveal: 4.2,         // Stage 6: Dramatic 4-second orbital turnaround & monumental reveal
  },
  shake: {
    frequency: 9.8,      // 9.8 Hz composite multi-axis vibration
    amplitude: 0.078,    // High-impact visceral physical descent rumble
  },
} as const;

export class SpaceScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1500);
  controls: OrbitControls;

  // Scene Context Groups (Strict Architectural Separation)
  orbitalGroup = new THREE.Group();
  surfaceGroup = new THREE.Group();

  // Individual Planet Groups (Dedicated & Isolated)
  earthGroup = new THREE.Group();
  moonGroup = new THREE.Group();
  marsGroup = new THREE.Group();

  // Authoritative Planet Selection State
  activePlanetId: PlanetId = 'earth';
  private loadedPlanets = new Set<PlanetId>();
  private planetLoads = new Map<PlanetId, Promise<void>>();
  private environmentMapPromise?: Promise<void>;
  private minimumFrameInterval = 0;
  private lastFrameTime = 0;
  activeSceneId: 'orbital' | 'surface' = 'orbital';
  activeModelPath = '';

  // Surface Scene Elements
  displayTerrainGroup = new THREE.Group();
  artifactGroup = new THREE.Group();
  artifactPlacementRoot = new THREE.Group();
  artifactCalibrationRoot = new THREE.Group();
  artifactModel?: THREE.Object3D;
  currentCalibration: AssetCalibration = DEFAULT_CALIBRATION;
  currentArtifactId = '';
  currentChapterIndex = 0;

  // Camera & Mode
  mode: CameraMode = 'WELCOME';
  frame = 0;
  failed = false;
  assets: AssetState[] = [];
  onAssets?: (items: AssetState[]) => void;
  onBlackout?: (active: boolean, loading: boolean) => void;
  onTravelState?: (state: 'DEPARTURE' | 'ACCELERATION' | 'APPROACH' | 'DESCENT' | 'BLACKOUT' | 'SCENE_SWAP' | 'REVEAL' | 'COMPLETED') => void;

  // Async Lifecycle
  private loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private timeline?: gsap.core.Timeline;
  private assetRevision = 0;
  private transitionToken = 0;

  // Particles & Streaks
  private travelPoints?: THREE.LineSegments;
  private ambient: { points: THREE.Points; speed: number; axis: 'x' | 'y' | 'z'; span: number }[] = [];

  // Camera Presets
  private cameraLookTarget = new THREE.Vector3(0, 0, 0);
  private heroView = { position: new THREE.Vector3(0.8, 2.0, 6.0), target: new THREE.Vector3(0.2, 0.75, 0) };
  private guidedView = { position: new THREE.Vector3(0.8, 2.0, 6.0), target: new THREE.Vector3(0.2, 0.75, 0) };

  // Debug HUD & Visual Helpers
  private debugScene = false;
  private debugOverlay?: HTMLDivElement;
  private debugHelpers: THREE.Object3D[] = [];
  private debugModelBoxHelper?: THREE.Box3Helper;
  private debugTargetMarker?: THREE.Mesh;
  private sunlight?: THREE.DirectionalLight;
  private sunlightTarget = new THREE.Object3D();
  private fillLight?: THREE.DirectionalLight;
  private rimLight?: THREE.DirectionalLight;
  private hemisphereLight?: THREE.HemisphereLight;
  private ambientLight?: THREE.AmbientLight;
  private lrvDiagnosticActive = false;
  private debugLighting = false;
  private lightingPanel?: HTMLDivElement;
  private shake = {
    active: false,
    start: 0,
    duration: 0,
    amplitude: 0,
    applied: new THREE.Vector3(),
    rotApplied: new THREE.Vector3(),
  };

  constructor(private canvas: HTMLCanvasElement) {
    this.debugScene = new URLSearchParams(window.location.search).has('debugScene');
    this.debugLighting = new URLSearchParams(window.location.search).has('debugLighting');

    // High fidelity color & PBR renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    const compactDevice = window.matchMedia('(max-width: 680px)').matches;
    const pixelRatioCap = compactDevice ? 1.25 : 1.5;
    this.minimumFrameInterval = compactDevice ? 1000 / 30 : 0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = !compactDevice;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color('#020409');
    this.camera.position.set(0, 0.35, 9.8);
    this.camera.lookAt(0, 0, 0);

    // Mount context groups
    this.scene.add(this.orbitalGroup);
    this.scene.add(this.surfaceGroup);

    // Add dedicated planet groups to orbital context
    this.orbitalGroup.add(this.earthGroup);
    this.orbitalGroup.add(this.moonGroup);
    this.orbitalGroup.add(this.marsGroup);

    // Initial planet visibility: Only Earth on Welcome
    this.earthGroup.visible = true;
    this.moonGroup.visible = false;
    this.marsGroup.visible = false;
    this.surfaceGroup.visible = false;

    // Surface Two-Tier Transform Hierarchy:
    // surfaceGroup -> displayTerrainGroup
    // surfaceGroup -> artifactGroup -> artifactPlacementRoot -> artifactCalibrationRoot -> importedModel
    this.surfaceGroup.add(this.displayTerrainGroup);
    this.surfaceGroup.add(this.artifactGroup);
    this.artifactGroup.add(this.artifactPlacementRoot);
    this.artifactPlacementRoot.add(this.artifactCalibrationRoot);

    // Cinematic Lighting Setup with Sharp PBR Contrast
    this.setupLighting();

    // Inspection OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enabled = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableRotate = true;
    this.controls.enableZoom = true;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = 0.04;
    this.controls.maxPolarAngle = Math.PI - 0.08;
    this.controls.minDistance = 1.0;
    this.controls.maxDistance = 28.0;

    // Environmental Systems
    this.createAmbientParticles();
    this.createTravelStreaks();
    // Load the welcome world first; other worlds load when selected.
    void this.loadPlanet('earth');

    if (this.debugScene) {
      this.initDebugTools();
    }
    if (this.debugLighting) this.initLightingPanel();

    this.resize();
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    if (!document.hidden) this.renderer.setAnimationLoop(this.render);
  }

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.renderer.setAnimationLoop(null);
      return;
    }

    this.lastFrameTime = 0;
    this.renderer.setAnimationLoop(this.render);
    this.render(performance.now());
  };

  // ==========================================
  // LIGHTING & PBR PIPELINE (NO WASHED OUT LOOK)
  // ==========================================
  private setupLighting() {
    // Ambient base: keeps deep cosmic shadows dark without crushing to pure black
    this.ambientLight = new THREE.AmbientLight(0x040810, 0.22);
    this.scene.add(this.ambientLight);

    // Subtle sky-to-ground hemisphere bounce
    this.hemisphereLight = new THREE.HemisphereLight(0x223040, 0x181a1e, 0.32);
    this.scene.add(this.hemisphereLight);

    // Primary Directional Sunlight: High-intensity key light revealing mechanical forms
    this.sunlight = new THREE.DirectionalLight(0xfffcf2, 3.85);
    this.sunlight.position.set(-6.8, 12.0, 7.8);
    this.sunlight.castShadow = true;
    this.sunlight.shadow.mapSize.set(2048, 2048);
    this.sunlight.shadow.camera.near = 0.5;
    this.sunlight.shadow.camera.far = 45;
    this.sunlight.shadow.camera.left = -8;
    this.sunlight.shadow.camera.right = 8;
    this.sunlight.shadow.camera.top = 8;
    this.sunlight.shadow.camera.bottom = -8;
    this.sunlight.shadow.bias = 0.00005;
    this.sunlight.shadow.normalBias = 0.02;

    this.sunlightTarget.position.set(0, 0.6, 0);
    this.scene.add(this.sunlightTarget);
    this.sunlight.target = this.sunlightTarget;
    this.scene.add(this.sunlight);

    // Restrained fill light from opposite angle to preserve shadow details
    this.fillLight = new THREE.DirectionalLight(0x425870, 1.05);
    this.fillLight.position.set(5.8, 4.5, 8.8);
    this.scene.add(this.fillLight);

    // Subtle rim light: separates vehicle silhouette from the dark cosmic background
    this.rimLight = new THREE.DirectionalLight(0x88b0d8, 0.78);
    this.rimLight.position.set(1.2, 5.8, -9.5);
    this.scene.add(this.rimLight);
  }

  /** Dynamically fits directional key sunlight shadow frustum to vehicle footprint for crisp contact shadows. */
  fitShadowsToArtifact(terrainWidth: number, terrainDepth: number) {
    if (!this.sunlight) return;
    const radius = Math.max(2.4, Math.max(terrainWidth, terrainDepth) * 0.68);
    this.sunlight.shadow.camera.left = -radius;
    this.sunlight.shadow.camera.right = radius;
    this.sunlight.shadow.camera.top = radius;
    this.sunlight.shadow.camera.bottom = -radius;
    this.sunlight.shadow.camera.near = 0.5;
    this.sunlight.shadow.camera.far = Math.max(35, radius * 3.5);
    this.sunlight.shadow.camera.updateProjectionMatrix();
  }

  /** Keeps orbital, lunar, and Martian scenes deliberately lit instead of globally overexposed. */
  applyLightingPreset(presetName: 'lunar' | 'martian' | 'orbital') {
    if (!this.sunlight || !this.fillLight || !this.rimLight || !this.hemisphereLight) return;
    const preset = LIGHTING_PRESETS[presetName];
    if (!preset) return;

    this.renderer.toneMappingExposure = preset.exposure;
    (this.scene as unknown as { environmentIntensity: number }).environmentIntensity = preset.environmentIntensity;

    this.sunlight.color.setHex(preset.key.color);
    this.sunlight.intensity = preset.key.intensity;
    this.sunlight.position.set(...preset.key.position);

    if (preset.shadowBias !== undefined) {
      this.sunlight.shadow.bias = preset.shadowBias;
    }

    this.fillLight.color.setHex(preset.fill.color);
    this.fillLight.intensity = preset.fill.intensity;
    this.fillLight.position.set(...preset.fill.position);

    this.rimLight.color.setHex(preset.rim.color);
    this.rimLight.intensity = preset.rim.intensity;
    this.rimLight.position.set(...preset.rim.position);

    this.hemisphereLight.color.setHex(preset.hemi.skyColor);
    this.hemisphereLight.groundColor.setHex(preset.hemi.groundColor);
    this.hemisphereLight.intensity = preset.hemi.intensity;
  }

  private setLightingValue(key: 'key' | 'sunX' | 'sunY' | 'sunZ' | 'fill' | 'rim' | 'environment' | 'exposure' | 'bias', value: number) {
    if (key === 'key' && this.sunlight) this.sunlight.intensity = value;
    if (key === 'sunX' && this.sunlight) this.sunlight.position.x = value;
    if (key === 'sunY' && this.sunlight) this.sunlight.position.y = value;
    if (key === 'sunZ' && this.sunlight) this.sunlight.position.z = value;
    if (key === 'fill' && this.fillLight) this.fillLight.intensity = value;
    if (key === 'rim' && this.rimLight) this.rimLight.intensity = value;
    if (key === 'environment') (this.scene as unknown as { environmentIntensity: number }).environmentIntensity = value;
    if (key === 'exposure') this.renderer.toneMappingExposure = value;
    if (key === 'bias' && this.sunlight) this.sunlight.shadow.bias = value;
  }

  /** Development-only visual tuning panel enabled solely through ?debugLighting=1. */
  private initLightingPanel() {
    const panel = document.createElement('div');
    panel.id = 'lighting-debug-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <strong>CINEMATIC LIGHTING TUNING</strong>
        <small>?debugLighting=1 active</small>
      </div>
      <div class="preset-buttons">
        <button id="btn-preset-lunar" type="button">Lunar</button>
        <button id="btn-preset-martian" type="button">Martian</button>
        <button id="btn-preset-orbital" type="button">Orbital</button>
      </div>
    `;

    const sliders: Array<{
      label: string;
      key: 'key' | 'sunX' | 'sunY' | 'sunZ' | 'fill' | 'rim' | 'environment' | 'exposure' | 'bias';
      min: number;
      max: number;
      step: number;
      get: () => number;
      set: (v: number) => void;
    }> = [
      { label: 'Key Int', key: 'key', min: 0, max: 6, step: 0.05, get: () => this.sunlight?.intensity ?? 3.85, set: v => this.setLightingValue('key', v) },
      { label: 'Sun X', key: 'sunX', min: -15, max: 15, step: 0.5, get: () => this.sunlight?.position.x ?? -6.8, set: v => this.setLightingValue('sunX', v) },
      { label: 'Sun Y', key: 'sunY', min: 2, max: 20, step: 0.5, get: () => this.sunlight?.position.y ?? 12, set: v => this.setLightingValue('sunY', v) },
      { label: 'Sun Z', key: 'sunZ', min: -15, max: 15, step: 0.5, get: () => this.sunlight?.position.z ?? 7.8, set: v => this.setLightingValue('sunZ', v) },
      { label: 'Fill Int', key: 'fill', min: 0, max: 3, step: 0.05, get: () => this.fillLight?.intensity ?? 0.95, set: v => this.setLightingValue('fill', v) },
      { label: 'Rim Int', key: 'rim', min: 0, max: 2.5, step: 0.05, get: () => this.rimLight?.intensity ?? 0.72, set: v => this.setLightingValue('rim', v) },
      { label: 'Env Int', key: 'environment', min: 0, max: 1, step: 0.01, get: () => (this.scene as unknown as { environmentIntensity: number }).environmentIntensity ?? 0.28, set: v => this.setLightingValue('environment', v) },
      { label: 'Exposure', key: 'exposure', min: 0.5, max: 2.0, step: 0.01, get: () => this.renderer.toneMappingExposure, set: v => this.setLightingValue('exposure', v) },
      { label: 'Shadow Bias', key: 'bias', min: -0.001, max: 0.001, step: 0.00005, get: () => this.sunlight?.shadow.bias ?? 0.00005, set: v => this.setLightingValue('bias', v) },
    ];

    sliders.forEach(ctrl => {
      const row = document.createElement('label');
      const name = document.createElement('span');
      name.textContent = ctrl.label;
      const output = document.createElement('output');
      output.setAttribute('data-key', ctrl.key);
      const input = document.createElement('input');
      input.type = 'range';
      input.setAttribute('data-key', ctrl.key);
      input.min = String(ctrl.min);
      input.max = String(ctrl.max);
      input.step = String(ctrl.step);
      input.value = String(ctrl.get());
      output.value = Number(input.value).toFixed(2);

      input.addEventListener('input', () => {
        const val = Number(input.value);
        output.value = val.toFixed(2);
        ctrl.set(val);
      });

      row.append(name, input, output);
      panel.appendChild(row);
    });

    const refreshInputs = () => {
      sliders.forEach(ctrl => {
        const inp = panel.querySelector<HTMLInputElement>(`input[data-key="${ctrl.key}"]`);
        const out = panel.querySelector<HTMLOutputElement>(`output[data-key="${ctrl.key}"]`);
        if (inp && out) {
          const val = ctrl.get();
          inp.value = String(val);
          out.value = Number(val).toFixed(2);
        }
      });
    };

    panel.querySelector('#btn-preset-lunar')?.addEventListener('click', () => {
      this.applyLightingPreset('lunar');
      refreshInputs();
    });
    panel.querySelector('#btn-preset-martian')?.addEventListener('click', () => {
      this.applyLightingPreset('martian');
      refreshInputs();
    });
    panel.querySelector('#btn-preset-orbital')?.addEventListener('click', () => {
      this.applyLightingPreset('orbital');
      refreshInputs();
    });

    const copyBtn = document.createElement('button');
    copyBtn.className = 'debug-copy-btn';
    copyBtn.textContent = 'Copy Current Settings';
    copyBtn.onclick = () => {
      const current = {
        key: { intensity: this.sunlight?.intensity, position: this.sunlight?.position.toArray() },
        fill: { intensity: this.fillLight?.intensity, position: this.fillLight?.position.toArray() },
        rim: { intensity: this.rimLight?.intensity, position: this.rimLight?.position.toArray() },
        environmentIntensity: (this.scene as unknown as { environmentIntensity: number }).environmentIntensity,
        exposure: this.renderer.toneMappingExposure,
        shadowBias: this.sunlight?.shadow.bias,
      };
      console.info('[DEBUG LIGHTING VALUES]', current);
      navigator.clipboard?.writeText(JSON.stringify(current, null, 2));
      copyBtn.textContent = 'Copied to Clipboard!';
      setTimeout(() => { copyBtn.textContent = 'Copy Current Settings'; }, 2000);
    };
    panel.appendChild(copyBtn);

    document.body.appendChild(panel);
    this.lightingPanel = panel;
  }

  // ==========================================
  // ENVIRONMENT MAP (CALIBRATED INTENSITY)
  // ==========================================
  private loadEnvironmentMap() {
    if (this.environmentMapPromise) return this.environmentMapPromise;
    const path = '/Skybox-bg/starmap_2020_2k.exr';
    this.publishAsset({ id: 'environment-exr', path, status: 'loading' });
    this.environmentMapPromise = (async () => {
      try {
        const texture = await new EXRLoader().loadAsync(path);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.LinearSRGBColorSpace;
        this.scene.environment = texture;
        // The map contributes restrained PBR reflections. A dark background preserves silhouettes and contrast.
        this.scene.background = new THREE.Color('#020409');

        // CRITICAL: Calibrate environment intensity so EXR starlight does not wash out materials!
        // In Three.js, environmentIntensity controls how strongly the HDR map illuminates PBR materials:
        (this.scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.35;

        this.publishAsset({
          id: 'environment-exr',
          path,
          status: 'ready',
          dimensions: `${texture.image.width} × ${texture.image.height}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.publishAsset({ id: 'environment-exr', path, status: 'error', error: message });
        this.scene.background = new THREE.Color('#020409');
      }
    })();
    return this.environmentMapPromise;
  }

  private publishAsset(next: AssetState) {
    const index = this.assets.findIndex(x => x.id === next.id);
    if (index < 0) this.assets = [...this.assets, next];
    else this.assets = this.assets.map((x, i) => (i === index ? next : x));
    this.onAssets?.([...this.assets]);
  }

  private inspectGLTF(id: string, path: string, gltf: GLTF) {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    let meshes = 0;
    let textures = 0;
    gltf.scene.traverse(o => {
      if ((o as THREE.Mesh).isMesh) {
        meshes++;
        const m = (o as THREE.Mesh).material;
        for (const mat of Array.isArray(m) ? m : [m]) {
          for (const value of Object.values(mat)) {
            if (value instanceof THREE.Texture) textures++;
          }
        }
      }
    });
    const dimensions = `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}m`;
    this.publishAsset({ id, path, status: 'ready', dimensions, meshes, textures });
    return { box, size, meshes, textures };
  }

  private async loadGLTF(id: string, path: string) {
    this.publishAsset({ id, path, status: 'loading' });
    try {
      const gltf = await this.loader.loadAsync(path);
      this.inspectGLTF(id, path, gltf);
      return gltf;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.publishAsset({ id, path, status: 'error', error: message });
      throw error;
    }
  }

  /** Isolated Apollo 15 LRV proof scene, available at ?debugAssets=1. */
  async showLrvDiagnostic() {
    const id = 'diagnostic-apollo15-lrv';
    const path = ASSET_CALIBRATIONS['apollo15-lrv'].sourcePath!;
    this.lrvDiagnosticActive = true;
    this.cancelJourney();
    this.orbitalGroup.visible = false;
    this.surfaceGroup.visible = true;
    this.displayTerrainGroup.clear();
    this.artifactCalibrationRoot.clear();
    this.scene.background = new THREE.Color(0x161a20);
    this.mode = 'INSPECTION';
    this.applyLightingPreset('lunar');

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18),
      new THREE.MeshStandardMaterial({ color: 0x555b62, roughness: 0.9, metalness: 0 })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    this.displayTerrainGroup.add(plane, new THREE.AxesHelper(2));

    try {
      const gltf = await this.loadGLTF(id, path);
      gltf.scene.updateMatrixWorld(true);
      const rawBox = new THREE.Box3().setFromObject(gltf.scene);
      const rawSize = rawBox.getSize(new THREE.Vector3());
      const rawSphere = rawBox.getBoundingSphere(new THREE.Sphere());
      const calib = ASSET_CALIBRATIONS['apollo15-lrv'];
      gltf.scene.position.set(-rawBox.getCenter(new THREE.Vector3()).x, -rawBox.min.y, -rawBox.getCenter(new THREE.Vector3()).z);
      gltf.scene.rotation.set(...calib.modelRotation);
      gltf.scene.scale.setScalar(calib.calibrationScale);
      gltf.scene.traverse(o => {
        if ((o as THREE.Mesh).isMesh) {
          const mesh = o as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      this.artifactCalibrationRoot.add(gltf.scene);
      this.artifactCalibrationRoot.updateMatrixWorld(true);
      const worldBox = new THREE.Box3().setFromObject(this.artifactCalibrationRoot);
      const worldSize = worldBox.getSize(new THREE.Vector3());
      const worldSphere = worldBox.getBoundingSphere(new THREE.Sphere());
      const fitDistance = Math.max(4.2, worldSphere.radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.28);
      this.camera.position.set(fitDistance * 0.72, Math.max(1.6, worldSize.y * 1.25), fitDistance);
      this.cameraLookTarget.copy(worldBox.getCenter(new THREE.Vector3()));
      this.camera.lookAt(this.cameraLookTarget);
      this.camera.updateMatrixWorld();
      const frustum = new THREE.Frustum().setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse)
      );
      const visibleMeshes = { total: 0, visible: 0 };
      gltf.scene.traverse(o => {
        if ((o as THREE.Mesh).isMesh) {
          visibleMeshes.total++;
          if (o.visible) visibleMeshes.visible++;
        }
      });
      const frustumVisible = frustum.intersectsBox(worldBox);
      this.scene.add(new THREE.Box3Helper(worldBox, 0xffc447));
      const result = frustumVisible && visibleMeshes.visible > 0 ? 'LOADED_AND_VISIBLE' : 'LOADED_BUT_OUTSIDE_CAMERA';
      const diagnostic = `${result} | raw ${rawSize.x.toFixed(2)} × ${rawSize.y.toFixed(2)} × ${rawSize.z.toFixed(2)} | ` +
        `calibrated ${worldSize.x.toFixed(2)} × ${worldSize.y.toFixed(2)} × ${worldSize.z.toFixed(2)}m | ` +
        `radius ${worldSphere.radius.toFixed(2)}m | meshes ${visibleMeshes.visible}/${visibleMeshes.total} | frustum ${frustumVisible}`;
      this.publishAsset({ id, path, status: 'ready', dimensions: `${worldSize.x.toFixed(2)} × ${worldSize.y.toFixed(2)} × ${worldSize.z.toFixed(2)}m`, diagnostic });
      console.info('[LRV DIAGNOSTIC]', { result, path, rawSize, rawRadius: rawSphere.radius, worldSize, worldRadius: worldSphere.radius, visibleMeshes, frustumVisible, calibrationScale: calib.calibrationScale, position: gltf.scene.position });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.publishAsset({ id, path, status: 'error', error: message, diagnostic: 'LOADING_FAILED' });
      console.error('[LRV DIAGNOSTIC]', { result: 'LOADING_FAILED', path, error: message });
    }
  }

  // ==========================================
  // AUTHORITATIVE PLANET SELECTION
  // ==========================================
  setActivePlanet(planetId: PlanetId, animate = true) {
    this.activePlanetId = planetId;
    this.activeSceneId = 'orbital';
    this.orbitalGroup.visible = true;
    this.surfaceGroup.visible = false;

    // Strict Mutually Exclusive Visibility:
    this.earthGroup.visible = planetId === 'earth';
    this.moonGroup.visible = planetId === 'moon';
    this.marsGroup.visible = planetId === 'mars';

    console.info('[WORLD SELECTED]', this.activePlanetId);
    console.info('[ACTIVE SCENE]', this.activeSceneId);
    console.info('[ACTIVE MODEL]', PLANET_ASSET_PATHS[planetId]);

    const targetGroup =
      planetId === 'earth' ? this.earthGroup : planetId === 'moon' ? this.moonGroup : this.marsGroup;
    if (!this.loadedPlanets.has(planetId)) void this.loadPlanet(planetId);
    targetGroup.position.set(0, 0, 0);
    this.applyLightingPreset('orbital');

    if (!animate) return;
    const camZ = planetId === 'moon' ? 7.6 : planetId === 'mars' ? 7.8 : 8.4;
    gsap.killTweensOf(this.camera.position);
    gsap.to(this.camera.position, {
      x: 0,
      y: 0.35,
      z: camZ,
      duration: 1.2,
      ease: 'power2.inOut',
      onUpdate: () => this.camera.lookAt(0, 0, 0),
    });
  }

  async loadPlanet(which: PlanetId) {
    if (this.loadedPlanets.has(which)) return;
    const existingLoad = this.planetLoads.get(which);
    if (existingLoad) return existingLoad;
    const path = PLANET_ASSET_PATHS[which];
    const load = (async () => {
      try {
      const gltf = await this.loadGLTF(`planet-${which}`, path);
      const targetGroup = which === 'earth' ? this.earthGroup : which === 'moon' ? this.moonGroup : this.marsGroup;
      targetGroup.clear();

      const object = gltf.scene;
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());

      object.position.sub(box.getCenter(new THREE.Vector3()));
      // Elevated planetary scale to proudly command the viewport on destination selection:
      const targetDiameter = which === 'earth' ? 5.2 : which === 'moon' ? 4.6 : 4.8;
      object.scale.setScalar(targetDiameter / Math.max(size.x, size.y, size.z, 0.001));
      object.rotation.y = -0.4;

      targetGroup.add(object);
      this.loadedPlanets.add(which);
      targetGroup.position.set(0, 0, 0);
      targetGroup.visible = this.activePlanetId === which && this.activeSceneId === 'orbital';
      } catch {
        this.failed = true;
      } finally {
        this.planetLoads.delete(which);
      }
    })();
    this.planetLoads.set(which, load);
    return load;
  }

  showPrologue() {
    this.mode = 'WELCOME';
    this.setActivePlanet('earth', false);
    this.applyLightingPreset('orbital');
    this.camera.position.set(0, 0.1, 3.4);
    this.camera.lookAt(0, 0, 0);
  }

  playPrologueEarthIntro(): Promise<void> {
    this.mode = 'WELCOME';
    this.setActivePlanet('earth', false);
    this.applyLightingPreset('orbital');
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.earthGroup.rotation);

    // Initial position close to rotating Earth:
    this.camera.position.set(0, 0.1, 3.4);
    this.camera.lookAt(0, 0, 0);

    return new Promise(resolve => {
      const startRot = this.earthGroup.rotation.y;
      gsap.fromTo(
        this.earthGroup.rotation,
        { y: startRot },
        {
          y: startRot + Math.PI * 3.2,
          duration: 3.4,
          ease: 'power3.out',
        }
      );

      gsap.to(this.camera.position, {
        x: 0,
        y: 0.35,
        z: 8.4,
        duration: 3.4,
        ease: 'power3.out',
        onUpdate: () => this.camera.lookAt(0, 0, 0),
        onComplete: () => {
          resolve();
        },
      });
    });
  }

  playFinaleZoomOut(): Promise<void> {
    this.mode = 'WELCOME';
    this.controls.enabled = false;
    this.cancelActiveTimeline();
    this.rootTweenStop();
    gsap.killTweensOf(this.camera.position);

    return new Promise(resolve => {
      gsap.to(this.camera.position, {
        x: 0,
        y: 2.4,
        z: 32.0,
        duration: 5.2,
        ease: 'power2.out',
        onUpdate: () => this.camera.lookAt(0, 0, 0),
        onComplete: () => {
          resolve();
        },
      });
    });
  }

  showWelcome() {
    this.mode = 'WELCOME';
    this.setActivePlanet('earth');
    this.applyLightingPreset('orbital');
  }

  showPlanetSelection(selectedWorld: World = 'moon') {
    this.mode = 'PLANET_SELECTION';
    this.setActivePlanet(selectedWorld);
    this.applyLightingPreset('orbital');
  }

  setDestination(which: World) {
    this.setActivePlanet(which);
    this.mode = 'TRAVEL';
    this.controls.enabled = false;
    this.cancelActiveTimeline();
    this.rootTweenStop();
  }

  // ==========================================
  // SURFACE SCENE & ARTIFACT LIFECYCLE
  // ==========================================
  async showArtifact(artifact: Artifact, skip = false, previousPlanet?: World) {
    const revision = ++this.assetRevision;
    const token = ++this.transitionToken;

    const isCrossPlanet = previousPlanet && previousPlanet !== artifact.planet;
    this.activePlanetId = artifact.planet;
    this.currentArtifactId = artifact.id;
    this.currentCalibration = ASSET_CALIBRATIONS[artifact.id] ?? DEFAULT_CALIBRATION;
    this.currentChapterIndex = 0;
    this.activeModelPath = artifact.model || '(archival record)';

    this.mode = 'TRAVEL';
    this.lrvDiagnosticActive = false;
    this.controls.enabled = false;
    this.cancelActiveTimeline();
    this.rootTweenStop();

    // Signal loading begins behind blackout
    this.onBlackout?.(false, true);

    // Fetch model
    const modelPromise = artifact.model
      ? this.loadGLTF(`artifact-${artifact.id}`, artifact.model)
      : Promise.resolve(undefined);
    // Reflections can arrive while the artifact is being revealed; they should not hold up the model.
    if (artifact.model) void this.loadEnvironmentMap();

    const [modelResult] = await Promise.allSettled([modelPromise]);

    if (revision !== this.assetRevision || token !== this.transitionToken) {
      if (modelResult.status === 'fulfilled' && modelResult.value) this.disposeObject(modelResult.value.scene);
      return;
    }

    // Clean previous active models in surface scene
    this.artifactCalibrationRoot.clear();
    this.displayTerrainGroup.clear();
    this.artifactModel = undefined;

    if (!artifact.model) {
      this.publishAsset({
        id: `artifact-${artifact.id}`,
        path: '(archival record)',
        status: 'missing',
        error: 'Authentic 3D model unavailable; presented on custom display terrain.',
      });
    }

    const calib = this.currentCalibration;

    // 1. Mount and calibrate spacecraft model into two-tier hierarchy:
    // ScenePlacementRoot (artifactPlacementRoot) -> CalibrationRoot (artifactCalibrationRoot) -> ImportedAsset
    if (modelResult.status === 'fulfilled' && modelResult.value) {
      const model = modelResult.value.scene;
      const { box } = this.inspectGLTF(`artifact-${artifact.id}`, artifact.model!, modelResult.value);

      // Centering horizontally, grounding on min Y:
      const center = box.getCenter(new THREE.Vector3());
      model.position.set(-center.x, -box.min.y, -center.z);

      model.traverse(o => {
        if ((o as THREE.Mesh).isMesh) {
          const mesh = o as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });

      this.artifactCalibrationRoot.add(model);
      this.artifactCalibrationRoot.scale.setScalar(calib.calibrationScale);
      this.artifactModel = model;

      // PlacementRoot handles world location, rotation, and ground offset
      this.artifactPlacementRoot.position.set(
        calib.localPosition[0],
        calib.localPosition[1] + calib.groundOffset,
        calib.localPosition[2]
      );
      this.artifactPlacementRoot.rotation.set(
        calib.modelRotation[0],
        calib.modelRotation[1],
        calib.modelRotation[2]
      );

      // Authentic materials stay intact. Calibrate environment map reflection to enhance metallic highlights.
      model.traverse(o => {
        if (!(o as THREE.Mesh).isMesh) return;
        const mesh = o as THREE.Mesh;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          if ('envMapIntensity' in material) {
            material.envMapIntensity = artifact.planet === 'mars' ? 0.72 : 0.48;
          }
        }
      });
    }

    // 2. Build terrain from the calibrated, world-space vehicle footprint.
    this.artifactPlacementRoot.updateMatrixWorld(true);
    const footprint = this.artifactModel
      ? new THREE.Box3().setFromObject(this.artifactPlacementRoot).getSize(new THREE.Vector3())
      : new THREE.Vector3(calib.terrainSpec.width * 0.5, 0, calib.terrainSpec.depth * 0.5);
    const terrainWidth = this.artifactModel
      ? Math.max(1.45, footprint.x * 1.85)
      : calib.terrainSpec.width;
    const terrainDepth = this.artifactModel
      ? Math.max(1.45, footprint.z * 1.85)
      : calib.terrainSpec.depth;
    const terrainPlatform = createArtifactDisplayTerrain({
      world: artifact.planet,
      width: terrainWidth,
      depth: terrainDepth,
      height: Math.max(0.18, Math.min(terrainWidth, terrainDepth) * 0.065),
      rockCount: Math.max(12, Math.round((terrainWidth + terrainDepth) * 1.5)),
      smoothingRadius: Math.min(terrainWidth, terrainDepth) * 0.26,
    });
    this.displayTerrainGroup.add(terrainPlatform);
    console.info('[CALIBRATION]', {
      artifact: artifact.id,
      status: calib.calibrationStatus,
      scale: calib.calibrationScale,
      footprint: { width: footprint.x, depth: footprint.z },
      terrain: { width: terrainWidth, depth: terrainDepth },
    });

    // Fit dynamic shadows to artifact footprint and set preset
    this.fitShadowsToArtifact(terrainWidth, terrainDepth);
    this.applyLightingPreset(artifact.planet === 'mars' ? 'martian' : 'lunar');

    // Set authoritative hero camera views (calibrated to occupy 55-70% vertical height)
    this.heroView.position.set(calib.heroCamera.position[0], calib.heroCamera.position[1], calib.heroCamera.position[2]);
    this.heroView.target.set(calib.heroCamera.target[0], calib.heroCamera.target[1], calib.heroCamera.target[2]);
    this.guidedView.position.copy(this.heroView.position);
    this.guidedView.target.copy(this.heroView.target);

    if (this.debugScene) {
      this.updateDebugHelpersForArtifact();
    }

    if (skip) {
      this.finishArrival();
      return;
    }

    await this.executeCinematicArrival(revision, isCrossPlanet);
  }

  // ==========================================
  // COMPLETE CINEMATIC TRAVEL TRANSITION
  // ==========================================
  private executeCinematicArrival(revision: number, isCrossPlanet: boolean = false) {
    this.mode = 'TRAVEL';
    this.controls.enabled = false;
    this.setTravelStreaks(false);
    this.onBlackout?.(false, false);

    // Phase A: Orbital departure & approach
    this.activeSceneId = 'orbital';
    this.orbitalGroup.visible = true;
    this.surfaceGroup.visible = false;
    this.setActivePlanet(this.activePlanetId, false);
    this.applyLightingPreset('orbital');

    const timings = isCrossPlanet ? TRAVEL_CONFIG.crossPlanet : TRAVEL_CONFIG.samePlanet;
    const wideZ = this.activePlanetId === 'moon' ? 13.5 : 15.2;
    const planetGroup = this.activePlanetId === 'mars' ? this.marsGroup : this.moonGroup;
    planetGroup.scale.set(1, 1, 1);

    const enter = (state: 'DEPARTURE' | 'ACCELERATION' | 'APPROACH' | 'DESCENT' | 'BLACKOUT' | 'SCENE_SWAP' | 'REVEAL' | 'COMPLETED') => {
      if (revision !== this.assetRevision) return;
      this.onTravelState?.(state);
      console.info('[TRAVEL]', { fromArtifact: undefined, toArtifact: this.currentArtifactId, state, progress: this.timeline?.progress() ?? 0 });
    };

    return new Promise<void>(resolve => {
      let isDone = false;
      const onDone = () => {
        if (isDone) return;
        isDone = true;
        if (revision === this.assetRevision) {
          planetGroup.scale.set(1, 1, 1);
          this.finishArrival();
          enter('COMPLETED');
        }
        resolve();
      };

      this.timeline = gsap.timeline({ onComplete: onDone });

      const streakMat = this.travelPoints?.material instanceof THREE.LineBasicMaterial ? this.travelPoints.material : null;
      if (streakMat) streakMat.opacity = 0;

      // STAGE 1 — DEPARTURE: Smooth pull-away framing the full celestial sphere
      this.timeline
        .addLabel('departure')
        .call(() => enter('DEPARTURE'))
        .to(this.camera.position, {
          x: 0,
          y: 0.95,
          z: wideZ,
          duration: timings.departure,
          ease: 'power2.inOut',
          onUpdate: () => this.camera.lookAt(0, 0, 0),
        })
        .to(planetGroup.scale, {
          x: 1.0,
          y: 1.0,
          z: 1.0,
          duration: timings.departure,
        }, 'departure')

        // STAGE 2 — ACCELERATION: Steady forward push & progressive star streaks
        .addLabel('acceleration')
        .call(() => enter('ACCELERATION'));

      if (streakMat) {
        this.timeline.to(streakMat, {
          opacity: 0.85,
          duration: timings.acceleration * 0.75,
          ease: 'power2.in',
        }, 'acceleration');
      }

      this.timeline
        .to(this.camera.position, {
          x: 0,
          y: 0.65,
          z: 10.2,
          duration: timings.acceleration,
          ease: 'power2.in',
          onUpdate: () => this.camera.lookAt(0, 0, 0),
        }, 'acceleration')
        .to(planetGroup.scale, {
          x: 1.25,
          y: 1.25,
          z: 1.25,
          duration: timings.acceleration,
          ease: 'power2.in',
        }, 'acceleration')

        // STAGE 3 — DESTINATION APPROACH: Monotonic forward glide + realistic planet expansion
        .addLabel('approach')
        .call(() => enter('APPROACH'));

      if (streakMat) {
        this.timeline.to(streakMat, {
          opacity: 0.15,
          duration: timings.approach * 0.7,
          ease: 'power2.out',
        }, 'approach');
      }

      this.timeline
        .to(this.camera.position, {
          x: 0,
          y: 0.25,
          z: 6.6,
          duration: timings.approach,
          ease: 'power1.out',
          onUpdate: () => this.camera.lookAt(0, -0.2, 0),
        }, 'approach')
        .to(planetGroup.scale, {
          x: 2.75,
          y: 2.75,
          z: 2.75,
          duration: timings.approach,
          ease: 'power2.out',
        }, 'approach')

        // STAGE 4 — DESCENT WITH CAMERA VIBRATION: Horizon fills screen & touchdown rumble
        .addLabel('descent')
        .call(() => {
          enter('DESCENT');
          this.startLandingShake(TRAVEL_CONFIG.shake.amplitude, timings.descent + timings.blackoutFade * 0.45);
        });

      if (streakMat) {
        this.timeline.to(streakMat, {
          opacity: 0.0,
          duration: timings.descent * 0.5,
          ease: 'power2.out',
        }, 'descent');
      }

      this.timeline
        .to(this.camera.position, {
          x: 0,
          y: -0.2,
          z: 4.6,
          duration: timings.descent,
          ease: 'power2.in',
          onUpdate: () => this.camera.lookAt(0, -0.35, 0),
        }, 'descent')
        .to(planetGroup.scale, {
          x: 4.4,
          y: 4.4,
          z: 4.4,
          duration: timings.descent,
          ease: 'power2.in',
        }, 'descent')

        // STAGE 5 — PROGRESSIVE BLACKOUT & SCENE SWAP
        .addLabel('blackout')
        .call(() => {
          if (revision === this.assetRevision) {
            enter('BLACKOUT');
            this.onBlackout?.(true, false);
          }
        })
        .to({}, { duration: timings.blackoutFade })
        .addLabel('sceneSwap')
        .call(() => {
          enter('SCENE_SWAP');
          this.stopLandingShake();
          planetGroup.scale.set(1, 1, 1);
          this.activeSceneId = 'surface';
          this.orbitalGroup.visible = false;
          this.surfaceGroup.visible = true;
          this.setTravelStreaks(false);

          this.applyLightingPreset(this.activePlanetId === 'mars' ? 'martian' : 'lunar');

          console.info('[ACTIVE SCENE]', 'surface');
          console.info('[ACTIVE MODEL]', this.activeModelPath);

          // DIRECTOR'S ORBITAL TURNAROUND START:
          // Position camera at an elevated arc offset around the vehicle
          const hero = this.heroView;
          const dx = hero.position.x - hero.target.x;
          const dz = hero.position.z - hero.target.z;
          const dist = Math.max(2.2, Math.sqrt(dx * dx + dz * dz));
          const heroAzimuth = Math.atan2(dx, dz);
          const startAzimuth = heroAzimuth + 1.45; // ~83 degrees orbital offset

          this.camera.position.set(
            hero.target.x + Math.sin(startAzimuth) * (dist * 1.25),
            hero.position.y + 1.6,
            hero.target.z + Math.cos(startAzimuth) * (dist * 1.25)
          );
          this.cameraLookTarget.copy(hero.target);
          this.camera.lookAt(this.cameraLookTarget);
        })
        .to({}, { duration: timings.blackoutHold })

        // STAGE 6 — DESTINATION SCENE REVEAL & DRAMATIC ORBITAL TURNAROUND (~4s)
        .addLabel('reveal')
        .call(() => {
          if (revision === this.assetRevision) {
            this.onBlackout?.(false, false);
            enter('REVEAL');
          }
        });

      const hero = this.heroView;
      const dx = hero.position.x - hero.target.x;
      const dz = hero.position.z - hero.target.z;
      const dist = Math.max(2.2, Math.sqrt(dx * dx + dz * dz));
      const heroAzimuth = Math.atan2(dx, dz);
      const startAzimuth = heroAzimuth + 1.45;

      const orbitProxy = { progress: 0 };
      this.timeline
        .to(orbitProxy, {
          progress: 1,
          duration: timings.reveal,
          ease: 'power2.inOut',
          onUpdate: () => {
            const p = orbitProxy.progress;
            const currentAngle = THREE.MathUtils.lerp(startAzimuth, heroAzimuth, p);
            const currentDist = THREE.MathUtils.lerp(dist * 1.25, dist, p);
            const currentY = THREE.MathUtils.lerp(hero.position.y + 1.6, hero.position.y, p);
            this.camera.position.set(
              hero.target.x + Math.sin(currentAngle) * currentDist,
              currentY,
              hero.target.z + Math.cos(currentAngle) * currentDist
            );
            this.camera.lookAt(hero.target);
          },
        }, 'reveal')
        .fromTo(this.camera, { fov: 42 }, {
          fov: 38,
          duration: timings.reveal,
          ease: 'power2.out',
          onUpdate: () => this.camera.updateProjectionMatrix(),
        }, 'reveal');
    });
  }

  finishArrival() {
    this.stopLandingShake();
    this.cancelActiveTimeline();
    this.setTravelStreaks(false);

    this.moonGroup.scale.set(1, 1, 1);
    this.marsGroup.scale.set(1, 1, 1);
    this.earthGroup.scale.set(1, 1, 1);

    this.activeSceneId = 'surface';
    this.orbitalGroup.visible = false;
    this.surfaceGroup.visible = true;

    this.camera.fov = 38;
    this.camera.updateProjectionMatrix();

    this.camera.position.copy(this.heroView.position);
    this.cameraLookTarget.copy(this.heroView.target);
    this.camera.lookAt(this.cameraLookTarget);

    this.mode = 'HERO_REVEAL';
    this.controls.target.copy(this.heroView.target);
    this.onBlackout?.(false, false);
  }

  // ==========================================
  // SKIP, PAUSE, EXIT
  // ==========================================
  skipTravel() {
    this.finishArrival();
  }

  pauseCamera(paused: boolean) {
    if (paused) {
      this.timeline?.pause();
    } else {
      this.timeline?.resume();
    }
  }

  cancelJourney() {
    this.assetRevision++;
    this.transitionToken++;
    this.cancelActiveTimeline();
    this.rootTweenStop();
    this.controls.enabled = false;
    this.setTravelStreaks(false);
    this.stopLandingShake();
    this.moonGroup.scale.set(1, 1, 1);
    this.marsGroup.scale.set(1, 1, 1);
    this.earthGroup.scale.set(1, 1, 1);
    this.onBlackout?.(false, false);
  }

  private cancelActiveTimeline() {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = undefined;
    }
  }

  private rootTweenStop() {
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.cameraLookTarget);
  }

  private startLandingShake(amplitude: number, duration: number) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.shake.active = true;
    this.shake.start = performance.now();
    this.shake.duration = duration * 1000;
    this.shake.amplitude = amplitude;
  }

  private stopLandingShake() {
    if (this.shake.applied.lengthSq() > 0) this.camera.position.sub(this.shake.applied);
    if (this.shake.rotApplied.lengthSq() > 0) {
      this.camera.rotation.x -= this.shake.rotApplied.x;
      this.camera.rotation.y -= this.shake.rotApplied.y;
      this.camera.rotation.z -= this.shake.rotApplied.z;
    }
    this.shake.applied.set(0, 0, 0);
    this.shake.rotApplied.set(0, 0, 0);
    this.shake.active = false;
  }

  // ==========================================
  // CHAPTER SCROLL STORYTELLING
  // ==========================================
  setChapterProgress(index: number) {
    if (this.mode === 'INSPECTION' || this.mode === 'TRAVEL') {
      return;
    }

    this.mode = 'SCROLL_STORY';
    this.currentChapterIndex = THREE.MathUtils.clamp(index, 0, 4);

    const calib = this.currentCalibration;
    const targetShot = calib.chapterCameras[this.currentChapterIndex] ?? {
      position: [this.heroView.position.x, this.heroView.position.y, this.heroView.position.z],
      target: [this.heroView.target.x, this.heroView.target.y, this.heroView.target.z],
    };

    this.guidedView.position.set(targetShot.position[0], targetShot.position[1], targetShot.position[2]);
    this.guidedView.target.set(targetShot.target[0], targetShot.target[1], targetShot.target[2]);

    gsap.to(this.camera.position, {
      x: targetShot.position[0],
      y: targetShot.position[1],
      z: targetShot.position[2],
      duration: 1.1,
      ease: 'power2.inOut',
    });

    gsap.to(this.cameraLookTarget, {
      x: targetShot.target[0],
      y: targetShot.target[1],
      z: targetShot.target[2],
      duration: 1.1,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.camera.lookAt(this.cameraLookTarget);
        this.controls.target.copy(this.cameraLookTarget);
      },
    });
  }

  frameArtifact() {
    this.mode = 'SCROLL_STORY';
    gsap.to(this.camera.position, {
      x: this.heroView.position.x,
      y: this.heroView.position.y,
      z: this.heroView.position.z,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => this.camera.lookAt(this.heroView.target),
    });
  }

  framePlanet() {
    this.controls.enabled = false;
    this.mode = 'FINALE';
    this.activeSceneId = 'orbital';
    this.orbitalGroup.visible = true;
    this.surfaceGroup.visible = false;
    this.setActivePlanet(this.activePlanetId);

    gsap.to(this.camera.position, {
      x: 0,
      y: 0.35,
      z: 11.5,
      duration: 1.2,
      ease: 'power2.inOut',
      onUpdate: () => this.camera.lookAt(0, 0, 0),
    });
  }

  // ==========================================
  // INTERACTIVE INSPECTION MODE
  // ==========================================
  inspect() {
    this.cancelActiveTimeline();
    this.mode = 'INSPECTION';

    this.controls.target.copy(this.guidedView.target);
    this.controls.minDistance = 1.0;
    this.controls.maxDistance = 28.0;
    this.controls.enabled = true;
    this.controls.update();
  }

  resetView() {
    this.controls.target.copy(this.heroView.target);
    gsap.to(this.camera.position, {
      x: this.heroView.position.x,
      y: this.heroView.position.y,
      z: this.heroView.position.z,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => {
        this.camera.lookAt(this.heroView.target);
        this.controls.update();
      },
    });
  }

  returnGuided() {
    if (this.mode !== 'INSPECTION') return;
    this.controls.enabled = false;
    this.mode = 'SCROLL_STORY';

    gsap.to(this.camera.position, {
      x: this.guidedView.position.x,
      y: this.guidedView.position.y,
      z: this.guidedView.position.z,
      duration: 0.9,
      ease: 'power2.inOut',
      onUpdate: () => this.camera.lookAt(this.guidedView.target),
    });

    gsap.to(this.cameraLookTarget, {
      x: this.guidedView.target.x,
      y: this.guidedView.target.y,
      z: this.guidedView.target.z,
      duration: 0.9,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.controls.target.copy(this.guidedView.target);
      },
    });
  }

  // ==========================================
  // PARTICLES & STREAKS
  // ==========================================
  private createAmbientParticles() {
    const layers = [
      { count: 650, radius: 110, size: 0.08, speed: 0.0015, axis: 'y' as const, opacity: 0.55, color: 0xd8e6f8 },
      { count: 320, radius: 55, size: 0.12, speed: 0.003, axis: 'x' as const, opacity: 0.4, color: 0x86abd6 },
      { count: 85, radius: 24, size: 0.18, speed: 0.005, axis: 'z' as const, opacity: 0.3, color: 0xcbb68e },
    ];
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches;

    for (const layer of layers) {
      const count = isMobile ? Math.round(layer.count * 0.5) : layer.count;
      const arr = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        arr[i * 3] = (Math.random() - 0.5) * layer.radius * 2;
        arr[i * 3 + 1] = (Math.random() - 0.5) * layer.radius * 1.4;
        arr[i * 3 + 2] = (Math.random() - 0.5) * layer.radius * 2;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const points = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          color: layer.color,
          size: layer.size,
          transparent: true,
          opacity: layer.opacity,
          sizeAttenuation: true,
          depthWrite: false,
        })
      );
      this.scene.add(points);
      this.ambient.push({ points, speed: layer.speed, axis: layer.axis, span: layer.radius });
    }
  }

  private createTravelStreaks() {
    const count = 160;
    const positions = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 40;
      const y = (Math.random() - 0.5) * 26;
      const z = -Math.random() * 50;
      positions.set([x, y, z, x, y, z - 0.15], i * 6);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.travelPoints = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: 0xb5d8fa,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    this.scene.add(this.travelPoints);
  }

  private setTravelStreaks(active: boolean) {
    if (this.travelPoints?.material instanceof THREE.LineBasicMaterial) {
      gsap.to(this.travelPoints.material, {
        opacity: active ? 0.65 : 0,
        duration: active ? 0.25 : 0.45,
      });
    }
  }

  // ==========================================
  // DEBUG HUD (?debugScene=1)
  // ==========================================
  private initDebugTools() {
    const axes = new THREE.AxesHelper(4.0);
    const grid = new THREE.GridHelper(16, 16, 0x486484, 0x1f2e42);
    grid.position.y = 0;

    const targetMarkerGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const targetMarkerMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });
    this.debugTargetMarker = new THREE.Mesh(targetMarkerGeo, targetMarkerMat);

    this.scene.add(axes, grid, this.debugTargetMarker);
    this.debugHelpers.push(axes, grid, this.debugTargetMarker);

    this.debugOverlay = document.createElement('div');
    this.debugOverlay.id = 'scene-debug-hud';
    this.debugOverlay.style.cssText =
      'position:fixed;bottom:54px;left:14px;z-index:99999;background:rgba(2,6,12,0.92);' +
      'color:#00ffaa;font:11px/1.4 "DM Mono",monospace;padding:12px;border:1px solid #1f4233;' +
      'border-radius:4px;pointer-events:none;white-space:pre;backdrop-filter:blur(6px);';
    document.body.appendChild(this.debugOverlay);
  }

  private updateDebugHelpersForArtifact() {
    if (!this.debugScene) return;
    if (this.debugModelBoxHelper) {
      this.scene.remove(this.debugModelBoxHelper);
      this.debugModelBoxHelper.dispose();
      this.debugModelBoxHelper = undefined;
    }

    if (this.artifactModel) {
      const box = new THREE.Box3().setFromObject(this.artifactPlacementRoot);
      this.debugModelBoxHelper = new THREE.Box3Helper(box, new THREE.Color(0xffbb00));
      this.scene.add(this.debugModelBoxHelper);
    }
  }

  private updateDebugHUD() {
    if (!this.debugScene || !this.debugOverlay) return;

    if (this.debugTargetMarker) {
      this.debugTargetMarker.position.copy(this.cameraLookTarget);
    }

    const pos = this.camera.position;
    const tgt = this.cameraLookTarget;
    const cal = this.currentCalibration;

    this.debugOverlay.textContent =
      `[DEBUG SCENE HUD — ?debugScene=1]\n` +
      `Mode: ${this.mode}\n` +
      `Camera Pos: [${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}]\n` +
      `Camera Target: [${tgt.x.toFixed(2)}, ${tgt.y.toFixed(2)}, ${tgt.z.toFixed(2)}]\n` +
      `Active Planet ID: ${this.activePlanetId}\n` +
      `Active Scene: ${this.activeSceneId.toUpperCase()}\n` +
      `Active Model Path: ${this.activeModelPath || 'None'}\n` +
      `Active Artifact: ${this.currentArtifactId || 'None'} (Ch. ${this.currentChapterIndex + 1}/5)\n` +
      `Calibration Scale: ${cal.calibrationScale} (${cal.calibrationStatus})\n` +
      `Display Terrain: ${cal.terrainSpec.width}m × ${cal.terrainSpec.depth}m (rock count: ${cal.terrainSpec.rockCount})\n` +
      `Earth Visible: ${this.earthGroup.visible} | Moon Visible: ${this.moonGroup.visible} | Mars Visible: ${this.marsGroup.visible}`;
  }

  // ==========================================
  // RENDER LOOP & RESIZE
  // ==========================================
  render = (time = performance.now()) => {
    if (document.hidden) return;
    if (this.minimumFrameInterval && time - this.lastFrameTime < this.minimumFrameInterval) return;
    this.lastFrameTime = time;
    this.frame += 0.001;

    // A bounded, additive descent vibration (multi-axis physical signal with realistic landing envelope).
    if (this.shake.applied.lengthSq() > 0) this.camera.position.sub(this.shake.applied);
    if (this.shake.rotApplied.lengthSq() > 0) {
      this.camera.rotation.x -= this.shake.rotApplied.x;
      this.camera.rotation.y -= this.shake.rotApplied.y;
      this.camera.rotation.z -= this.shake.rotApplied.z;
    }
    this.shake.applied.set(0, 0, 0);
    this.shake.rotApplied.set(0, 0, 0);

    if (this.shake.active) {
      const elapsed = performance.now() - this.shake.start;
      const progress = THREE.MathUtils.clamp(elapsed / this.shake.duration, 0, 1);
      // Realistic landing envelope: rumble build-up -> thruster peak around 60% -> contact settling
      const envelope = Math.sin(Math.PI * Math.pow(progress, 0.85)) * (1.1 - progress * 0.35);
      const freq = TRAVEL_CONFIG.shake.frequency;
      const t = (elapsed * 0.001) * (2 * Math.PI * freq);
      const amp = this.shake.amplitude;

      this.shake.applied.set(
        Math.sin(t * 1.0) * amp * envelope,
        Math.sin(t * 1.34 + 0.5) * amp * 0.82 * envelope,
        Math.sin(t * 0.92 + 1.1) * amp * 0.55 * envelope,
      );
      this.shake.rotApplied.set(
        Math.sin(t * 0.88 + 0.25) * (amp * 0.042) * envelope,
        Math.cos(t * 1.12) * (amp * 0.032) * envelope,
        Math.sin(t * 1.42 + 0.75) * (amp * 0.058) * envelope,
      );

      this.camera.position.add(this.shake.applied);
      this.camera.rotation.x += this.shake.rotApplied.x;
      this.camera.rotation.y += this.shake.rotApplied.y;
      this.camera.rotation.z += this.shake.rotApplied.z;

      if (progress >= 1) this.shake.active = false;
    }

    // Gentle planetary rotation
    if (this.earthGroup.visible) this.earthGroup.rotation.y += 0.00025;
    if (this.moonGroup.visible) this.moonGroup.rotation.y += 0.00025;
    if (this.marsGroup.visible) this.marsGroup.rotation.y += 0.00025;

    // Gentle particle drift
    for (const layer of this.ambient) {
      const p = layer.points.position;
      p[layer.axis] += layer.speed;
      if (p[layer.axis] > layer.span) p[layer.axis] = -layer.span;
      if (p[layer.axis] < -layer.span) p[layer.axis] = layer.span;
    }

    // High speed travel streaks
    if (
      this.travelPoints &&
      this.travelPoints.material instanceof THREE.LineBasicMaterial &&
      this.travelPoints.material.opacity > 0.05
    ) {
      const arr = this.travelPoints.geometry.attributes.position as THREE.BufferAttribute;
      const isFast = this.travelPoints.material.opacity > 0.05;
      const speed = isFast ? 0.44 : 0.04;
      for (let i = 0; i < arr.count; i += 2) {
        let z = arr.getZ(i) + speed;
        if (z > 12) z = -55;
        arr.setZ(i, z);
        arr.setZ(i + 1, z - (isFast ? 1.3 : 0.15));
      }
      arr.needsUpdate = true;
    }

    if (this.controls.enabled) {
      this.controls.update();
    }

    if (this.debugScene) {
      this.updateDebugHUD();
    }

    this.renderer.render(this.scene, this.camera);
  };

  resize = () => {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (w > 900) {
      // Offset camera optical center by 14% to visually center 3D scene in the right 65-70% open space
      this.camera.setViewOffset(w, h, -w * 0.14, 0, w, h);
    } else {
      this.camera.clearViewOffset();
    }
    this.camera.updateProjectionMatrix();
  };

  dispose() {
    this.cancelJourney();
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.controls.dispose();

    if (this.debugOverlay?.parentElement) {
      this.debugOverlay.parentElement.removeChild(this.debugOverlay);
    }
    if (this.lightingPanel?.parentElement) this.lightingPanel.parentElement.removeChild(this.lightingPanel);

    this.scene.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          for (const value of Object.values(m)) {
            if (value instanceof THREE.Texture) value.dispose();
          }
          m.dispose();
        }
      }
    });

    this.scene.environment?.dispose();
    if (this.scene.background instanceof THREE.Texture) {
      this.scene.background.dispose();
    }
    this.renderer.dispose();
  }

  private disposeObject(object: THREE.Object3D) {
    object.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          for (const value of Object.values(m)) {
            if (value instanceof THREE.Texture) value.dispose();
          }
          m.dispose();
        }
      }
    });
  }
}
