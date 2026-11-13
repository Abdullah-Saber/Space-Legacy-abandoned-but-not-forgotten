# Frontend correction audit

## Current causes

- **Typography is undersized:** the current stylesheet uses 9–14px for most story copy, labels and controls (for example `.chapter-copy`, `.story-controls button`, `.eyebrow`, `.artifact-label`).
- **UI drifts:** the intro GSAP context runs an infinite `yoyo` tween on `.hero-copy`, moving the entire text/control block by 28px forever. All other content is fixed overlays while `body` is `overflow:hidden`.
- **Scroll story is absent:** there is no `ScrollTrigger` registration, no scroller/story chapters, and the intro only has a Start button. The `gsap` import only handles a brief reveal and camera tweens.
- **Camera feels static:** `SpaceScene` directly tweens camera Z from 10.8 to 8.1 (or 5.6) and scales groups; there is no camera director, spline/approach path, travel phase, landing reveal or scroll camera ownership.
- **Inspection is absent:** no `OrbitControls` instance or inspect mode exists.
- **Why spacecraft appear ignored:** the scene loads only the active artifact on demand, so selecting the intro does not load spacecraft; Eagle has no `model` path; the Apollo 15 and Sojourner paths are used only when selected; Spirit and Opportunity both point at the same MER GLB. Errors are swallowed in the GLTFLoader callback, and `Box3` normalization scales every mesh to the same arbitrary 3.3-unit maximum without reporting bounds. The GLBs are valid binary GLBs with embedded buffers/images; no `.bin` or loose texture files are needed. None of inspected GLBs uses Draco/Meshopt or a required unsupported extension. Moon's clearcoat/specular/IOR material extensions are supported by the current Three.js GLTFLoader.
- **Paths:** the four distinct spacecraft GLBs exist at the exact paths recorded in `src/catalog.ts` (URL spaces and `&` are legal when URL encoded by the browser). The prior failure was not an absent `.bin`; it was missing coverage/diagnostics, plus a loader failure callback that discarded the real error. A shared MER asset cannot establish separate Spirit vs Opportunity geometry.
- **Memory:** `Group.clear()` detaches old GLTFs without disposing their geometry/material/texture resources.
- **Landing sites:** Apollo 11 landing-site GLB pairs with Eagle only as contextual terrain; it must not imply that the full LM model is the abandoned descent stage. Spirit landing-site GLB pairs with Spirit; Opportunity landing-site GLB pairs with Opportunity. No Apollo 15 LRV or Pathfinder/Sojourner landing-site model is supplied. STL alternates exist for Spirit and Opportunity, but the current renderer does not load STL.
- **Environment:** `starmap_2020_4k.exr` exists (4096×2048, 2:1) and is loaded with EXRLoader/equirectangular mapping. Its loader error is swallowed. The separate cosmic background image named in earlier notes is not in the asset folder; the scene uses a sparse static Points field.
- **Tour route bug:** `advance()` looks up the chosen ID in canonical order and takes the next index, wrapping only indirectly through the separate world switch. Choosing Spirit therefore goes to Opportunity rather than Sojourner. The other planet always starts canonical, but the selected planet's intended sequence (selected first, then canonical order excluding it) is not generated centrally. `setTimeout` transitions are not cancelled on exit/replay.
- **Exit/control gaps:** the only persistent story actions are Pause Narration, Stop voice, and Next. There is no journey pause, current artifact exit, expedition exit, or destination return.

## Change plan applied

The initial run confirms the large-scale planet issue: Earth reports about `1000 × 996.65 × 1000` units and Mars about `1000 × 994.11 × 1000`; Moon reports about `2.54 × 2.54 × 2.54`. Earth and Mars now normalize from measured bounds. In the diagnostic run, EXR plus Earth, Moon, Mars, Eagle, LRV, Sojourner, and the shared MER model all reported `ready`; Surveyor 3 reports `missing` by design. The application previously didn't request most artifact models until visiting them, and had no diagnostics to distinguish “not requested” from “failed.”

Implemented: larger stable typography; viewport-anchored intro/chapter scrollers with ScrollTrigger-controlled camera framing; ambient layered particles and separate travel streaks; OrbitControls inspection with reset/return; async GLTF loading with reported errors/bounds/mesh and texture counts; contextual landing-site scenes for Eagle, Spirit, and Opportunity; a blackout and arrival reveal; resource cleanup; and persistent Pause/Resume, narration skip, artifact skip/exit, expedition exit, and destination return controls. The Eagle model is explicitly identified as a full Lunar Module model, and the shared MER asset disclaimer remains visible.

The pure tour generator now yields all six artifacts exactly once. Verified routes:

- Mars, starting at Spirit: `spirit → sojourner → opportunity → eagle → surveyor3 → apollo15-lrv`.
- Moon, starting at Surveyor 3: `surveyor3 → eagle → apollo15-lrv → sojourner → spirit → opportunity`.

Local paths with spaces and ampersands load successfully through `GLTFLoader`. No GLB external BINs or textures are required; the inspected models use embedded data. Source and terrain scales are normalized from their actual bounding boxes, and unloads dispose GPU resources. No exact site terrain was supplied for Sojourner or the Apollo 15 LRV.
