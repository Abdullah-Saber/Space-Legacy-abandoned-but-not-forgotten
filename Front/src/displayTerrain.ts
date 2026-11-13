import * as THREE from 'three';
import type { World } from './tour';

export interface DisplayTerrainConfig {
  world: World;
  width: number;
  depth: number;
  height?: number;
  rockCount?: number;
  smoothingRadius?: number;
}

/**
 * Creates an authentic, irregular, procedural planetary display platform.
 * Explicitly identified as: illustrative-display-terrain.
 */
export function createArtifactDisplayTerrain(config: DisplayTerrainConfig): THREE.Group {
  const group = new THREE.Group();
  group.name = 'illustrative-display-terrain';
  group.userData = { type: 'illustrative-display-terrain', world: config.world };

  const isMars = config.world === 'mars';
  const width = config.width;
  const depth = config.depth;
  const height = config.height ?? Math.max(0.28, Math.min(width, depth) * 0.05);
  const rockCount = config.rockCount ?? 18;
  const flatZoneRadius = config.smoothingRadius ?? Math.min(width, depth) * 0.28;

  // 1. Generate Irregular Organic Polygon Grid
  const radialSegments = 32;
  const rings = 8;
  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];

  // Color Palettes
  // Lunar: Muted dusty gray-brown to cool rocky highlights
  const lunarBase = new THREE.Color(0x53575d);
  const lunarDust = new THREE.Color(0x777c83);
  const lunarHighlight = new THREE.Color(0x9da2a8);
  const lunarCrevice = new THREE.Color(0x303338);

  // Martian: Muted rusty red-brown to burnt orange dust
  const marsBase = new THREE.Color(0x6e3d2a);
  const marsDust = new THREE.Color(0x91523a);
  const marsHighlight = new THREE.Color(0xaf6b4b);
  const marsCrevice = new THREE.Color(0x432319);

  const baseCol = isMars ? marsBase : lunarBase;
  const dustCol = isMars ? marsDust : lunarDust;
  const highCol = isMars ? marsHighlight : lunarHighlight;
  const crevCol = isMars ? marsCrevice : lunarCrevice;

  // Center vertex (index 0)
  vertices.push(0, 0, 0);
  uvs.push(0.5, 0.5);
  colors.push(dustCol.r, dustCol.g, dustCol.b);

  // Concentric irregular rings
  for (let r = 1; r <= rings; r++) {
    const fraction = r / rings;
    for (let s = 0; s < radialSegments; s++) {
      const angle = (s / radialSegments) * Math.PI * 2;

      // Natural asymmetry modulation
      const wobble =
        1.0 +
        0.16 * Math.sin(3 * angle + 0.4) -
        0.11 * Math.cos(5 * angle + 1.2) +
        0.07 * Math.sin(7 * angle - 0.8);

      const rx = (width * 0.5) * fraction * wobble;
      const rz = (depth * 0.5) * fraction * wobble;

      const x = Math.cos(angle) * rx;
      const z = Math.sin(angle) * rz;
      const distFromCenter = Math.sqrt(x * x + z * z);

      // Height variation: completely flat in center landing zone, gently uneven toward perimeter
      const outerInfluence = Math.max(0, (distFromCenter - flatZoneRadius) / (width * 0.5));
      const naturalNoise =
        Math.sin(x * 0.45 + z * 0.3) * 0.12 +
        Math.cos(z * 0.55 - x * 0.35) * 0.09 +
        Math.sin((x + z) * 0.8) * 0.05;

      const y = naturalNoise * Math.min(1.0, outerInfluence * 1.5);

      vertices.push(x, y, z);
      uvs.push(x / width + 0.5, z / depth + 0.5);

      // Vertex color blending based on height and outer slope
      const col = new THREE.Color().copy(baseCol);
      if (y > 0.04) {
        col.lerp(highCol, Math.min(1, y * 4.0));
      } else if (y < -0.04) {
        col.lerp(crevCol, Math.min(1, -y * 4.0));
      } else {
        col.lerp(dustCol, 0.45);
      }
      colors.push(col.r, col.g, col.b);
    }
  }

  // Triangles for center fan (ring 0 to ring 1)
  for (let s = 0; s < radialSegments; s++) {
    const nextS = (s + 1) % radialSegments;
    indices.push(0, 1 + s, 1 + nextS);
  }

  // Triangles between concentric rings
  for (let r = 1; r < rings; r++) {
    const currentRingStart = 1 + (r - 1) * radialSegments;
    const nextRingStart = 1 + r * radialSegments;
    for (let s = 0; s < radialSegments; s++) {
      const nextS = (s + 1) % radialSegments;
      const i0 = currentRingStart + s;
      const i1 = nextRingStart + s;
      const i2 = nextRingStart + nextS;
      const i3 = currentRingStart + nextS;

      indices.push(i0, i1, i2);
      indices.push(i0, i2, i3);
    }
  }

  // 2. Skirt / Cliff Edges (dropping perimeter down to -height)
  const outerRingStart = 1 + (rings - 1) * radialSegments;
  const bottomRingStart = vertices.length / 3;

  for (let s = 0; s < radialSegments; s++) {
    const topIdx = outerRingStart + s;
    const x = vertices[topIdx * 3];
    const z = vertices[topIdx * 3 + 2];
    // Cliff base pulled slightly inward for rocky overhang
    vertices.push(x * 0.96, -height, z * 0.96);
    uvs.push(x / width + 0.5, z / depth + 0.5);
    colors.push(crevCol.r * 0.85, crevCol.g * 0.85, crevCol.b * 0.85);
  }

  for (let s = 0; s < radialSegments; s++) {
    const nextS = (s + 1) % radialSegments;
    const top0 = outerRingStart + s;
    const top1 = outerRingStart + nextS;
    const bot0 = bottomRingStart + s;
    const bot1 = bottomRingStart + nextS;

    indices.push(top0, bot0, bot1);
    indices.push(top0, bot1, top1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: isMars ? 0.96 : 0.94,
    metalness: isMars ? 0.02 : 0.04,
    flatShading: true,
  });

  const terrainMesh = new THREE.Mesh(geometry, material);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  group.add(terrainMesh);

  // 3. Scatter Low-Poly Boulders along perimeter (outside landing footprint)
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: isMars ? 0x4a2416 : 0x36393e,
    roughness: 0.92,
    metalness: 0.05,
    flatShading: true,
  });

  const rockGeo = new THREE.DodecahedronGeometry(1.0, 0);

  for (let i = 0; i < rockCount; i++) {
    const rock = new THREE.Mesh(rockGeo, rockMaterial.clone());
    const angle = (i / rockCount) * Math.PI * 2 + (i % 3) * 0.25;
    // Position rocks along the outer 45%-85% perimeter
    const distFraction = 0.52 + (i % 5) * 0.08;
    const rx = (width * 0.5) * distFraction * Math.cos(angle);
    const rz = (depth * 0.5) * distFraction * Math.sin(angle);

    const baseScale = Math.min(width, depth) * (0.025 + (i % 4) * 0.015);
    rock.scale.set(
      baseScale * (1 + (i % 2) * 0.35),
      baseScale * (0.7 + (i % 3) * 0.3),
      baseScale * (1 + (i % 4) * 0.25)
    );

    rock.rotation.set((i * 1.3) % Math.PI, (i * 2.1) % Math.PI, (i * 0.7) % Math.PI);
    rock.position.set(rx, -height * 0.15 + (i % 3) * 0.02, rz);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  return group;
}
