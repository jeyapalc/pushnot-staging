# PUSHNOT // Online 3D Model Artifact Viewer

**PUSHNOT** is a futuristic, browser-based 3D artifact inspector and visualizer built with WebGL (Three.js) and configured for Netlify deployment.

## Features

- **Multi-Format Ingestion**: Supports `.stl`, `.obj`, `.gltf`, and `.glb` files via drag-and-drop or file upload.
- **Embedded Archives**: Pre-bundled with real local assets (`Top_Mod_V1.stl`, `box_4x7x1.5.obj`) and a procedural Quantum Monolith generator.
- **Shading Engine**: Instant toggling between PBR Metallic-Roughness, Normal Maps, Chrome Matcap, and Wireframe.
- **Dynamic Inspection**: Real-time vertex count, triangle/polygon count, bounding box dimensions ($X \times Y \times Z$), and data size telemetry.
- **Viewport Controls**: Turntable rotation with variable spin speed, bounding box visualization, coordinate grids, and one-click camera view presets (Isometric, Front, Top, Side).
- **Snapshot Export**: High-resolution image capture and export directly to PNG.

## Project Structure

```
pushnot/
├── .netlify/
│   └── state.json       # Netlify project site linkage
├── netlify.toml          # Netlify build & security headers
├── package.json          # NPM configuration & scripts
├── public/
│   ├── index.html        # Main HUD and viewer interface
│   ├── css/
│   │   └── style.css     # Cyberpunk HUD styling
│   ├── js/
│   │   └── app.js        # Three.js 3D engine & interaction handlers
│   └── models/           # Pre-bundled 3D artifact archives
│       ├── Top_Mod_V1.stl
│       └── box_4x7x1.5.obj
└── README.md
```

## Netlify Site

- **Project ID**: `6fbbe4dd-faac-4033-b005-998240e55b7e`
- **Site Name**: `pushnot-otia`
- **Live URL**: https://pushnot-otia.netlify.app
- **Admin Dashboard**: https://app.netlify.com/projects/pushnot-otia

## Local Development & Deployment

Run local server:
```bash
npx netlify dev
```

Deploy directly to Netlify:
```bash
npx netlify deploy --prod --dir=public
```
