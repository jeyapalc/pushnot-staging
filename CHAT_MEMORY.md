# PUSHNOT // Project Chat Memory & Architectural Reference

**Last Updated:** 2026-11-27 (v150)  
**Repository:** `jeyapalc/pushnot-staging`  
**Active Branches:** `staging` (source), `gh-pages` (deployed production/staging)  
**Live Deployments:**
- **Netlify:** [https://pushnot-otia.netlify.app](https://pushnot-otia.netlify.app)
- **GitHub Pages:** [https://jeyapalc.github.io/pushnot-staging/](https://jeyapalc.github.io/pushnot-staging/)

---

## 1. Key Architectural Directives & Chronology

### v150 (RCMP Courtyard Trees Aligned Parallel to Front Wooden Sign)
- **Realigned 4 Courtyard Trees Parallel with Wooden Sign**: Restored the exact coordinates from `5339830` (`{ x: 8.5, z: 7.5 }`, `{ x: 10.0, z: 12.0 }`, `{ x: 11.5, z: 16.5 }`, `{ x: 13.0, z: 21.0 }`) so that the row of 4 green Nikko maple trees runs directly parallel with the front wooden entrance sign and foyer structure, resolving the "went back too far" wide-courtyard positioning.
- **Preserved All Architectural Assets**:
  - Dark tactical slate/charcoal building exterior (`0x18202e`) (v149).
  - Matte black window bays with all glass reflection removed (`0x0a0c10`) (v148).
  - Rich warm wood on awning and entrance wall (`0x8a532b`) (v148).
  - Pure glowing white RCMP bison crest decal and police signage (`0xffffff`) (v148).
  - JJ Jameson laughing video mounted flush on Swiss Proton server (`y = 22.8`) (v145).
  - 45-degree forward tilted ID reveal house and address plaque (v141).
  - Single 3D Judicial Gavel traveling along outbound investigation arcs (v136).

### v149 (RCMP Building Body Color Restored to 0x18202e)
- **Restored Building Body Tone**: Switched the RCMP building exterior finish from pitch black (`0x0a0c10`) back to the authentic dark tactical slate/charcoal color (`0x18202e`, roughness: 0.88, metalness: 0.12) across all roof, wall, shell, and window bay meshes, exactly matching the user's reference screenshot (`media_1795671305458_9c41203f.jpg`).
- **Maintained Wood & Logo Accents**: Preserved warm natural wood (`0x8a532b`) on the entrance awning and front entrance wall, the crisp emissive white RCMP bison crest decal (`0xffffff`), and the 4 green courtyard trees.

### v148 (Removed Glass, Wood Awning & Wall, Black Building, White Logo)
- **Glass Removed**: Handled multi-material array traversal (`Array.isArray(c.material)`) across all building meshes (`Brick, bronze, silver and ribbon glazing`, `East laboratory`, etc.). All glass materials (`Blue-gray glass`, `Clear public-entry glass`, `Atrium glass`, window frames) are set to solid matte black (`0x0a0c10`, roughness: 0.95, metalness: 0.0), completely eliminating all glass reflections, transparency, and window stripe artifacts.
- **Wood Awning & Entrance Wall**: Target matches for `Courtyard canopy and columns`, `Public entry canopy`, `Canopy wood 0/1`, and `Warm neutral backing at public entrance` rendered in rich warm wood (`0x8a532b`, roughness: 0.65).
- **Solid Black Building**: All exterior shell panels, roofs, spandrels, and parapets rendered in solid matte black (`0x0a0c10`, roughness: 0.92).
- **Crisp White RCMP Bison Logo**: The textured alpha decal (`Front atrium bison crest decal` with `White etched bison crest`) is rendered in pure emissive white (`0xffffff`, roughness: 0.15, emissiveIntensity: 1.0) with polygon offset to cleanly float above the matte black atrium facade without z-fighting. All official police text signage (`Canada`, `du Canada`, `Royal Canadian Mounted Police`) also rendered in crisp white.

### v146 (Restored RCMP Node with Trees & Single Dramatic Spotlight)
- **Restored RCMP Node State**: Reverted the RCMP building node to the exact point when the 4 green Nikko maple trees were finalized (`bf1c003`).
- **Dark Scene & Tactical Monolith**: Dark tactical slate/charcoal exterior finish (`0x18202e`), white etched bison crest (`0xffffff`), and warm rich natural wood foyer wall (`0x8a532b`).
- **Single Dramatic Spotlight**: Restored the 110-intensity focused entrance spotlight (`spotLight` at `110.0`), entrance fill point light (`25.0`), and courtyard pool, casting a focused dramatic beam while preserving the dark tactical nighttime scene.
- **Courtyard Trees**: Restored the 4 green summer Nikko maple trees (`#2e7d32`, height 10.5) in the courtyard opposite the entrance foyer at `{ x: 19.5, z: 14.5 }`, `{ x: 22.5, z: 14.0 }`, `{ x: 25.5, z: 13.5 }`, `{ x: 28.5, z: 13.0 }`.

### v136 (Ground Circle & Judicial Gavel)
- **Removed Ground Circle Under RCMP Building in LEO**: Moved `ring`, `outer`, `trackInner`, and `trackOuter` into `normalGroup`. In LEO mode, `normalGroup` is hidden, completely clearing the ground plane under the RCMP headquarters with zero circles or rings.
- **Single 3D Judicial Gavel for Outbound RCMP Orders**: Standalone 3D Judicial Gavel with dark walnut/mahogany head and handle, polished brass bands, traveling with an animated gentle strike posture along the outbound RCMP investigation arcs in Step 2 (RCMP → Proton) and Step 4 (RCMP → App Servers).

### v141 (ID Reveal House Tilt)
- **House GLB Tilt**: Tilted the `homeSweetHomeScene` 45 degrees forward (`Math.PI / 4, -0.15, 0`) and elevated it (`y = 2.2, z = 0.4`) so the front yard, walkway, front door, lawn, and white-blossomed tree face the camera/user cleanly without ground-level edge clipping.
- **Address Plaque**: Re-oriented address plaque (`14.2, 0.4, 4.0`) to tilt 45 degrees in harmony with the house.

### v145 (Laughing Video on Proton Server & Authentic RCMP Building Rollback)
- **Chromakeyed Laughing Video (JJ Jameson) Mounted on Proton Server**:
  - **UV Texture Re-mapping**: Extracted bounding box of the subject from the 1080×1920 video (`vMin = 0.312` to `vMax = 0.688`, `uMin = 0.04` to `uMax = 0.98`), eliminating the empty 600px transparent padding at the bottom of the video.
  - **Flush Seating on Server Roof**: Anchored bottom of the plane (`vidW = 8.6`, `vidH = 6.2`) directly at `y = 22.8`, making JJ Jameson sit flush directly on the top surface of the black Swiss Proton server chassis with zero floating gap.
  - **Upright Facing**: Billboarded upright facing the user/camera (`this.swissVideoMesh.lookAt(this.camera.position.x, 22.8 + 3.1, this.camera.position.z)`).
  - **Swiss Flag Backdrop**: Swiss flagpole and flag positioned at local `z = -2.4` inside `protonGroup`, waving behind JJ Jameson as a backdrop without occluding his face.
- **RCMP Green Timbers Headquarters Rollback**:
  - **Authentic GLB Materials**: Removed all manual color overrides (no forced charcoal `0x18202e` monolith finish and no artificial blue/cyan glass tinting).
  - **Preserved Textures**: Natural window glass, warm wood/brick entrance foyer, concrete facade panels, and white etched bison crest rendered directly from the GLB model using `this.harmonizeAsset`.
  - **Natural Daylight Rig**: Restored directional afternoon sunlight (`0xfff5e6`, 3.4), soft sky ambient fill (`0xbde0fe`, 1.8), entrance accent point light (`0xfffaed`, 3.2), and ground bounce fill (`0xfef3c7`, 1.5). Zero ground plinth/circle under the building footprint.

---

## 2. Git Commit Log

- `97265d1` on `staging`: *Seat laughing video flush on Proton server & fully restore authentic RCMP building (v145)*
- `a9652e8` on `gh-pages`: *Seat laughing video flush on Proton server & fully restore authentic RCMP building (v145)*
- `d96bc70` on `staging`: *Position laughing video in front of Swiss flag on Proton server (v144)*
- `0727249` on `staging`: *Mount laughing video on Proton server and rollback RCMP building to v136 (v143)*
- `538c551` on `staging`: *Mount laughing video on Proton server and rollback RCMP building to v136 (v142)*
- `c587ba3` on `staging`: *Tilt ID reveal house 45 degrees forward to face user (v141)*
- `ee83370` on `staging`: *Remove ground circle under RCMP building in LEO & replace with 3D Judicial Gavel (v136)*

---

## 3. Deployment Commands

```bash
# Push to remote branches:
git push origin staging
git push origin gh-pages

# Deploy to Netlify staging:
npx netlify deploy --prod --dir=public
```
