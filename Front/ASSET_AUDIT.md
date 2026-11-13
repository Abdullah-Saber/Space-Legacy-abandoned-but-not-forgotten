# Asset audit

Inventory checked 2026-11-13. GLB files were inspected by reading their glTF JSON chunk, including scene/node/mesh/material/image counts. The supplied EXR header reports a 4096×2048 data/display window. Its 2:1 aspect and environment-map filename indicate an equirectangular lat-long map; this is an identification by format shape/name, not a visual inspection of the decoded pixels.

## Planetary models

| File | Format / size | Contents / dependencies |
|---|---:|---|
| `Models/Earth_1_12756.glb` | GLB, 12.9 MB | 1 scene, 1 node, 1 mesh, 1 material, 2 embedded images; no external dependencies. Earth. |
| `Models/moon_small.glb` | GLB, 13.8 MB | 1 scene, 2 nodes, 1 mesh, 1 material, 1 embedded image; no external dependencies. Moon. |
| `Models/24881_Mars_1_6792.glb` | GLB, 4.0 MB | 1 scene, 1 node, 1 mesh, 1 material, 2 embedded images; no external dependencies. Mars. |

## Spacecraft models

| File | Format / size | Contents / matching artifact |
|---|---:|---|
| `Models/Moon-missions-models/Apollo11/apollo_11_lunar_module.glb` | GLB, 13.3 MB | 1 scene, 15 nodes, 13 meshes, 10 materials; no embedded or external images. Apollo 11 Lunar Module. It appears to be a full module, so it must not be described or shown as an exact standalone abandoned descent stage. |
| `Models/Moon-missions-models/Apollo15/mondfahrzeug_lunar_rover.glb` | GLB, 31.6 MB | 1 scene, 18 nodes, 12 meshes, 9 materials, 7 embedded images; no external dependencies. Apollo 15 Lunar Roving Vehicle. |
| `Models/Mars-missions-models/pathfinder-mission/mars_sojourner_rover_model.glb` | GLB, 6.4 MB | 1 scene, 10 nodes, 6 meshes, 6 materials, 18 embedded images; no external dependencies. Sojourner. |
| `Models/Mars-missions-models/Spirit & Opportunity-missions/24883_MER_static.glb` | GLB, 11.9 MB | 1 scene, 1 node, 1 mesh, 9 materials, 12 embedded images; no external dependencies. Shared MER rover asset; supplied naming does not establish whether its geometry represents Spirit or Opportunity. |

## Landing-site / terrain models

| File | Format / size | Contents / matching mission |
|---|---:|---|
| `Models/Moon-missions-models/Apollo11/apollo_11_lunar_landing_site.glb` | GLB, 20.8 MB | 1 scene, 11 nodes, 6 meshes, 1 material, 1 embedded image. Apollo 11 site. |
| `Models/Mars-missions-models/Spirit & Opportunity-missions/Mars - Spirit Landing Site.glb` | GLB, 35.2 MB | 1 scene, 2 nodes, 1 mesh, 1 material, no images. Spirit site. |
| `Models/Mars-missions-models/Spirit & Opportunity-missions/Mars- Opportunity Landing Site.glb` | GLB, 4.0 MB | 1 scene, 2 nodes, 1 mesh, 1 material, no images. Opportunity site. |
| `Models/Mars-missions-models/Spirit & Opportunity-missions/Mars - Spirit Landing Site.stl` | STL, 24.4 MB | Binary geometry; no texture/material dependencies. Spirit site duplicate/alternate. |
| `Models/Mars-missions-models/Spirit & Opportunity-missions/Opportunity Landing Site.stl` | STL, 2.8 MB | Binary geometry; no texture/material dependencies. Opportunity site duplicate/alternate. |

## Environment, background, and textures

| File | Details |
|---|---|
| `Skybox-bg/starmap_2020_4k.exr` | EXR, 36.0 MB, 4096×2048, scanline version 2. 2:1 dimensions are consistent with an equirectangular environment; frontend loads it with `EXRLoader` and `EquirectangularReflectionMapping`, in linear color space. |
| Separate cosmic background image | Missing. The application uses the EXR environment plus a restrained procedural star field. |
| Textures | GLB models contain embedded images (counts listed above); no separate loose texture files were found. Earth/Moon/Mars and most rover textures are embedded. Apollo 11 landing-site and MER landing-site GLBs have no embedded images. |

## Missing / authenticity notes

- Surveyor 3 model and locally available historical image are missing. It has a dedicated artifact record and text-only state; no substitute model is shown.
- There is no Apollo 11 descent-stage-only model. The Apollo 11 artifact record explains the stage distinction and avoids claiming the full module model is the abandoned stage.
- A single MER rover GLB is used for both Spirit and Opportunity; mission text keeps dates and facts distinct, but visual geometry should be treated as a shared rover representation until its provenance is verified.
- No separate cosmic background image was supplied.
- To add or replace these assets, copy them into the existing `Models/` or `Skybox-bg/` directories. The production build copies those directories into its output automatically.
