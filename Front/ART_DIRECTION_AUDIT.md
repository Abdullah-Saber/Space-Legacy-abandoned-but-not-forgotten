# ART DIRECTION AUDIT
## Abandoned but Not Forgotten — NASA Space Apps Challenge 2026
### Inspection Date: 2026-11-13
### Inspector: Scene Director / Technical Art Director

---

## EXECUTIVE SUMMARY

The project has a solid structural foundation: the React/GSAP/Three.js architecture is clean, the asset lifecycle (revision system) is correctly implemented, and the tour logic is sound. The principal art-direction problems are concentrated in `SpaceScene.ts` and fall into three clusters: (1) every loaded artifact model is subjected to identical arbitrary scale, rotation, and camera-distance values regardless of the model's actual geometry, guaranteeing mis-sized or awkwardly framed spacecraft for most artifacts; (2) the ambient particle system distributes all particles exclusively on the negative-Z side of the camera, leaving the star field looking flat and one-sided; and (3) the cinematic arrival sequence is minimal — a straight-line camera move with a crude blackout gate — producing no sense of planetary approach or spatial depth.

---

## PART 1 — COORDINATE AND SCALE SYSTEM

### 1.1 World Coordinate Convention

**SpaceScene.ts** operates in a right-handed Three.js world space (X right, Y up, Z toward viewer). The camera begins at `(0, 0, 16)` (line 51) and targets the origin. Artifact models are centered on the origin via bounding-box subtraction (line 147), then placed into `artifactGroup` which sits at `(0, −0.2, 0)` (line 159). Landing sites are placed into `landingGroup` and pushed to `y = −2.0` after centering (line 154). Planets live in `this.planet` group and are positioned individually per mode.

The convention itself is unambiguous and consistent. The problems are downstream in how objects are scaled and placed within that convention.

### 1.2 Model Scaling Problems

**SpaceScene.ts:148**
```typescript
const fit = artifact.fitSize ?? 2.3;
model.scale.setScalar(fit / Math.max(size.x, size.y, size.z, 0.001));
```

This formula scales every model so that its **longest axis** equals `fitSize` scene units. This is a universal, one-dimensional rule applied identically to all artifacts regardless of geometry. Problems:

- The Apollo 11 Lunar Module (`fitSize: 2.9`) is a tall, complex structure with ascent and descent stages. Its longest axis (probably height) may be Y, so width and depth are compressed arbitrarily relative to scene scale.
- The Sojourner rover (`fitSize: 2.0`) is a very small, flat vehicle. Forcing it to `2.0` on its longest axis will make it appear disproportionately large relative to its landing site and planet.
- The MER rovers (Spirit, Opportunity, `fitSize: 2.4`) are a single-mesh model with 9 materials. Its correct scene size relative to a 35.2 MB terrain mesh is unknown until loaded.
- The LRV rover (`fitSize: 2.1`) is wide and low; the formula does not account for aspect ratio, so it may appear taller or shorter than intended.

**Confirmed visual problem** (derivable from code without browser): all models will be scaled to nearly the same visible size regardless of real-world proportion differences between a compact rover, a tall lander, and a wide car.

**SpaceScene.ts:154**
```typescript
site.scale.setScalar(12 / Math.max(size.x, size.y, size.z, 0.001));
```

Same pattern for landing sites: the target extent is universally `12` scene units on the longest axis. The Apollo 11 landing site (20.8 MB, 6 meshes) and the Spirit site (35.2 MB, 1 mesh) will both be scaled to roughly the same 12-unit footprint, regardless of their actual terrain geometry and resolution.

### 1.3 Landing Site Grounding

**SpaceScene.ts:154**
```typescript
site.position.y = -2.0;
```

After bounding-box centering (line 153: `site.position.sub(bounds.getCenter(...))`), the site mesh is at the origin. Then `y = −2.0` is applied as a universal vertical offset for all terrain meshes regardless of their actual vertical extent or where the natural ground plane sits in their authored coordinate space. A site whose geometric center is at the centroid of its bounding box may have its surface anywhere from `−2 ± (height/2)` scene units, so the spacecraft model — which is centered at origin and scaled to ~2.3–2.9 units — may appear embedded in terrain, floating above it, or sitting on empty air.

**Confirmed problem** (structural): since terrain scale is normalized to 12 units on its longest axis (which for a wide terrain is usually X or Z), the vertical extent (`size.y`) after scaling could be as small as a fraction of a unit or as large as 12 units depending on the mesh's proportions. The fixed `−2.0` offset is not derived from the actual post-scale terrain height.

### 1.4 Planet Positioning

The planet group uses three modes:

**intro-scroll (`setIntroProgress`, lines 215–218):** Planet positions are linearly interpolated between hardcoded `start` and `end` world-space coordinates as a function of scroll progress `[0, 1]`. Earth travels from `[−4, 0, −4]` to `[−14, 1, −25]`, Moon from `[9, 0.2, −19]` to `[0, 0, −5]`, Mars from `[18, 2, −42]` to `[−5, 0, −11]`. All three are always visible and moving simultaneously, which is the intended artistic effect. **Correct by design.**

**destination / world-selection (`showWorldSelection`, line 128–129):** Hardcoded placements: Earth `(−5, 1, −12)`, Moon `(−2, 0, −6)`, Mars `(3.5, 0.5, −7)`. Planet bodies are scaled to `0.8`. **No structural problems; the values are art decisions.**

**artifact / destination (`setDestination`, line 122):** The active planet is repositioned to `(0, 0, −7)` at scale `1.0`. All other planets are hidden. The `frameArtifact` method (line 200) tweens planet scale to `0.58` to push it back visually. **No structural problem; the approach is intentional.** Slight concern: `framePlanet` (line 201) scales back to `1.0` and moves camera to `z: 11`, but there's no explicit lookAt update during this tween — the `onUpdate` callback is absent, so the camera will not track the planet center during animation. **Suspected visual problem** (requires browser validation).

---

## PART 2 — ACTIVE SPACECRAFT LIFECYCLE

### 2.1 Asset Cleanup

**SpaceScene.ts:135–157** — The revision system is correctly implemented.

```typescript
const revision = ++this.assetRevision;          // line 135
// ...both loads are awaited...
if (revision !== this.assetRevision) {           // line 142
    if (modelResult.status === 'fulfilled' && modelResult.value)
        this.disposeObject(modelResult.value.scene);
    if (siteResult.status === 'fulfilled' && siteResult.value)
        this.disposeObject(siteResult.value.scene);
    return;
}
this.clearGroup(this.artifactGroup);             // line 143
this.clearGroup(this.landingGroup);
this.artifactModel = undefined;
```

The check at line 142 discards both model and site if the revision has advanced (i.e., user navigated away during load). `clearGroup` (line 268) calls `disposeObject` on each child before removal, so geometry and textures are freed. The two simultaneous `Promise.allSettled` calls (line 141) mean both assets load in parallel and neither is added to the scene until both have resolved. **This is correct. Do not change.**

One edge case: if `revision !== this.assetRevision` after the await, the code returns immediately at line 142 without calling `clearGroup`. This means stale model objects from a previous `showArtifact` call that completed before the guard check might still be in `artifactGroup`/`landingGroup`. However, the next valid `showArtifact` call that passes the guard will call `clearGroup` on those groups at line 143, so stale objects are cleaned up on the next valid arrival. **Low-risk; not a memory leak.**

### 2.2 Duplicate Spacecraft Risk

**catalog.ts:8–9** (Spirit and Opportunity both reference the same GLB):
```typescript
model: '/Models/Mars-missions-models/Spirit & Opportunity-missions/24883_MER_static.glb'
```

**catalog.ts:8:** Spirit — `fitSize: 2.4`, own environment GLB
**catalog.ts:9:** Opportunity — `fitSize: 2.4`, own environment GLB (different file)

Since `fitSize` is identical for both artifacts, both will be scaled and displayed identically. The model itself — a single mesh with 9 materials — will be loaded twice (once per artifact visit) but each time it creates a new GLTF parse; there is no model-level cache in the code. This is a performance note, not a visual error: the user will never see Spirit and Opportunity at the same time, so visual confusion is not a risk. The moral problem is artistic authenticity — the same model serves two distinct spacecraft. This is disclosed in `modelNote` on both catalog entries. **No code bug; documented limitation.**

### 2.3 Surveyor 3 Fallback

**catalog.ts:5:** Surveyor 3 has no `model` or `environment` property.

**SpaceScene.ts:139:**
```typescript
const modelPromise = artifact.model
    ? this.loadGLTF(`artifact-${artifact.id}`, artifact.model)
    : Promise.resolve(undefined);
```

**SpaceScene.ts:144:**
```typescript
if (!artifact.model)
    this.publishAsset({
        id: `artifact-${artifact.id}`,
        path: '(missing by project design)',
        status: 'missing',
        error: 'Authentic model not available; the record remains explorable.'
    });
```

**SpaceScene.ts:158:**
```typescript
if (!artifact.environment && artifact.model)
    this.landingGroup.add(this.createIllustrativeSurface(artifact.planet));
```

Surveyor 3 has neither `model` nor `environment`, so: no model is loaded (correct), `missing` status is published (correct), and the illustrative surface is NOT created (line 158 guard: `!artifact.environment && artifact.model` — both conditions fail). This means the Surveyor 3 scene has empty `artifactGroup` and `landingGroup` — the viewport shows only the Moon planet body and the EXR background. **This is intentional by design but results in a visually sparse scene.** No fallback atmospheric surface is shown for Surveyor 3. Consider adding a Moon illustrative surface even when `artifact.model` is absent, if `artifact.planet === 'Moon'`.

---

## PART 3 — CAMERA SYSTEM

### 3.1 Camera Director Analysis

Locations that directly set `camera.position`:

| File:Line | Context | Method |
|-----------|---------|--------|
| `SpaceScene.ts:51` | Constructor initialization | `camera.position.set(0, 0, 16)` |
| `SpaceScene.ts:118` | `setDestination()` | `camera.position.set(0, 0.4, 12)` |
| `SpaceScene.ts:130` | `showWorldSelection()` | `camera.position.set(0, 1, 13)` |
| `SpaceScene.ts:189` | `cinematicArrival()` GSAP tween | `gsap.to(camera.position, {z: 17})` |
| `SpaceScene.ts:192` | `cinematicArrival()` GSAP tween | `gsap.to(camera.position, {z: targetZ})` |
| `SpaceScene.ts:197` | `finishArrival()` | `camera.position.copy(artifactView.position)` |
| `SpaceScene.ts:214` | `setIntroProgress()` | `camera.position.set(c[0], c[1], c[2])` |
| `SpaceScene.ts:224` | `setChapterProgress()` | `camera.position.set(x, 2.15+…, z−…)` |
| `SpaceScene.ts:229` | `resetView()` | `camera.position.copy(artifactView.position)` |
| `SpaceScene.ts:230` | `returnGuided()` GSAP tween | `gsap.to(camera.position, {…})` |

There is no single Camera Director class. Camera state is managed by ad-hoc per-method calls and two GSAP tweens. The `mode` enum (`CameraMode`) provides guard rails in `setChapterProgress` (line 222) and `returnGuided` (line 230), but most direct position sets have no mode guard.

### 3.2 Chapter Camera Conflicts

**SpaceScene.ts:221–225:**
```typescript
setChapterProgress(index: number) {
    if (this.mode === 'inspection' || this.mode === 'cinematic') return;
    this.mode = 'chapter-scroll';
    const offsets = [-0.55, 0, 0.65, 0.2, -0.35];
    const x = offsets[index] ?? 0;
    this.camera.position.set(x, 2.15 + (index === 2 ? .55 : 0), this.artifactView.position.z - (index === 3 ? .7 : 0));
    this.camera.lookAt(this.artifactView.target);
    this.artifactGroup.rotation.y = x * 0.18;
}
```

**Three confirmed conflicts:**

1. **Instant position set vs. GSAP tweens:** The position is set via direct assignment with no tween or easing. If `frameArtifact()` (line 200) is running a GSAP tween on `camera.position` at the same time, `setChapterProgress` immediately overwrites the tween's target, causing a jump. `rootTweenStop()` (line 234) does not kill tweens on `camera.position`; it only kills `camera.position`, `planet.scale`, and `artifactGroup.position` — but this is called only in `setDestination`, `showWorldSelection`, and `showArtifact`, not from `setChapterProgress`.

2. **`artifactGroup.rotation.y` manipulation (line 225):** The render loop at line 260 also applies a continuous oscillation: `this.artifactGroup.rotation.y += this.mode === 'inspection' ? 0 : Math.sin(this.frame) * 0.0001`. Every frame, this rotation is incremented, but `setChapterProgress` re-sets it to an absolute value `x * 0.18`. Depending on call frequency, this produces a subtle jitter — the group snaps to `x * 0.18` on scroll, then drifts by the render-loop oscillation. **Confirmed problem** — the oscillation is overwritten on every chapter change, then re-accumulated.

3. **OrbitControls conflict:** When mode is `inspection`, `controls.enabled = true`. `setChapterProgress` guards against `inspection` mode (line 222), so there is no chapter-change conflict during inspection. However, calling `frameArtifact()` (line 200) while `controls.enabled = true` (e.g., user starts inspecting then UI fires a chapter change) could leave both GSAP and OrbitControls fighting over `camera.position`. The guard only applies to `setChapterProgress`; `frameArtifact` has no such guard.

### 3.3 Cinematic Arrival

**SpaceScene.ts:183–194:**
```typescript
private cinematicArrival(artifact: Artifact, revision: number) {
    this.mode = 'cinematic'; this.controls.enabled = false;
    this.setTravel(true); this.onBlackout?.(false, false);
    const targetZ = Math.max(5, (artifact.fitSize ?? 2.3) * 2.55);
    return new Promise<void>(resolve => {
        let done = false;
        const complete = () => { if (done) return; done = true; if (revision === this.assetRevision) this.finishArrival(); resolve(); };
        this.timeline = gsap.timeline({ onComplete: complete })
            .to(this.camera.position, { x: 0, y: 1, z: 17, duration: 1.35, ease: 'power2.in' })
            .to({}, { duration: 0.05, onStart: () => { if (revision === this.assetRevision) this.onBlackout?.(true, false); } })
            .to({}, { duration: 0.75 })
            .to(this.camera.position, { x: 0, y: 2.4, z: targetZ, duration: 1.7, ease: 'power3.out' })
            .to(this.camera.position, { y: this.artifactView.position.y, duration: 0.25, ease: 'power1.out' });
    });
}
```

**Weaknesses:**

1. **No `camera.lookAt` during travel.** The timeline tweens `camera.position` only. During the approach segments, the camera does not update its lookAt, so the scene's orientation during the blackout and emergence is whatever it was at the end of the previous state. The spacecraft may appear off-center at first reveal.

2. **Camera goes backward before going forward.** Step 1 pushes `z: 17` (further away), then after the blackout, step 4 pulls to `targetZ` (closer). The "pull-back before approach" is an intentional cinematic beat. However, the ease is `power2.in` (accelerating into the pullback) and `power3.out` (decelerating into the landing) with no spring or overshoot — the motion is functionally a linear sequence of two camera pops with easing caps. There is no arc, no lateral drift, no planet framing pass.

3. **`targetZ` uses `fitSize`, not actual bounding sphere.** `targetZ = Math.max(5, fitSize * 2.55)` mirrors the `artifactView` calculation. If the model's actual visible radius differs substantially from `fitSize`-derived expectation (which it will, given the universal scaling issues in §1.2), the camera arrives at the wrong distance.

4. **Blackout timing is fragile.** The blackout fires on the `onStart` of a 0.05-second empty tween (line 190). If GSAP's tick rate slips under heavy load, this effectively-instantaneous beat may fire early or late relative to the camera pull-back. A `delay` on the blackout tween would be more reliable than a chained empty duration.

5. **Travel streaks (`setTravel(true)`) are activated but `camera.lookAt` is never called during the streak phase.** The streaks move in world space but the camera is not explicitly looking forward, so the visual direction of streaks may be misaligned with the camera's actual forward vector.

### 3.4 Intro Scroll

**SpaceScene.ts:203–218 (`setIntroProgress`):**

The function uses a 7-frame keyframe system (frames at progress 0, 0.17, 0.34, 0.51, 0.68, 0.84, 1.0) linearly interpolated by progress. Camera position (`c`) and lookAt target (`t`) are both lerped. Planet positions are lerped from `start` to `end` linearly across the full `[0,1]` progress range, independent of camera keyframes.

**What is correct:**
- The camera position lerp correctly finds the right segment via the while loop (line 212) rather than a fixed segment index.
- Planet position lerp gives each body a smooth, independent drift arc.
- `controls.enabled = false` on every call prevents OrbitControls interference.

**What is weak:**
- Camera and planet interpolation use **linear** lerp (`vectors` helper, line 14). There is no easing between keyframes — each transition is linear, so the camera speed changes abruptly at each keyframe boundary (a classic keyframe crease). The perceived motion will stutter at progress = 0.17, 0.34, 0.51, 0.68, 0.84.
- `camera.position.set` and `camera.lookAt` are called directly (line 214), which is correct for a scroll-driven system that requires frame-exact positions. No bug here, but the linear interpolation between keyframes is the artistic weakness.
- Planet lerp (line 218) uses the global progress `[0,1]`, not per-segment local progress. All three planets drift at the same rate regardless of which camera segment is active. This is a deliberate simplification but means planet and camera framing are not choreographed per-beat.

---

## PART 4 — LIGHTING AND RENDERING

### 4.1 Renderer Configuration

**SpaceScene.ts:43–48:**
```typescript
this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
this.renderer.outputColorSpace = THREE.SRGBColorSpace;
this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
this.renderer.toneMappingExposure = 0.95;
this.renderer.shadowMap.enabled = true;
this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

| Setting | Value | Assessment |
|---------|-------|------------|
| `antialias` | `true` | Correct — avoids aliasing on model edges. |
| `alpha` | `false` | Correct — the canvas is not composited over a DOM background. |
| `setPixelRatio` | `min(dpr, 1.65)` | Reasonable cap. Standard cap is 2.0; 1.65 trades a small amount of sharpness for performance. **Acceptable.** |
| `outputColorSpace` | `THREE.SRGBColorSpace` | **Correct** — required for physically accurate color output with PBR materials. |
| `toneMapping` | `ACESFilmicToneMapping` | **Correct** — industry-standard filmic tone map, appropriate for a space scene with high dynamic range environment. |
| `toneMappingExposure` | `0.95` | Slightly under-exposed (1.0 = neutral). Appropriate for space (dark background, bright highlights). **Acceptable.** |
| `shadowMap.enabled` | `true` | Enabled. Only the `sun` DirectionalLight (line 55) is configured with `castShadow: true`. Landing site meshes are configured `receiveShadow = true` (line 155). **Correct** but shadows are only cast by the DirectionalLight, not the HemisphereLight (which cannot cast shadows by design in Three.js). |
| `shadowMap.type` | `PCFSoftShadowMap` | **Correct** — softer penumbrae appropriate for the diffused lighting of a space scene. |

**No critical problems in renderer configuration.**

### 4.2 Lighting Setup

**SpaceScene.ts:54–56:**
```typescript
this.scene.add(new THREE.HemisphereLight(0xaac6e6, 0x15100d, 1.35));
const sun = new THREE.DirectionalLight(0xffefd8, 3.2);
sun.position.set(-7, 8, 9); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
const rim = new THREE.DirectionalLight(0x75a6d9, 1.4);
rim.position.set(7, -2, -5);
```

| Light | Type | Color | Intensity | Assessment |
|-------|------|-------|-----------|------------|
| Hemisphere | `HemisphereLight` | sky `#aac6e6` / ground `#15100d` | 1.35 | Sky is a cool blue-grey (ambient sky light), ground is near-black warm (heat/shadow). Appropriate for space with EXR. The intensity of 1.35 is moderate — will lift shadows without washing out the sun. **Correct.** |
| Sun | `DirectionalLight` | `#ffefd8` (warm white/cream) | 3.2 | High-contrast key light from upper-left-front. Shadow map at 1024×1024. **Shadow map resolution is low** — for a 3D museum with detailed models this may show blocky shadow edges on the terrain. 2048×2048 would be significantly better. **Minor problem.** |
| Rim | `DirectionalLight` | `#75a6d9` (cool blue) | 1.4 | Back-right fill light. No shadow. Blue-tinted rim is a cinematic technique appropriate for space to separate subjects from dark backgrounds. **Correct.** |

**No critical problems. Shadow map resolution is a quality improvement opportunity.**

### 4.3 EXR Environment

**SpaceScene.ts:89–97:**
```typescript
const texture = await new EXRLoader().loadAsync(path);
texture.mapping = THREE.EquirectangularReflectionMapping;
texture.colorSpace = THREE.LinearSRGBColorSpace;
this.scene.environment = texture;
this.scene.background = texture;
```

| Property | Value | Assessment |
|----------|-------|------------|
| `EXRLoader` | Correct class | HDR format requires EXRLoader. **Correct.** |
| `mapping` | `EquirectangularReflectionMapping` | **Correct** for a 4096×2048 lat-long starmap. This mapping is used both as a background panorama and as an IBL (image-based lighting) environment map. |
| `colorSpace` | `THREE.LinearSRGBColorSpace` | **Correct** — EXR files are HDR linear data; setting linear color space prevents double gamma correction when the renderer processes it. |
| `scene.environment` | set to texture | **Correct** — this enables IBL for all PBR materials in the scene. |
| `scene.background` | set to texture | **Correct** — renders the starmap as the visible background. |

**No problems. The EXR loading is correctly implemented.**

**Note:** `scene.background` is initialized to `new THREE.Color('#03060d')` (line 50) as a fallback, then overwritten with the EXR texture on successful load (line 94). On load failure (line 96), it falls back to `#060b14`. Both fallbacks are intentional. **Correct.**

### 4.4 Material Handling

**SpaceScene.ts:166–169 (`surfaceMaterial`):**
```typescript
private surfaceMaterial(material: THREE.Material) {
    const copy = material.clone();
    if ('roughness' in copy) (copy as THREE.MeshStandardMaterial).roughness = 0.95;
    if ('metalness' in copy) (copy as THREE.MeshStandardMaterial).metalness = 0.02;
    return copy;
}
```

This is applied to landing site meshes (line 155) but **not** to spacecraft models. Issues:

1. **Material clone creates a texture reference, not a texture copy.** `material.clone()` in Three.js clones the material but does not deep-clone its texture references. The cloned material points to the same `THREE.Texture` objects. When `disposeObject` is later called (line 267), it disposes textures on each mesh material — if both the original and clone share texture objects, disposing one also disposes the other's textures. For landing sites loaded via GLTF, the original `modelResult.value.scene` is not separately tracked after `clearGroup` runs on `landingGroup`. Since `clearGroup` disposes the site entirely at the start of `showArtifact`, this is not a live bug, but it is a subtle correctness concern for future material reuse.

2. **Universal roughness/metalness overrides.** Setting `roughness: 0.95` and `metalness: 0.02` for all landing site materials overrides any authored material values in the GLB. For the Apollo 11 site (1 material, 1 texture) and Spirit/Opportunity sites (1 material, no textures), this may lose authored metalness or roughness values. **Confirmed override** — not necessarily wrong for terrain, but it removes the ability to have varied surface finishes across mission sites.

3. **Not applied to spacecraft models.** Spacecraft models retain their original authored materials. This is correct — spacecraft should not be forced to 95% rough.

---

## PART 5 — SCENE COMPOSITION

### 5.1 ArtifactGroup and LandingGroup Structure

**SpaceScene.ts:22–23:**
```typescript
landingGroup = new THREE.Group();
artifactGroup = new THREE.Group();
```

Both groups are added to the scene at construction (line 52) and persist for the lifetime of the `SpaceScene` instance. Their contents are cleared and replaced on each `showArtifact` call (line 143).

`artifactGroup` holds the spacecraft model only. It is positioned at `(0, −0.2, 0)` (line 159) and receives:
- Render-loop oscillation: `rotation.y += Math.sin(this.frame) * 0.0001` (line 260, only when not in inspection mode)
- Chapter-scroll override: `rotation.y = x * 0.18` (line 225)

`landingGroup` holds the terrain/environment site (or illustrative surface). It is not positioned or rotated programmatically after placement; the terrain sits at the position resulting from `site.position.sub(centroid)` + `y = −2.0` (line 153–154).

**Problem:** The two groups are siblings in the scene graph. Rotating `artifactGroup` (chapter progress, oscillation) does not rotate the terrain. This means the spacecraft can be seen at angles that reveal a mismatch between the spacecraft's orientation relative to the terrain. For the Apollo 11 lander, which has an authored landing-pad orientation, rotating the model while the terrain is static could expose an implausible angle.

**Correct aspect:** Keeping them as separate groups is the right architecture for independent camera framing of model vs. terrain. The rotation problem is a usage issue, not a structure issue.

### 5.2 Camera Framing

**SpaceScene.ts:160–161:**
```typescript
this.artifactView.position.set(0, 2.4, Math.max(5.2, (artifact.fitSize ?? 2.3) * 2.55));
this.artifactView.target.set(0, -0.05, 0);
```

The camera Z is `max(5.2, fitSize × 2.55)`. For:
- Eagle (fitSize 2.9): Z = max(5.2, 7.395) = **7.395**
- LRV (fitSize 2.1): Z = max(5.2, 5.355) = **5.355**
- Sojourner (fitSize 2.0): Z = max(5.2, 5.1) = **5.2**
- Spirit/Opportunity (fitSize 2.4): Z = max(5.2, 6.12) = **6.12**
- Surveyor 3 (no model, default 2.3): Z = max(5.2, 5.865) = **5.865**

The formula does not use the model's actual post-scale bounding sphere. Since all models are scaled to have their longest axis = `fitSize`, the visible angular extent at the computed Z depends on which axis is longest. A tall model (Eagle) might appear small at Z=7.4 if its depth was the longest axis, not its height. A wide model (LRV) might be clipped if its width was not the longest axis used for scaling. **Confirmed framing problem** for models where the dominant axis is not aligned with the camera-visible face.

The `cameraY = 2.4` is universal. No per-artifact vertical offset. For a low rover (Sojourner), `y = 2.4` places the camera above-and-behind, looking slightly down — the top of the vehicle dominates rather than the camera-facing side. For a tall lander (Eagle), `y = 2.4` might clip the top.

### 5.3 Planetary Intro Composition

**SpaceScene.ts:215–218:** All three planets are visible simultaneously during the intro. Their positions are:

```typescript
Earth: start [-4, 0, -4] → end [-14, 1, -25]
Moon:  start [9, 0.2, -19] → end [0, 0, -5]
Mars:  start [18, 2, -42] → end [-5, 0, -11]
```

The planet bodies are scaled per `loadPlanet` (desiredDiameter 3.5 for Moon, 4.2 for others), so the larger planet scale makes them all visible from various distances. During the intro, Moon approaches (Z goes from −19 to −5) while Earth recedes (Z goes from −4 to −25). Mars starts very far and closes slightly. This creates a sense of spatial traversal. **Correct by design.**

**Minor note:** At progress = 0 (initial view), Earth is at `(−4, 0, −4)` with the camera at `(0, 0, 17)`. Earth is only 13 units in front of the camera at a Z delta of −4 relative to camera — it will be large and close in the left portion of frame. Mars is at `(18, 2, −42)` — behind the camera's Z range, and very far off-axis. Mars will not be clearly visible in the opening shot unless the camera is panned, which it is not at progress=0. **Suspected visual concern** (requires browser validation).

---

## PART 6 — SCROLL AND GSAP SYSTEM

### 6.1 Intro ScrollTrigger

**App.tsx:116–128:**
```typescript
useLayoutEffect(() => {
    if (stage !== 'intro' || !introScroll.current) return;
    const scroller = introScroll.current;
    scene.current?.setIntroProgress(0);
    const ctx = gsap.context(() => {
        gsap.to({ progress: 0 }, {
            progress: 1, ease: 'none',
            onUpdate: function () { scene.current?.setIntroProgress(this.targets()[0].progress); },
            scrollTrigger: {
                trigger: scroller.querySelector('.intro-track'),
                scroller, start: 'top top', end: 'bottom bottom', scrub: .8
            }
        });
        gsap.utils.toArray<HTMLElement>('.intro-beat').forEach((beat, index) => {
            gsap.fromTo(beat.querySelector('.intro-card'), { autoAlpha: 0, y: 14 }, {
                autoAlpha: 1, y: 0, duration: .65,
                scrollTrigger: { trigger: beat, scroller, start: 'top 68%', end: 'center 38%', toggleActions: 'play reverse play reverse' }
            });
            if (index === 0) gsap.set(beat.querySelector('.intro-card'), { autoAlpha: 1, y: 0 });
        });
    }, scroller);
    return () => ctx.revert();
}, [stage]);
```

**Analysis:**
- `scrub: .8` provides a 0.8-second lag between scroll position and camera progress. This prevents jarring jumps during fast scrolls. **Correct.**
- `ease: 'none'` on the scrub tween means the camera progress follows scroll linearly — appropriate because easing is applied within `setIntroProgress`'s keyframe system (but as noted in §3.4, that system uses linear lerp, not eased).
- The intro card fade-in/out uses `toggleActions: 'play reverse play reverse'` — entering from above re-runs the enter animation, returning from below re-runs the enter animation in reverse. **Correct for a loopable intro.**
- The first card's `autoAlpha` is set immediately via `gsap.set` (line 124), ensuring it is visible before any scrolling. **Correct.**
- `ctx.revert()` in the cleanup correctly kills all ScrollTriggers and animations when the stage changes. **Correct.**

**Minor concern:** The ScrollTrigger uses `.intro-track` as the trigger element and `.intro-scroll` as the scroller. This requires `.intro-track` to be taller than `.intro-scroll` for the scroll range to work. Since `.intro-beat` elements each have `min-height: 100svh` (style.css:28), and there are 7 beats, `.intro-track` should be ~700svh, which will scroll correctly. **Structurally correct.**

### 6.2 Chapter ScrollTrigger

**App.tsx:130–139:**
```typescript
useLayoutEffect(() => {
    if (stage !== 'story' || !chapterScroll.current) return;
    const scroller = chapterScroll.current;
    const ctx = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>('.chapter-page').forEach((page, index) => {
            ScrollTrigger.create({
                trigger: page, scroller,
                start: 'top 52%', end: 'bottom 48%',
                onEnter: () => handleChapterScroll(index),
                onEnterBack: () => handleChapterScroll(index)
            });
        });
    }, scroller);
    return () => ctx.revert();
}, [stage, artifactId]);
```

**Analysis:**
- Triggers fire when the chapter page center crosses the scroller's 52%/48% midpoint window. This is a reasonable trigger zone.
- `onEnter` and `onEnterBack` both call `handleChapterScroll(index)`, which calls `scene.current?.setChapterProgress(index)` — the same function for both directions, which is correct (chapter camera is per-index, not directional).
- **Missing:** `onLeave` and `onLeaveBack` are not set. If the user scrolls past a page entirely, no camera transition fires until `onEnter`/`onEnterBack` on the next page. For the last chapter page, scrolling past it calls `onLeave` on nothing. This is acceptable since the chapter-end section naturally follows.
- The effect re-runs on `artifactId` change (dependency array line 139), correctly rebuilding ScrollTriggers for new chapter content. **Correct.**
- **`handleChapterScroll` closure capture risk:** The `handleChapterScroll` function defined at line 141 of App.tsx captures `chapter`, `cancelAuto`, and `scene.current` from the render closure. Since ScrollTrigger callbacks are registered once in `useLayoutEffect` and not rebuilt on every render, they may capture stale `chapter` state. However, `handleChapterScroll` reads `programmaticScroll.current` and `index === chapter` where `chapter` is the closure value — if the chapter state is stale, `index === chapter` may incorrectly suppress a valid scroll. **Potential stale closure bug.** The `advanceRef` pattern used for `advance` (line 77) is not applied here.

### 6.3 Timeline Management

**SpaceScene.ts:**
```typescript
private cancelTimeline() { this.timeline?.kill(); this.timeline = undefined; }  // line 233
private rootTweenStop() { gsap.killTweensOf([this.camera.position, this.planet.scale, this.artifactGroup.position]); }  // line 234
```

`cancelTimeline` kills the stored timeline (cinematic arrival or returnGuided). `rootTweenStop` kills tweens on specific objects by reference.

**Gap:** `rootTweenStop` does not kill tweens on `planetGroups` individual body scales, which are tweened by `frameArtifact` (line 200: `gsap.to(body.scale, {...})`) and `framePlanet` (line 201). If `showArtifact` is called while `frameArtifact` is mid-tween, the planet scale tween continues to run on the planet body — it is killed only if `setDestination` or `showWorldSelection` are called (they call `rootTweenStop`). But `rootTweenStop` only kills tweens on `this.planet.scale` (the group), not on individual `body.scale` objects. **Confirmed gap:** per-planet body scale tweens are not cleaned up by `rootTweenStop`.

The `done` flag pattern in `cinematicArrival` (line 187: `let done = false; const complete = ...`) correctly prevents double-resolution of the Promise if `timeline.onComplete` fires after a manual `skipTravel` → `progress(1)` call. **Correct.**

---

## PART 7 — UI AND INTERACTION

### 7.1 UI Stability Analysis

The layout uses `position: absolute` for major panels (`.story-meta`, `.chapter-scroll`, `.selector`, `.finale`), all anchored relative to the `.museum` container (`position: relative`; `width: 100vw; height: 100svh`). The canvas is `position: absolute; inset: 0` with `z-index: -2`, serving as the full-bleed background. The shade overlay is `z-index: -1`.

**Stacking context issues:** The `.museum` element has `isolation: isolate` (style.css:9), creating a new stacking context. All z-indices are therefore relative to `.museum`, not the document root. This is correct and prevents z-fighting with any external DOM elements.

**Responsive layout:** Three breakpoints are defined:
- `max-width: 900px` (tablet): `.story-meta` narrows, `.chapter-scroll` adjusts left/width.
- `max-width: 650px` (mobile): `.story-meta` moves to top-left, `.chapter-scroll` moves to bottom. Layout becomes vertically stacked.
- `max-height: 700px and min-width: 651px` (landscape phone): Reduces padding.

The mobile layout (line 165) positions `.story-meta` absolutely at `top: 12svh; left: 6vw` and `.chapter-scroll` at `bottom: 11svh; height: 50svh`. This is a stacked layout where the metadata panel is at the top and the chapter text is at the bottom, with the 3D scene visible in between. **Structurally valid** but the 3D scene is effectively sandwiched into a narrow middle band on small screens.

**`prefers-reduced-motion` (style.css:191–193):** All animations and transitions are nullified. ScrollTrigger is JS-based and not affected by this CSS rule — GSAP will still animate the scene camera on scroll even when `prefers-reduced-motion` is set. **Known gap** — not a layout bug, but an accessibility concern.

### 7.2 Control Completeness

| Control | Present | Location | Notes |
|---------|---------|----------|-------|
| Pause Journey | ✅ | Story stage sidebar + menu + Space key | `pauseJourney()` |
| Resume Journey | ✅ | Story stage sidebar + menu + Space key | `resumeJourney()` |
| Pause Narrator | ✅ | Narrator controls in sidebar | `setNarratorPaused(true)` |
| Resume Narrator | ✅ | Narrator controls in sidebar | `setNarratorPaused(false)` |
| Skip Chapter | ✅ | Narrator controls + menu | `skipNarration()` / `advance()` |
| Skip Artifact | ✅ | Menu + chapter-end section | `skipStory()` |
| Inspect Model | ✅ | Inspect controls (when model ready) | `scene.inspect()` |
| Reset View | ✅ | Inspect controls (while inspecting) | `scene.resetView()` |
| Return to Guided View | ✅ | Inspect controls (while inspecting) | `scene.returnGuided()` |
| Exit Current Artifact | ✅ | Menu | `exitCurrentArtifact()` |
| Exit Expedition | ✅ | Menu | `exitExpedition()` |
| Return to Destination | ✅ | Menu | `showWorldSelection()` |
| Skip Travel / Cinematic | ✅ | Blackout screen | `scene.skipTravel()` |
| Escape key | ✅ | Keyboard | Closes inspect / chat / menu |
| Arrow key (→) | ✅ | Keyboard | `advance()` |
| Captions Toggle | ✅ | Header | `setCaption()` |

**All major controls are present.** No required controls are missing.

**Minor note:** There is no keyboard shortcut for "Inspect model" or "Return to guided view". These require mouse clicks on sidebar buttons.

### 7.3 Orbital Controls

**SpaceScene.ts:57–60, 228:**
```typescript
this.controls = new OrbitControls(this.camera, this.renderer.domElement);
this.controls.enabled = false;
this.controls.enableDamping = true;
this.controls.dampingFactor = 0.06;
this.controls.enableRotate = true;
this.controls.enableZoom = true;
this.controls.enablePan = false;
this.controls.minPolarAngle = 0.03;
this.controls.maxPolarAngle = Math.PI - 0.03;

// inspect():
this.controls.minDistance = 1.5;
this.controls.maxDistance = 18;
```

**Analysis:**
- `dampingFactor = 0.06` is appropriately low — provides smooth, slightly floaty inertia. **Correct for a museum context.**
- `enablePan = false` — correct, prevents the user from panning the camera off the artifact.
- `minPolarAngle = 0.03` / `maxPolarAngle = π − 0.03` — allows near-full vertical orbit with 0.03 radian guard from north/south poles to prevent gimbal lock. **Correct.**
- `minDistance = 1.5` — prevents clipping into small models. For Sojourner (a very small rover scaled to ~2.0 scene units), 1.5 minimum distance is tight and may still allow partial clip-through the model geometry. **Potential issue for small models.**
- `maxDistance = 18` — allows zooming out to nearly the planet-visible distance. **Reasonable.**
- Controls are enabled only during inspection mode (line 228), disabled in all other modes. **Correct.**
- `controls.update()` is called in the render loop (line 263) only when `controls.enabled = true`, which is correct — damping only applies when the controls are active.

---

## PART 8 — ASSET REGISTRY

### 8.1 Available Models

| Artifact ID | Model Path | fitSize | Load Status | Notes |
|-------------|-----------|---------|-------------|-------|
| `eagle` | `/Models/Moon-missions-models/Apollo11/apollo_11_lunar_module.glb` | 2.9 | ✅ Expected OK | 13.3 MB, 15 nodes, 13 meshes, 10 materials, **no textures** — relies entirely on material properties + IBL for appearance. |
| `apollo15-lrv` | `/Models/Moon-missions-models/Apollo15/mondfahrzeug_lunar_rover.glb` | 2.1 | ✅ Expected OK | 31.6 MB, 18 nodes, 12 meshes, 9 materials, 7 embedded images. Largest spacecraft model. |
| `sojourner` | `/Models/Mars-missions-models/pathfinder-mission/mars_sojourner_rover_model.glb` | 2.0 | ✅ Expected OK | 6.4 MB, 10 nodes, 6 meshes, 6 materials, 18 embedded images. |
| `spirit` | `/Models/Mars-missions-models/Spirit & Opportunity-missions/24883_MER_static.glb` | 2.4 | ✅ Expected OK | 11.9 MB, 1 node, 1 mesh, 9 materials, 12 images. Single-mesh rover. |
| `opportunity` | `/Models/Mars-missions-models/Spirit & Opportunity-missions/24883_MER_static.glb` | 2.4 | ✅ Expected OK | Same GLB as Spirit. Duplicate load on each visit. |

**Note on Eagle (Apollo 11 LM):** The model has **no embedded textures**. Its visual appearance depends entirely on PBR material property values (metallic, roughness, color) + the EXR environment map IBL. If the EXR has not finished loading when Eagle is first displayed, the model will appear as flat-shaded gray surfaces with no specular response. This is a **race condition**: `loadEnvironment()` and artifact loading are both async and have no synchronization. If a user navigates directly to Eagle before the EXR loads, the model will look significantly different from its final appearance.

### 8.2 Missing Models

| Artifact ID | Reason | Fallback |
|-------------|--------|---------|
| `surveyor3` | No model collected — noted by design | Text-only experience; empty 3D scene with planet visible |

**No other models are missing.** The `preloadAllArtifactModels` path list (lines 271–275) matches the catalog entries.

### 8.3 Landing Sites

| Artifact ID | Site Path | Size | Notes |
|-------------|-----------|------|-------|
| `eagle` | `/Models/Moon-missions-models/Apollo11/apollo_11_lunar_landing_site.glb` | 20.8 MB | 11 nodes, 6 meshes, 1 material, 1 embedded image. Largest site file. |
| `spirit` | `/Models/Mars-missions-models/Spirit & Opportunity-missions/Mars - Spirit Landing Site.glb` | 35.2 MB | 2 nodes, 1 mesh, 1 material, **no images** — texture-less terrain, gray. |
| `opportunity` | `/Models/Mars-missions-models/Spirit & Opportunity-missions/Mars- Opportunity Landing Site.glb` | 4.0 MB | 2 nodes, 1 mesh, 1 material, **no images** — texture-less terrain, gray. |
| `surveyor3` | None | — | No site model; no illustrative surface either (see §2.3). |
| `apollo15-lrv` | None | — | Illustrative surface generated procedurally (line 158). |
| `sojourner` | None | — | Illustrative surface generated procedurally. |

**Concern:** The Spirit landing site (35.2 MB) is the largest single asset in the project. Load time on slower connections could be substantial. There is no progressive loading or LOD system. The loading blackout UI remains active only during cinematic arrival, not during asset fetch — `onBlackout(false, true)` (loading state) is set at line 138 at the start of `showArtifact`, but the actual blackout screen shows "PREPARING THE ARTIFACT" only while `loading === true` in App.tsx. The loading state is cleared by `setLoading(false)` in `startArtifact` (line 59: `.then(() => setLoading(false))`). This means the loading indicator is active throughout the entire asset fetch + cinematic arrival sequence. **Correct behavior.**

---

## PART 9 — AMBIENT PARTICLES AND ATMOSPHERE

### 9.1 Particle System

**SpaceScene.ts:236–249 (`createAmbient`):**

Three particle layers:
| Layer | Count (desktop) | Count (mobile) | Radius | Size | Speed | Axis | Opacity | Color |
|-------|----------------|----------------|--------|------|-------|------|---------|-------|
| 0 | 780 | 429 | 130 | 0.075 | 0.0018 | Y | 0.58 | `#d7e5f5` (cool white) |
| 1 | 340 | 187 | 64 | 0.13 | 0.0035 | X | 0.42 | `#82a8d2` (blue) |
| 2 | 90 | 50 | 28 | 0.19 | 0.006 | Z | 0.28 | `#ceb98f` (warm gold) |

**Critical problem — Z distribution (confirmed):**

**SpaceScene.ts:245:**
```typescript
arr[i * 3 + 2] = -Math.random() * layer.radius - 2;
```

The Z coordinate is always `−(random * radius) − 2`. For layer 0 (radius=130), Z is in `[−132, −2]`. For layer 2 (radius=28), Z is in `[−30, −2]`. **All particles are behind the camera** (camera is at positive Z, e.g. Z=16 during cinematic; particles only exist at negative Z). 

The camera's near-to-far visibility (from `z=0.1` to `z=1400`) means all particles should technically be visible — they are in front of the camera frustum in the negative-Z direction (which is the camera's forward direction in a right-handed system). However, the distribution is hemispherical (only the negative-Z hemisphere), creating an asymmetry: particles will appear to come from one direction only and will be absent behind the camera or to the camera's sides.

The movement system (line 261):
```typescript
p[layer.axis] += layer.speed;
if (p[layer.axis] > layer.span) p[layer.axis] = -layer.span;
```

Layer 0 rotates the entire point cloud along Y, layer 1 along X, layer 2 along Z. Because the particle cloud's centroid is always in the negative-Z region, layer 2's Z-axis translation merely slides the hemispherical blob back and forth along Z — it doesn't distribute particles into the positive-Z space. The clamp-and-wrap also uses `layer.span = layer.radius * 1.4` (line 248), so the cloud wraps when its axis offset exceeds `radius * 1.4`. **Result:** The star field appears significantly denser on the camera-forward side and absent on the camera-backward side. This becomes most visible during cinematic approach sequences when the camera moves backward (Z:17) and forward (targetZ), because the camera's local orientation relative to the particle cloud changes dramatically.

**Fix:** Replace `arr[i * 3 + 2] = -Math.random() * layer.radius - 2` with:
```typescript
arr[i * 3 + 2] = (Math.random() - 0.5) * layer.radius * 2;
```
This distributes particles in a full sphere (radius * 2 diameter) centered on the origin.

### 9.2 Travel Streaks

**SpaceScene.ts:251–257 (`createTravelStreaks`):**

```typescript
const count = 180, positions = new Float32Array(count * 6);
for (let i = 0; i < count; i++) {
    const x = (Math.random() - .5) * 46,
          y = (Math.random() - .5) * 30,
          z = -Math.random() * 55;
    positions.set([x, y, z, x, y, z - .1], i * 6);
}
```

180 line segments, each 0.1 scene units long, distributed across a `46 × 30` XY extent, all at negative Z (from 0 to −55). Like the particle system, **all streaks are on the negative-Z side** (in front of the camera's forward direction). This is intentional for a "traveling toward camera" look — streaks should approach the camera. The spread (`46 × 30`) is wide relative to the viewport at z=16, which means streaks at the edges will appear as diagonal lines rather than straight approaches. **Minor artistic concern, not a code bug.**

Streak animation (line 262):
```typescript
let z = arr.getZ(i) + speed;
if (z > 10) z = -55;
arr.setZ(i, z);
arr.setZ(i + 1, z - (speed > .1 ? 1.2 : .1));
```

Streaks move in the +Z direction (toward camera) at `speed = 0.42` during active travel or `0.04` when inactive. At speed 0.42, they traverse the `65` unit range in ~155 frames — at 60fps that's about 2.5 seconds per streak pass. **Plausible speed.**

The streak segment length is dynamic: `z - (speed > .1 ? 1.2 : .1)`. During travel, the tail is 1.2 units; at idle speed, 0.1 units. This makes streaks elongate during active travel. **Good artistic touch.**

**Trigger:** `setTravel(true)` is called in `cinematicArrival` (line 184). `setTravel(false)` is called in `finishArrival` (line 197) and `cancelJourney` (line 232). The fade uses GSAP: active → `opacity: 0.65` in 0.25s; inactive → `opacity: 0` in 0.5s. **Correct lifecycle.**

---

## PART 10 — IDENTIFIED ROOT CAUSES

For each visual problem, the EXACT root cause, file and line, and recommended fix:

| Problem | Root Cause | File:Line | Fix |
|---------|-----------|-----------|-----|
| Incorrect model sizing — all models same visible scale | Universal `fitSize`-based `setScalar` applied to longest axis regardless of geometry | `SpaceScene.ts:148` | Per-artifact `modelScale` config; apply after bounding-box center |
| Landing site floating / sinking / embedded in model | Universal `y = −2.0` offset applied to all terrain after centering; no relation to actual post-scale terrain height | `SpaceScene.ts:154` | Per-artifact `groundOffsetY` derived from actual terrain bounding box |
| All models same rotation angle | `model.rotation.y = 0.55` applied to every artifact unconditionally | `SpaceScene.ts:149` | Per-artifact `modelRotationY` config |
| Camera not adapting to actual model geometry | `artifactView.position.z = max(5.2, fitSize * 2.55)` — Z derived from `fitSize`, not actual post-scale bounding sphere | `SpaceScene.ts:160` | Per-artifact `cameraZ`; or compute from actual bounding sphere after scaling |
| Camera Y not adapting to model height | `cameraY = 2.4` hardcoded for all models | `SpaceScene.ts:160` | Per-artifact `cameraY` |
| Chapter camera is abrupt (snap, no tween) | `camera.position.set()` with no GSAP tween | `SpaceScene.ts:224` | Replace with `gsap.to(camera.position, {..., duration: 0.4, ease: 'power2.inOut'})` |
| `artifactGroup` rotation conflict (chapter scroll vs. render loop) | `artifactGroup.rotation.y = x * 0.18` (absolute set) conflicts with render-loop `+= Math.sin(frame) * 0.0001` | `SpaceScene.ts:225` (set) + `SpaceScene.ts:260` (accumulate) | Use `gsap.to(artifactGroup.rotation, {y: x * 0.18})` and remove render-loop mutation during `chapter-scroll` mode |
| Particles only behind camera — star field is one-sided | `arr[i*3+2] = -Math.random() * layer.radius - 2` forces all Z to negative range | `SpaceScene.ts:245` | `arr[i*3+2] = (Math.random() - 0.5) * layer.radius * 2` for full-sphere distribution |
| Planet body scale tweens not cleaned up on navigation | `rootTweenStop()` kills tween on `this.planet.scale` (the group), not on individual `body.scale` per planet | `SpaceScene.ts:234` | Add `for (const body of this.planetGroups.values()) gsap.killTweensOf(body.scale)` to `rootTweenStop` |
| No `camera.lookAt` during cinematic arrival | GSAP tween on `camera.position` has no `onUpdate: () => camera.lookAt(...)` | `SpaceScene.ts:189–193` | Add `onUpdate: () => this.camera.lookAt(this.artifactView.target)` to arrival tweens |
| `framePlanet()` missing `onUpdate: lookAt` | `gsap.to(camera.position, {...})` has no `onUpdate` to track planet center | `SpaceScene.ts:201` | Add `onUpdate: () => this.camera.lookAt(0, 0, 0)` |
| Intro keyframe transitions are linear (speed creases) | `vectors()` helper uses `THREE.MathUtils.lerp` with no easing between frames | `SpaceScene.ts:14, 213–214` | Apply smoothstep or cubic easing to `local` before passing to `vectors()` |
| Eagle model has no textures — race with EXR load | Apollo 11 LM GLB has zero embedded textures; appearance depends entirely on IBL from EXR | `SpaceScene.ts:89–97` (async EXR) + `SpaceScene.ts:145–149` (model load) | Await EXR before resolving model readiness, or add a material placeholder |
| Sojourner scene is empty when no model | Illustrative surface guard `!artifact.environment && artifact.model` excludes Surveyor 3 (no model AND no environment) | `SpaceScene.ts:158` | Change guard to `!artifact.environment` to generate illustrative surface for all no-environment artifacts |
| `handleChapterScroll` stale closure risk | App.tsx ScrollTrigger callbacks capture `chapter` from render closure; not updated via ref pattern | `App.tsx:135, 141–144` | Wrap `handleChapterScroll` in a ref (like `advanceRef`) |
| Shadow map resolution low for detailed terrain | `sun.shadow.mapSize.set(1024, 1024)` | `SpaceScene.ts:55` | Increase to `2048, 2048` |
| `minDistance = 1.5` may clip small models | Fixed `minDistance` regardless of model scale | `SpaceScene.ts:228` | Compute from post-scale bounding sphere: `minDistance = boundingSphere.radius * 1.2` |

---

## PART 11 — WHAT IS WORKING CORRECTLY

The following elements are **correctly implemented** and should **not be changed**:

- **Asset lifecycle (revision system):** `assetRevision` guard prevents stale loads from corrupting the scene. `clearGroup` and `disposeObject` correctly free GPU resources. ✅
- **Tour sequence logic (`tour.ts`):** `buildTour`, `validateTour`, `tourConfig` are clean and correctly enforce the 6-artifact sequence with world ordering. ✅
- **Artifact catalog (`catalog.ts`):** Catalog structure, chapter data, and planet assignments are correct. The shared MER model caveat is properly disclosed in `modelNote`. ✅
- **Overall React architecture (`App.tsx`):** `useRef` for scene and scroll state, `useCallback` for stable callbacks, `useLayoutEffect` for GSAP context — all correctly used. ✅
- **EXR loading approach:** Correct use of `EXRLoader`, `EquirectangularReflectionMapping`, `LinearSRGBColorSpace`, and fallback color. ✅
- **Planet loading and caching:** Per-planet `planetGroups` Map prevents duplicate geometry; `planetRequests` revision system prevents stale planet meshes from being added. ✅
- **Narration system:** `SpeechSynthesisUtterance` integration with `autoAdvanceChapters`, `minimumReadMs` guard, and pause/resume controls is correctly implemented. ✅
- **Archive / Chat system:** `fallbackAnswer` for offline mode, source attribution structure, history slicing to 8 messages — all correct. ✅
- **Renderer configuration:** `outputColorSpace`, `toneMapping`, `toneMappingExposure`, shadow type. ✅
- **EXR as IBL environment:** `scene.environment = texture` correctly enables IBL for all PBR materials. ✅
- **OrbitControls setup:** Damping, pan disabled, polar angle limits, enabled only during inspection. ✅
- **Travel streaks lifecycle:** `setTravel` correctly fades streaks in/out; streak speed adapts correctly. ✅
- **`cinematicArrival` done-flag pattern:** Prevents double-resolve of the Promise. ✅
- **`prefers-reduced-motion` CSS rule:** Correctly nullifies CSS animations and transitions. ✅
- **Responsive layout breakpoints:** Three breakpoints with appropriate layout reflows for tablet, mobile, and landscape. ✅
- **`ctx.revert()` GSAP cleanup:** Both `useLayoutEffect` effects correctly revert their GSAP contexts on cleanup. ✅

---

## PART 12 — VISUAL VALIDATION PROCEDURE

The following steps should be executed in a browser with `?debugAssets` appended to the URL to monitor asset states, and with DevTools open (Performance tab) to watch for frame drops.

### 12.1 Validate Model Scaling

1. Navigate to the site. Skip intro. Choose **Moon**. Select **Eagle**.
2. Wait for arrival (or skip travel). Observe the Apollo 11 LM in the scene.
3. **Check:** The lander should appear as a full-scale spacecraft (~4–5m tall relative to the lunar terrain). It should not appear as a toy miniature or a building-sized structure.
4. Return. Select **Lunar Roving Vehicle**. The LRV should appear low and wide relative to its terrain.
5. Navigate to **Mars → Sojourner**. Sojourner should appear small (it was a microwave-sized rover). With the current universal scaling, it will appear the same visual size as the LM.
6. **Expected failure:** All three will appear at approximately the same visual size. This confirms §1.2.

### 12.2 Validate Landing Site Grounding

1. Arrive at **Eagle** (Apollo 11 site present).
2. **Check:** The descent stage of the LM should appear to rest on the lunar terrain, not float above it or embed into it.
3. Navigate to **Spirit** (Mars site present). Check rover-to-terrain contact.
4. **Expected failure:** One or more artifacts will float above or sink into the terrain. This confirms §1.3.

### 12.3 Validate Particle Distribution

1. Enter the site at any artifact. Enable browser DevTools → Three.js debugger or open the console.
2. Rotate camera 180° around by using mouse (enter Inspect mode on any artifact).
3. **Check:** Stars/particles should be visible in all directions, including behind the original camera forward direction.
4. **Expected failure:** Particles will be visible only in the camera-forward (negative Z) hemisphere. The sky will appear noticeably sparser when looking back. This confirms §9.1.

### 12.4 Validate Chapter Camera Transitions

1. Enter story mode on any artifact. Let it arrive.
2. Scroll through chapters 1→2→3→4→5 manually (using the chapter scroll panel).
3. **Check:** Camera position should smoothly tween between chapter offsets.
4. **Expected failure:** Camera snaps instantaneously to new position on each chapter change. This confirms §3.2 (instant position set, no tween).

### 12.5 Validate Cinematic Arrival Look-At

1. Enter story mode on **Spirit**.
2. Watch the cinematic arrival sequence (do not skip).
3. **Check:** The rover should be centered in frame when the blackout lifts and the camera arrives.
4. **Expected observation:** The camera may emerge from blackout looking at a slightly off-center or unexpected angle, since `lookAt` is not called during the GSAP tween segments. This confirms §3.3, finding 1.

### 12.6 Validate EXR Race Condition (Eagle)

1. Hard-refresh the page (Ctrl+Shift+R) and immediately navigate: Skip Intro → Moon → Eagle.
2. During the loading phase, observe the model in the blackout's pre-reveal instant (skip travel immediately).
3. **Check:** If the EXR has not loaded, the model will appear flat-gray with no reflections.
4. **Expected failure:** On slow connections, Eagle's metallic surfaces will appear flat until the EXR finishes loading in the background. This confirms §8.1 (EXR race condition).

### 12.7 Validate `framePlanet` Look-At

1. Enter story mode, complete a few chapters.
2. Manually call `scene.framePlanet()` (via browser console: `document.querySelector('canvas').__scene?.framePlanet()` or add a debug button).
3. **Check:** Camera should smoothly track toward the planet center during the zoom-out.
4. **Expected failure:** Camera zooms out but doesn't re-orient toward the planet — the lookAt is not called in the tween's `onUpdate`. This confirms §1.4 suspected issue.

### 12.8 Validate Surveyor 3 Scene

1. Navigate through the tour to **Surveyor 3** (or manually navigate).
2. **Check:** The scene should show the Moon planet body but nothing else in the foreground.
3. **Confirm:** No illustrative surface is generated. The scene is intentionally sparse but visually empty except for the planet and starfield. Consider whether a Moon surface should be shown.

---

## APPENDIX A — ASSET INVENTORY

*Source: ASSET_AUDIT.md (2026-11-13) with art-direction notes added.*

### Planetary Models

| File | Size | Contents | Art-Direction Notes |
|------|------|----------|---------------------|
| `Models/Earth_1_12756.glb` | 12.9 MB | 1 scene, 1 node, 1 mesh, 1 material, 2 images | Used in intro and world-selection. Scale: `4.2 / maxAxis`. ✅ |
| `Models/moon_small.glb` | 13.8 MB | 1 scene, 2 nodes, 1 mesh, 1 material, 1 image | Used for Moon missions. Scale: `3.5 / maxAxis`. ✅ |
| `Models/24881_Mars_1_6792.glb` | 4.0 MB | 1 scene, 1 node, 1 mesh, 1 material, 2 images | Used for Mars missions. Scale: `4.2 / maxAxis`. ✅ |

### Spacecraft Models

| File | Size | Contents | Art-Direction Notes |
|------|------|----------|---------------------|
| `Models/Moon-missions-models/Apollo11/apollo_11_lunar_module.glb` | 13.3 MB | 15 nodes, 13 meshes, 10 materials, **0 textures** | Full LM (ascent + descent). No embedded textures — IBL-dependent. EXR race condition risk. Currently scaled to fitSize=2.9. |
| `Models/Moon-missions-models/Apollo15/mondfahrzeug_lunar_rover.glb` | 31.6 MB | 18 nodes, 12 meshes, 9 materials, 7 images | LRV — wide and low. Currently scaled to fitSize=2.1. Largest model by file size. |
| `Models/Mars-missions-models/pathfinder-mission/mars_sojourner_rover_model.glb` | 6.4 MB | 10 nodes, 6 meshes, 6 materials, 18 images | Very small rover. Currently scaled to fitSize=2.0. Will appear same visual size as LM. |
| `Models/Mars-missions-models/Spirit & Opportunity-missions/24883_MER_static.glb` | 11.9 MB | 1 node, 1 mesh, 9 materials, 12 images | Single-mesh MER rover. Used for both Spirit and Opportunity. Currently scaled to fitSize=2.4 for both. |

### Landing Sites

| File | Size | Contents | Art-Direction Notes |
|------|------|----------|---------------------|
| `Models/Moon-missions-models/Apollo11/apollo_11_lunar_landing_site.glb` | 20.8 MB | 11 nodes, 6 meshes, 1 material, 1 image | Richest site — 6 meshes. Scaled to 12 units, y=−2.0. |
| `Models/Mars-missions-models/Spirit & Opportunity-missions/Mars - Spirit Landing Site.glb` | 35.2 MB | 2 nodes, 1 mesh, 1 material, 0 images | Texture-less — gray uniform material. Relies on `surfaceMaterial()` roughness. Largest asset by file size. |
| `Models/Mars-missions-models/Spirit & Opportunity-missions/Mars- Opportunity Landing Site.glb` | 4.0 MB | 2 nodes, 1 mesh, 1 material, 0 images | Texture-less — same as Spirit site in appearance. |
| `.stl` duplicates for Spirit/Opportunity sites | 24.4 MB + 2.8 MB | Binary geometry | Not used by the application. Alternate format. |

### Environment

| File | Details | Art-Direction Notes |
|------|---------|---------------------|
| `Skybox-bg/starmap_2020_4k.exr` | 36 MB, 4096×2048, equirectangular | Loaded with `EquirectangularReflectionMapping` + `LinearSRGBColorSpace`. Used as background + IBL. ✅ |

### Missing Assets

| ID | Reason | Impact |
|----|--------|--------|
| Surveyor 3 model | Not collected | Text-only story; empty 3D scene |
| Apollo 11 descent-stage-only model | No separate asset created | Full LM model used with caveat in `modelNote` |
| Cosmic background image | Not supplied | EXR handles background duty |

---

## APPENDIX B — SCENE HIERARCHY DIAGRAM

```
THREE.Scene
│
├── THREE.HemisphereLight  (sky: #aac6e6, ground: #15100d, intensity: 1.35)
├── THREE.DirectionalLight (sun, #ffefd8, intensity: 3.2, pos: -7,8,9, castShadow, mapSize: 1024)
├── THREE.DirectionalLight (rim, #75a6d9, intensity: 1.4, pos: 7,-2,-5)
│
├── planet  [THREE.Group]
│   ├── Earth  [THREE.Group] — may contain:
│   │   └── <earth_mesh> [THREE.Object3D from GLTF]  (scale: 4.2/maxAxis, rotation.y: -0.5)
│   ├── Moon   [THREE.Group] — may contain:
│   │   └── <moon_mesh>  [THREE.Object3D from GLTF]  (scale: 3.5/maxAxis, rotation.y: -0.5)
│   └── Mars   [THREE.Group] — may contain:
│       └── <mars_mesh>  [THREE.Object3D from GLTF]  (scale: 4.2/maxAxis, rotation.y: -0.5)
│
├── landingGroup  [THREE.Group]
│   └── <site>  [THREE.Object3D from GLTF]
│       — centered via bounding-box subtraction
│       — scaled to 12/maxAxis (uniform)
│       — y = −2.0 (hardcoded offset)
│       — OR: illustrative surface [THREE.Group] from createIllustrativeSurface()
│
├── artifactGroup  [THREE.Group]  (position: 0, -0.2, 0)
│   └── <model>  [THREE.Object3D from GLTF]
│       — centered via bounding-box subtraction
│       — scaled to fitSize/maxAxis (uniform)
│       — rotation.y = 0.55 (hardcoded)
│
├── <ambient_points_layer_0>  [THREE.Points]  (780 pts, radius 130, axis Y, color #d7e5f5)
├── <ambient_points_layer_1>  [THREE.Points]  (340 pts, radius 64, axis X, color #82a8d2)
├── <ambient_points_layer_2>  [THREE.Points]  (90 pts, radius 28, axis Z, color #ceb98f)
│
└── <travelPoints>  [THREE.LineSegments]  (180 segments, opacity 0 when inactive)

Camera: THREE.PerspectiveCamera (FOV: 38°, near: 0.1, far: 1400)
  — Managed by CameraMode enum: 'cinematic' | 'intro-scroll' | 'world-selection' | 'chapter-scroll' | 'inspection'
  — OrbitControls attached (enabled only in 'inspection' mode)

Synthetic views (not Three.js objects, used as camera reference):
  artifactView  { position: Vector3, target: Vector3 }  — hero shot position
  guidedView    { position: Vector3, target: Vector3 }  — copy of artifactView for returnGuided()
```
