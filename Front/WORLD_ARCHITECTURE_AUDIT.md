# WORLD ARCHITECTURE AUDIT
## Abandoned but Not Forgotten — NASA Space Apps Challenge 2026
### Inspection Date: 2026-11-13
### Senior Cinematic Art Director & Three.js Technical Director

---

## 1. EXECUTIVE SUMMARY

An exhaustive architectural and visual audit of the current codebase (`SpaceScene.ts`, `App.tsx`, `catalog.ts`, `tour.ts`, `style.css`, and GLTF assets in `/Models`) was performed. The application exhibits severe structural, composition, and lifecycle deficiencies that undermine the intended high-end cinematic space documentary experience.

The core failure stems from attempting to render all elements—distant celestial globes, local planetary surface terrain, and historical spacecraft—within a single, conflated scene graph using uncalibrated universal scaling heuristics, competing camera controllers, and uncoordinated state transitions.

The project does not require a total rewrite, but it requires a disciplined reconstruction across scene separation (Orbital vs Surface), per-asset physical calibration, authoritative state-machine-driven transitions, and a single master camera choreography system.

---

## 2. ROOT CAUSE ANALYSIS OF THE 11 CRITICAL PROBLEMS

### 2.1 Problem 1: Incorrect Transition Lifecycle
- **Source Files**: `Front/src/App.tsx` (lines 53–59, 134–139), `Front/src/SpaceScene.ts` (lines 134–164).
- **Actual Cause**: In `startArtifact()`, `setStage('story')` is invoked synchronously before the asynchronous GLTF loader (`showArtifact()`) finishes fetching and validating the 3D models. The React UI transitions into the story state immediately, displaying chapter cards and metadata while the 3D canvas is still black or loading assets behind a transient overlay. Furthermore, the arrival sequence (`cinematicArrival`) runs detached from the React lifecycle, leading to mismatched UI timing.
- **Proposed Correction**: Implement a strict state-machine flow:
  `TRAVEL_DEPARTURE` → `ORBITAL_APPROACH` → `SURFACE_DESCENT` → `ARRIVAL_BLACKOUT` → `LANDING_REVEAL` → `ARTIFACT_STORY`.
  Assets for the landing site and spacecraft must be fully validated and mounted during the blackout before `LANDING_REVEAL` is triggered, and `ARTIFACT_STORY` UI is only presented after the hero camera settles.
- **Verification**: Test with network throttling (Fast 3G). Ensure no story UI or unready 3D models appear before the camera settles into the hero composition.

### 2.2 Problem 2: Transitions Completing Prematurely
- **Source Files**: `Front/src/App.tsx` (lines 78–92), `Front/src/SpaceScene.ts` (lines 183–195).
- **Actual Cause**: Premature transitions occur due to two independent mechanisms:
  1. An uncoordinated `autoTimer` in `App.tsx` that advances chapters and artifacts via `setTimeout` based on speech synthesis duration, firing even if the user has touched the scrollbar or is actively exploring.
  2. GSAP timeline callbacks in `cinematicArrival` relying on hardcoded delays (`.to({}, { duration: 0.75 })`) rather than asset-ready promises, causing the blackout to clear before heavy terrain meshes finish compiling shaders.
- **Proposed Correction**: Make GSAP timelines and asset-readiness promises the authoritative controllers of transition progress. Cancel all automatic timers permanently whenever manual interaction (wheel, touch, key, inspect) occurs.
- **Verification**: Initiate transition on both heavy assets (Spirit Landing Site, 35MB) and light assets (LRV); verify the transition hold respects asset compilation without early reveals.

### 2.3 Problem 3: Skip Actions Closing or Aborting the Experience
- **Source Files**: `Front/src/App.tsx` (lines 136, 185, 190, 196), `Front/src/SpaceScene.ts` (line 198).
- **Actual Cause**: The UI conflates "Skip Travel", "Skip Story", and "Exit Expedition":
  - Clicking "Skip Travel" during a blackout calls `scene.current?.skipTravel()`, but if the timeline state is mid-transition or if `tourIndex` is queried, stale closures or subsequent chapter-end handlers trigger `finish()` or reset to world selection.
  - In `App.tsx:136`, `skipStory()` advances `tourIndex` and calls `finish()` if it reaches the end, aborting without confirmation.
- **Proposed Correction**: Create three distinct, mutually isolated callbacks:
  1. `onSkipTravel()`: Fast-forwards the active camera travel timeline to the landing-site hero preset and immediately clears the blackout. Does not alter artifact, tour index, or active chapter.
  2. `onSkipStory()`: Gracefully departs current artifact and initiates departure travel to the next scheduled tour item.
  3. `onExitExpedition()`: Prompts or immediately terminates tour and returns safely to destination selection.
- **Verification**: Press "Skip Travel" during every transition; verify visitor is placed directly at the hero reveal of the current spacecraft with full interaction intact.

### 2.4 Problem 4: Incorrect Planetary versus Surface Scene Composition
- **Source Files**: `Front/src/SpaceScene.ts` (lines 52, 109, 136–137).
- **Actual Cause**: `this.planet`, `this.landingGroup`, and `this.artifactGroup` are all children of the same root scene. When on the surface of the Moon or Mars, `body.visible` for the active planet remains `true` at `position (0, 0, -7)`. Consequently, a giant 4.2-unit planetary globe floats in the sky directly behind its own local landing terrain!
- **Proposed Correction**: Architect two distinct scene environments:
  - **Orbital Scene (`orbitalGroup`)**: Visible during `INTRO`, `DESTINATION_SELECTION`, `TRAVEL_DEPARTURE`, and `ORBITAL_APPROACH`. Contains the planetary globe, planetary rotation, and cosmic starfield.
  - **Surface Scene (`surfaceGroup`)**: Activated during `SURFACE_DESCENT` and `LANDING_REVEAL`. Contains the local terrain mesh, single active spacecraft, surface contact lighting, and distant horizon. The planet globe is hidden (`visible = false`).
- **Verification**: Inspect Eagle, LRV, Sojourner, Spirit, and Opportunity; confirm no full globe of Moon or Mars is visible in the sky behind the surface site.

### 2.5 Problem 5: Asset-Scale Inconsistencies
- **Source Files**: `Front/src/SpaceScene.ts` (lines 148, 154), `Front/src/catalog.ts`.
- **Actual Cause**: Universal scalar normalization:
  - `model.scale.setScalar(fit / Math.max(size.x, size.y, size.z, 0.001))` forces all spacecraft into an arbitrary ~2.0–2.9 unit bounding cube. Sojourner (real length 0.65m) appeared nearly the same size as the Apollo Lunar Module (real height 7m)!
  - `site.scale.setScalar(12 / Math.max(size.x, size.y, size.z, 0.001))` arbitrarily scales all landing terrain to 12 units, distorting real topographic features (e.g. Spirit site is 150m wide, Opportunity is 760m wide, Apollo 11 is 100m wide).
- **Proposed Correction**: Establish a formal `AssetCalibration` registry defining real-world metric dimensions, source unit conversions (e.g., cm to meters, mm to meters), verified scaling factors, and reference bounds.
- **Verification**: Verify that Sojourner displays as a compact robotic scout, LRV as an open crewed vehicle, and Eagle as a towering dual-stage lunar lander.

### 2.6 Problem 6: Incorrect Model Positioning and Grounding
- **Source Files**: `Front/src/SpaceScene.ts` (lines 147, 154, 159).
- **Actual Cause**:
  - `model.position.sub(box.getCenter(new THREE.Vector3()))` centers every model at its geometric center. For models whose origin was at the landing pads or wheels, this drops the lower half below Y=0.
  - `site.position.y = -2.0` is universally applied to all terrain models regardless of their vertical relief.
  - As a result, models either float 1–2 meters in the air or are buried halfway underground.
- **Proposed Correction**: Use a two-tier hierarchy:
  `ArtifactPlacementRoot` → `ArtifactModelRoot` → `Imported Meshes`.
  Align the model's minimum Y bound (`box.min.y`) to the surface plane (`y = 0` or calibrated terrain ground offset). Calibrate terrain mesh elevation per site.
- **Verification**: Enable `?debugScene=1` and check `GridHelper` and `BoxHelper`; verify all rover wheels and lander footpads touch the surface plane without sinking or floating.

### 2.7 Problem 7: Camera Snapping and Poor Camera Framing
- **Source Files**: `Front/src/SpaceScene.ts` (lines 160, 223–226).
- **Actual Cause**:
  - `setChapterProgress` sets `this.camera.position.set(...)` directly on each scroll event without interpolation.
  - `artifactView.position.z = Math.max(5.2, fitSize * 2.55)` calculates distance strictly from `fitSize` without factoring in aspect ratio, vertical height, or FOV.
  - When switching into inspection mode or between chapters, the camera cuts abruptly rather than easing.
- **Proposed Correction**: All camera transitions must be managed through an authoritative `CameraDirector` with GSAP smoothing. Framing distances must be calculated from the object's actual bounding sphere radius: `distance = (radius / sin(fov/2 * DEG2RAD)) * paddingFactor`.
- **Verification**: Scroll forward and backward through chapters; verify the camera glides smoothly between narrative perspectives without snapping.

### 2.8 Problem 8: Missing Continuous Scrolling Interaction
- **Source Files**: `Front/src/App.tsx` (lines 113–127), `Front/src/style.css` (lines 82–86).
- **Actual Cause**: The chapter scroll container is styled with `scroll-snap-type: y mandatory`, and ScrollTrigger only attaches discrete `onEnter` / `onEnterBack` triggers at page midpoints. There is no continuous `scrub` timeline linking scroll offset to camera orbit or focal length. The 3D scene appears frozen until the user crosses a snap threshold.
- **Proposed Correction**: Rebuild the artifact story experience with a master GSAP ScrollTrigger timeline utilizing a calibrated `scrub: 0.8` (or smooth tween interpolation on active section) that dynamically rotates and translates the camera along a 5-beat documentary path.
- **Verification**: Slowly drag the scroll thumb; verify the 3D scene responds continuously with cinematic parallax.

### 2.9 Problem 9: Competing Camera Animations
- **Source Files**: `Front/src/SpaceScene.ts` (lines 117–120, 188–194, 200, 223–225, 228–230), `Front/src/App.tsx` (lines 104, 118).
- **Actual Cause**: Multiple components independently dispatch GSAP tweens on `camera.position` and `camera.lookAt` simultaneously (e.g. intro scroll trigger, `setChapterProgress`, `cinematicArrival`, and `OrbitControls.update()` in the render loop).
- **Proposed Correction**: Implement strict camera ownership modes:
  - `INTRO`: Intro ScrollTrigger owns camera.
  - `CINEMATIC_TRAVEL`: Master travel timeline owns camera; all user input disabled.
  - `SCROLL_STORY`: Chapter ScrollTrigger owns camera.
  - `INSPECTION`: OrbitControls exclusively owns camera; ScrollTrigger paused.
  - Transitions kill existing tweens cleanly via `gsap.killTweensOf(this.camera.position)`.
- **Verification**: Switch between inspection, chapter scrolling, and navigation; verify zero camera stutter or contradictory tween fighting.

### 2.10 Problem 10: Incorrect or Duplicate Artifact Rendering
- **Source Files**: `Front/src/SpaceScene.ts` (lines 143–156), `Front/src/catalog.ts`.
- **Actual Cause**:
  - `Spirit` and `Opportunity` share the same `24883_MER_static.glb` file. Both were loaded with identical universal rotation (`model.rotation.y = 0.55`), showing identical orientations regardless of site terrain.
  - Apollo 11 terrain (`apollo_11_lunar_landing_site.glb`) was inspected; it is pure LROC DTM terrain (6 mesh tiles, 367k vertices) without vehicle geometry. However, improper group clearance during rapid navigation could leave previous models orphaned in memory.
- **Proposed Correction**: Verify landing sites do not contain duplicate vehicles. Implement rigorous disposal and mounting lifecycle with asset revision tokens. Provide distinct calibrations and hero orientations for Spirit vs Opportunity.
- **Verification**: Traverse Opportunity → Spirit; confirm terrain and rover orientations reflect distinct mission discovery contexts.

### 2.11 Problem 11: Broken Introductory Scene
- **Source Files**: `Front/src/SpaceScene.ts` (lines 62, 109–112, 203–219), `Front/src/App.tsx` (lines 45, 101–111).
- **Actual Cause**: On startup, `loadPlanet` is called for Earth, Moon, and Mars simultaneously. `setIntroProgress(0)` immediately forces `body.visible = true` for all three planets. Mars, the Moon, and Earth are displayed concurrently across the viewport in arbitrary positions before the visitor has even scrolled! The camera is positioned at `z=16` looking at an off-center Earth.
- **Proposed Correction**: Rebuild the intro architecture:
  - Dedicated initial composition: Earth centered in majestic deep space with starlight, subtle atmospheric rim, and ambient particles.
  - Intro state sequence: `BOOT` → `INTRO_READY` → `INTRO_SCROLL` → `DESTINATION_SELECTION`.
  - Moon and Mars only enter the scene when scrolled to their respective narrative beats.
- **Verification**: Load the app with a hard refresh; verify the opening screen shows a stable, breathtaking view of Earth with zero model popping or premature celestial clutter.

---

## 3. ARCHITECTURAL SPECIFICATION & ACTION PLAN

| Module | Target Responsibility | Key Changes |
|---|---|---|
| `Front/src/calibration.ts` | Central Asset Calibration Registry | Physical metric dimensions, scale multipliers, rotation, ground offsets, camera presets |
| `Front/src/SpaceScene.ts` | Two-Context World Scene Graph & Camera Director | Separation of `orbitalGroup` & `surfaceGroup`, authoritative Camera Director, PBR lighting, debug HUD |
| `Front/src/App.tsx` | Master State Machine & Interaction Orchestration | Explicit state enum, separation of Skip/Exit actions, ScrollTrigger synchronization, keyboard shortcuts |
| `Front/src/style.css` | Stable Cinematic UI & Responsive Layout | Clean typographic hierarchy, travel overlays, manual hint banner, inspection controls |

---
*Audit completed. Implementation begins immediately.*
