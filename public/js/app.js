import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* =====================================================================
   PUSHNOT // 3D Push Notification Orbit
   Stations on orbit ring (R = 46):
     Apple & Google Stores (logos) : back-right   (+32.5, 0, -32.5)
     Phone (Smartphone + Bejeweled): front-right  (+32.5, 0, +32.5)
     App Server (Server Rack)      : front-left   (-32.5, 0, +32.5)
     Post Office (Post Box)        : back-left    (-32.5, 0, -32.5)
     External Stimulus (UFO)       : hovering above App Server (-32.5, 48, +32.5)

   Two Polarity Modes:
     'setup' (↺): App Stores -> Phone (Bejeweled) -> Post Office -> Key Token -> App Server (stored)
     'push'  (↻): UFO Event Trigger -> App Server (uses stored Key) -> Post Office -> Phone
   ===================================================================== */

const R = 46;
const D = Math.SQRT1_2 * R;
const POS = {
  store:  new THREE.Vector3( D, 0, -D),
  phone:  new THREE.Vector3( D, 0,  D),
  server: new THREE.Vector3(-D, 0,  D),
  post:   new THREE.Vector3(-D, 0, -D),
  ufo:    new THREE.Vector3(-D, 50, D)
};

const MODE_SECONDS = { setup: 11, push: 9, leo: 15 };
const MODE_STEPS = {
  setup: [0.06, 0.33, 0.50, 0.66, 0.82, 0.96],
  push:  [0.10, 0.32, 0.52, 0.64, 0.78, 0.95],
  leo:   [0.08, 0.25, 0.42, 0.60, 0.78, 0.94]
};
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));

class PushnotOrbit {
  constructor() {
    this.container = document.getElementById('canvas-container');

    this.loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
    this.loader.setDRACOLoader(draco);

    this.mode = 'setup'; // 'setup' | 'push' | 'leo'
    this.prevNormalMode = 'setup';
    this.t = 0.0;
    this.targetT = 0.0;
    this.playing = true;
    this.autoOrbit = true;
    this.orbitAngle = 0.35;
    this.flipRoll = 0;
    this.flipTarget = 0;
    this.lastFrame = performance.now();
    this.tops = { phone: 28, server: 34, post: 32, store: 28 };

    this.initScene();
    this.initLights();
    this.initOrbitRing();
    this.initMovers();
    this.initLeoStage();
    this.loadModels();
    this.initUI();
    this.setMode('setup', false);
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05080f, 0.003);

    // World Pivot allows smoothly flipping the entire 3D orbit 180° upside down!
    this.worldPivot = new THREE.Group();
    this.worldPivot.position.set(0, 14, 0);
    this.scene.add(this.worldPivot);

    this.worldGroup = new THREE.Group();
    this.worldGroup.position.set(0, -14, 0);
    this.worldPivot.add(this.worldGroup);

    // Top-side Normal Push Notification Group (hidden automatically when flipped to LEO)
    this.normalGroup = new THREE.Group();
    this.worldGroup.add(this.normalGroup);

    // Underside Law Enforcement Group (hidden automatically when right-side up)
    this.leoGroup = new THREE.Group();
    this.leoGroup.rotation.z = Math.PI;
    this.leoGroup.position.set(0, -1.0, 0);
    this.leoGroup.visible = false;
    this.worldGroup.add(this.leoGroup);

    this.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 1500);
    this.camera.position.set(42, 58, 134);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.container.appendChild(this.renderer.domElement);

    // Unified Studio IBL Environment Map for cohesive metallic & satin reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 16, 0);
    this.controls.minDistance = 50;
    this.controls.maxDistance = 260;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.addEventListener('start', () => {
      if (this.autoOrbit) this.setAutoOrbit(false);
    });

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  initLights() {
    // Harmonized 3-point studio lighting rig (balanced fill, key, cyan rim, warm back-fill)
    this.scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.95));
    const key = new THREE.DirectionalLight(0xfff7ed, 1.55); key.position.set(65, 130, 85); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x38bdf8, 1.05); rim.position.set(-85, 85, -55); this.scene.add(rim);
    const back = new THREE.DirectionalLight(0xfbbf24, 0.65); back.position.set(0, 55, -110); this.scene.add(back);
  }

  /* ---- Studio Light & Shine Harmonization Pass (applied to all 3D hardware/characters,
          explicitly skipping icons like Apple/Google/Meta logos and the Swiss Flag) ---- */
  harmonizeAsset(obj, { minRough = 0.28, maxRough = 0.62, maxMetal = 0.72, envIntensity = 0.85, liftDark = true } = {}) {
    obj.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (!m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial) continue;
        if (typeof m.roughness === 'number') {
          m.roughness = Math.max(minRough, Math.min(maxRough, m.roughness));
        }
        if (typeof m.metalness === 'number') {
          m.metalness = Math.min(maxMetal, m.metalness);
        }
        m.envMapIntensity = envIntensity;
        if (liftDark && m.color && !m.map) {
          const hsl = { h: 0, s: 0, l: 0 };
          m.color.getHSL(hsl);
          if (hsl.l < 0.1) m.color.setHSL(hsl.h, hsl.s, 0.12);
        }
        m.needsUpdate = true;
      }
    });
  }

  initOrbitRing() {
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.32 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.22, 12, 128), this.ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    this.worldGroup.add(ring);

    const outer = new THREE.Mesh(
      new THREE.TorusGeometry(R + 11, 0.08, 8, 128),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.12 })
    );
    outer.rotation.x = Math.PI / 2;
    outer.position.y = 0.1;
    this.worldGroup.add(outer);

    // Elevated arcs between stations
    const pStore  = POS.store.clone().setY(18);
    const pPhone  = POS.phone.clone().setY(16);
    const pPost   = POS.post.clone().setY(18);
    const pServer = POS.server.clone().setY(18);

    this.arcStoreToPhone  = new THREE.QuadraticBezierCurve3(pStore,  new THREE.Vector3(R + 10, 28, 0),  pPhone);
    this.arcPostToPhone   = new THREE.QuadraticBezierCurve3(pPost,   new THREE.Vector3(0, 32, 0),       pPhone);
    this.arcPhoneToServer = new THREE.QuadraticBezierCurve3(pPhone,  new THREE.Vector3(0, 12, R + 12),  pServer);
    this.arcServerToPost  = new THREE.QuadraticBezierCurve3(pServer, new THREE.Vector3(-R - 10, 28, 0), pPost);
    this.arcUfoToServer   = new THREE.LineCurve3(POS.ufo.clone().setY(44), POS.server.clone().setY(28));

    this.setupCurves = [this.arcStoreToPhone, this.arcPostToPhone, this.arcPhoneToServer];
    this.pushCurves  = [this.arcUfoToServer,  this.arcServerToPost, this.arcPostToPhone];

    this.setupLines = [
      this.addArc(this.arcStoreToPhone,  0x38bdf8, 0.4,  this.normalGroup),
      this.addArc(this.arcPostToPhone,   0xfbbf24, 0.35, this.normalGroup),
      this.addArc(this.arcPhoneToServer, 0xfbbf24, 0.4,  this.normalGroup)
    ];
    this.pushLines = [
      this.addArc(this.arcServerToPost, 0x34d399, 0.45, this.normalGroup),
      this.addArc(this.arcPostToPhone,  0x34d399, 0.45, this.normalGroup)
    ];

    // Directional flow cones gliding directly along the active mode's arcs (100% accurate polarity!)
    this.flowCones = [];
    this.beadMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const coneGeo = new THREE.ConeGeometry(0.85, 2.4, 8);
    coneGeo.rotateX(Math.PI / 2);
    for (let c = 0; c < 3; c++) {
      for (let k = 0; k < 3; k++) {
        const mesh = new THREE.Mesh(coneGeo, this.beadMat);
        this.normalGroup.add(mesh);
        this.flowCones.push({ mesh, curveIdx: c, offset: k / 3 });
      }
    }

    // Starfield
    const pts = [];
    for (let i = 0; i < 240; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = 60 + Math.random() * 140;
      pts.push(Math.cos(a) * rad, -10 + Math.random() * 95, Math.sin(a) * rad);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0x93c5fd, size: 0.7, transparent: true, opacity: 0.45 })
    );
    this.scene.add(this.stars);
  }

  addArc(curve, color, opacity, parent = this.worldGroup) {
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
    const mat = new THREE.LineDashedMaterial({ color, dashSize: 2.2, gapSize: 1.4, transparent: true, opacity });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    parent.add(line);
    return line;
  }

  /* ---- 5 magic neon-glow faceted gemstones representing Bejeweled ---- */
  createBejeweledCluster(scale = 1) {
    const group = new THREE.Group();
    const specs = [
      { color: 0xff2a55, emissive: 0xd90429, geo: new THREE.CylinderGeometry(0.9, 1.1, 3.0, 5), pos: [-2.8,  0.4,  0.6], rot: [0.2, 0.4,  0.15] },
      { color: 0xffaa00, emissive: 0xe85d04, geo: new THREE.ConeGeometry(1.4, 2.6, 4),           pos: [-1.4, -0.7, -1.1], rot: [0.1, 0.8, -0.25] },
      { color: 0x22ff88, emissive: 0x059669, geo: new THREE.OctahedronGeometry(1.8, 0),          pos: [ 0.0,  0.9,  0.0], rot: [0.1, 0.2,  0.0]  },
      { color: 0x2299ff, emissive: 0x1d4ed8, geo: new THREE.CylinderGeometry(1.3, 0.8, 2.7, 4), pos: [ 1.6, -0.5,  1.0], rot: [-0.2, 0.5, -0.15] },
      { color: 0xc026ff, emissive: 0x7e22ce, geo: new THREE.DodecahedronGeometry(1.4, 0),        pos: [ 2.7,  0.5, -0.7], rot: [0.3, -0.4,  0.2]  }
    ];

    for (const s of specs) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: s.color, emissive: s.emissive, emissiveIntensity: 0.75,
        roughness: 0.12, metalness: 0.15, clearcoat: 1.0, clearcoatRoughness: 0.08, flatShading: true
      });
      const mesh = new THREE.Mesh(s.geo, mat);
      mesh.position.set(...s.pos);
      mesh.rotation.set(...s.rot);
      mesh.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(s.geo),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })
      ));
      group.add(mesh);
    }

    const motePts = [];
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.2 + Math.random() * 2.2;
      motePts.push(Math.cos(a) * r, (Math.random() - 0.5) * 4.2, Math.sin(a) * r);
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.Float32BufferAttribute(motePts, 3));
    group.add(new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.8 })));

    group.add(new THREE.PointLight(0x22ff88, 2.5, 24));
    group.scale.setScalar(scale);
    return group;
  }

  /* ---- Metallic 3D Key representing the Device Token (distinct from gems!) ---- */
  createTokenKey(scale = 1) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.85,
      metalness: 0.9, roughness: 0.18
    });
    // Key bow (ring handle)
    const bow = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.35, 10, 24), mat);
    bow.position.x = -1.7;
    // Key blade
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.55, 0.4), mat);
    shaft.position.x = 0.8;
    // Key teeth
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.9, 0.4), mat);
    t1.position.set(1.4, -0.65, 0);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.2, 0.4), mat);
    t2.position.set(2.2, -0.8, 0);

    group.add(bow, shaft, t1, t2, new THREE.PointLight(0xfbbf24, 2.5, 24));
    group.scale.setScalar(scale);
    return group;
  }

  initMovers() {
    // 1. Bejeweled app travelling App Stores -> Phone
    this.appOrb = this.createBejeweledCluster(1.2);
    this.normalGroup.add(this.appOrb);

    // 2. Installed Bejeweled hovering above the Phone
    this.installedApp = this.createBejeweledCluster(0.85);
    this.installedApp.position.set(POS.phone.x, 32, POS.phone.z);
    this.normalGroup.add(this.installedApp);

    // 3. Moving Device Token (3D Metallic Key)
    this.tokenKey = this.createTokenKey(1.2);
    this.normalGroup.add(this.tokenKey);

    // 4. Persistent Stored Token Key docked on front of the Datacentre!
    this.storedKey = this.createTokenKey(1.0);
    this.storedKey.position.set(POS.server.x + 12, 24, POS.server.z + 12);
    this.normalGroup.add(this.storedKey);

    // 5. External Event Trigger Pulse (UFO -> App Server)
    this.triggerBolt = new THREE.Mesh(
      new THREE.SphereGeometry(2.0, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    this.triggerBolt.add(new THREE.PointLight(0x38bdf8, 4, 30));
    this.normalGroup.add(this.triggerBolt);

    // 6. Push Notification Envelope (carrying a mini golden Key stamped on top!)
    this.pushOrb = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 2.9, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x059669, emissiveIntensity: 0.85, metalness: 0.5, roughness: 0.25 })
    );
    this.pushOrb.add(box);
    this.pushOrb.add(new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: 0xffffff })));
    const miniKey = this.createTokenKey(0.55);
    miniKey.position.set(0, 2.2, 0);
    this.pushOrb.add(miniKey);
    this.pushOrb.add(new THREE.PointLight(0x34d399, 3, 30));
    this.normalGroup.add(this.pushOrb);

    // 7. 3D Neural Brain popping up above the Post Office for routing lookup
    this.initBrain();
  }

  initBrain() {
    // Load the real Brain Point Cloud GLB above the Post Office
    this.brainGroup = new THREE.Group();
    this.brainGroup.position.set(POS.post.x, 38.5, POS.post.z);
    this.brainMats = [];
    this.brainLight = new THREE.PointLight(0xf472b6, 3.5, 36);
    this.brainGroup.add(this.brainLight);
    this.brainGroup.visible = false;
    this.normalGroup.add(this.brainGroup);

    this.loader.load('models/brain_point_cloud.glb', (gltf) => {
      const brain = gltf.scene;
      this.centerAndScale(brain, 14);
      brain.traverse((child) => {
        if (child.isPoints || child.isMesh) {
          const mat = child.material;
          if (mat) {
            if (child.isPoints) {
              mat.size = Math.max(mat.size || 0.06, 0.09);
              mat.transparent = true;
              mat.opacity = 0.95;
            }
            this.brainMats.push({ mat, origColor: mat.color ? mat.color.clone() : new THREE.Color(0xf472b6) });
          }
        }
      });
      this.brainGroup.add(brain);
    }, undefined, (err) => {
      console.warn('brain_point_cloud.glb failed, using fallback:', err);
    });
  }

  updateBrainAndLedger(progress) {
    const pop = Math.min(1, progress / 0.15);
    const ease = 1 - Math.pow(1 - pop, 3);
    this.brainGroup.scale.setScalar(Math.max(0.01, ease));

    const matched = progress >= 0.72;
    const scrollP = seg(progress, 0.08, 0.72);
    const easedScroll = 1 - Math.pow(1 - scrollP, 2.2);
    const offsetPx = easedScroll * (5 * 42);

    const track = document.getElementById('pad-track');
    if (track) track.style.transform = `translateY(-${offsetPx.toFixed(1)}px)`;

    const pad = document.getElementById('pin-ledger');
    const status = document.getElementById('pad-status');
    if (pad) pad.classList.toggle('matched', matched);
    if (status) status.textContent = matched ? '✓ MATCHED' : 'MATCHING…';

    this.brainLight.color.setHex(matched ? 0x34d399 : 0xf472b6);
    for (const item of this.brainMats) {
      if (item.mat.color) {
        if (matched) item.mat.color.setHex(0x34d399);
        else item.mat.color.copy(item.origColor);
      }
    }
  }

  initDatacentreCluster(done) {
    // Collision-free Datacentre cluster: measure exact bounding boxes of all 8 GLBs,
    // then lay out back row, front row, top unit, plinth, and front-bezel LEDs with zero clipping.
    this.dcGroup = new THREE.Group();
    this.dcGroup.position.copy(POS.server);
    this.dcGroup.rotation.y = Math.PI * 0.25;
    this.normalGroup.add(this.dcGroup);

    const floorY = 0.8;
    const RACK_H = 18;
    const specs = [
      { key: 'argos',   row: 'back',  path: 'models/dc/cabinet_argos.glb', targetH: RACK_H, uniformH: true, ry: 0 },
      { key: 'main',    row: 'back',  path: 'models/data_center_rack.glb', targetH: RACK_H, uniformH: true, ry: 0 },
      { key: 'net',     row: 'back',  path: 'models/dc/network_rack.glb',  targetH: RACK_H, uniformH: true, ry: 0 },
      { key: 'rack1',   row: 'back',  path: 'models/dc/rack_1.glb',        targetH: RACK_H, uniformH: true, ry: 0 },
      { key: 'rack2',   row: 'front', path: 'models/dc/rack_2.glb',        targetH: RACK_H, uniformH: true, ry: 0 },
      { key: 'panel',   row: 'front', path: 'models/dc/control_panel.glb', targetH: RACK_H, uniformH: true, ry: -Math.PI / 2 },
      { key: 'console', row: 'front', path: 'models/dc/rack_console.glb',  targetH: RACK_H, uniformH: true, ry: 0 },
      { key: 'topbox',  row: 'front', path: 'models/dc/server_box.glb?v=3',    targetH: RACK_H, uniformH: true, ry: 0 }
    ];

    const loaded = {};
    let remaining = specs.length;

    const finalizeLayout = () => {
      const gapX = 0.2;
      const gapZ = 0.8;

      // 1. Lay out BACK row side-by-side with exact measured widths (zero overlap)
      const backKeys = ['argos', 'main', 'net', 'rack1'].filter((k) => loaded[k]);
      const backTotalW = backKeys.reduce((s, k) => s + loaded[k].size.x, 0) + gapX * Math.max(0, backKeys.length - 1);
      const backMaxD = Math.max(4, ...backKeys.map((k) => loaded[k].size.z));
      const backZ = -(backMaxD / 2 + gapZ / 2);

      let cx = -backTotalW / 2;
      const backPlaced = [];
      for (const k of backKeys) {
        const item = loaded[k];
        const x = cx + item.size.x / 2;
        item.wrap.position.set(x, floorY, backZ);
        this.dcGroup.add(item.wrap);
        backPlaced.push({ key: k, x, z: backZ, size: item.size });
        cx += item.size.x + gapX;
      }

      // 2. Lay out FRONT row (4 uniform-height units cleanly in front of back row)
      const frontKeys = ['rack2', 'panel', 'console', 'topbox'].filter((k) => loaded[k]);
      const frontTotalW = frontKeys.reduce((s, k) => s + loaded[k].size.x, 0) + gapX * Math.max(0, frontKeys.length - 1);
      const frontMaxD = Math.max(4, ...frontKeys.map((k) => loaded[k].size.z));
      const frontZ = (frontMaxD / 2 + gapZ / 2);

      cx = -frontTotalW / 2;
      for (const k of frontKeys) {
        const item = loaded[k];
        const x = cx + item.size.x / 2;
        item.wrap.position.set(x, floorY, frontZ);
        this.dcGroup.add(item.wrap);
        cx += item.size.x + gapX;
      }

      // 3. Size the raised floor plinth to the exact combined 4x2 footprint + clean margin
      const dcBox = new THREE.Box3().setFromObject(this.dcGroup);
      // Compute local bounds before world offset by measuring children
      const padW = Math.max(backTotalW, frontTotalW) + 5;
      const padD = backMaxD + frontMaxD + gapZ + 5;
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(padW, floorY, padD),
        new THREE.MeshStandardMaterial({ color: 0x0b1220, metalness: 0.7, roughness: 0.3 })
      );
      pad.position.set(0, floorY / 2, (frontZ + backZ) / 2);
      pad.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(pad.geometry),
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 })
      ));
      this.dcGroup.add(pad);

      // 5. Place flashing LEDs cleanly on the exact front bezel of each back-row rack
      this.dcLeds = [];
      const ledGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
      const palette = [0x38bdf8, 0x34d399, 0xfbbf24, 0xff2a55];
      backPlaced.forEach((b, bi) => {
        const frontFaceZ = b.z + b.size.z / 2 + 0.3;
        for (let col = -1; col <= 1; col += 2) {
          for (let row = 0; row < 5; row++) {
            const hex = palette[(bi + row + (col > 0 ? 1 : 0)) % palette.length];
            const mat = new THREE.MeshBasicMaterial({ color: hex });
            const led = new THREE.Mesh(ledGeo, mat);
            led.position.set(
              b.x + col * Math.min(1.6, b.size.x * 0.25),
              floorY + 2.5 + row * ((b.size.y - 4.5) / 4),
              frontFaceZ
            );
            this.dcGroup.add(led);
            this.dcLeds.push({
              mesh: led,
              mat,
              speed: 3 + ((bi * 7 + row * 11 + (col > 0 ? 3 : 0)) % 9),
              phase: bi * 1.7 + row * 2.3 + col
            });
          }
        }
      });

      // 6. Pulsing datacentre status light & updated top height
      this.dcLight = new THREE.PointLight(0x38bdf8, 3.2, 55);
      this.dcLight.position.set(0, 18, frontZ + 10);
      this.dcGroup.add(this.dcLight);

      const maxBackH = Math.max(18, ...backPlaced.map((b) => b.size.y));
      this.tops.server = floorY + maxBackH + 3;

      // Dock stored golden key cleanly outside the front-right edge (zero clipping)
      if (this.storedKey) {
        this.storedKey.position.set(POS.server.x + padW * 0.42, 22, POS.server.z + padD * 0.42);
      }

      // Mirror the completed Datacentre into the Upside-Down Law Enforcement world (Meta / X Datacentre)!
      if (this.leoGroup && this.leoPos) {
        if (this.leoDcMirror) this.leoGroup.remove(this.leoDcMirror);
        this.leoDcMirror = this.dcGroup.clone(true);
        this.leoDcMirror.position.set(this.leoPos.bot.x, 0, this.leoPos.bot.z - 5);
        this.leoDcMirror.rotation.y = 0;
        this.leoDcMirror.scale.set(-0.68, 0.68, 0.68); // mirrored X for the Upside Down!
        this.leoGroup.add(this.leoDcMirror);
      }
    };

    for (const s of specs) {
      this.loader.load(s.path, (gltf) => {
        const obj = gltf.scene;
        if (s.ry) obj.rotation.y = s.ry;
        obj.updateMatrixWorld(true);
        let box = new THREE.Box3().setFromObject(obj);
        const raw = box.getSize(new THREE.Vector3());
        const sy = s.targetH / (raw.y || 1);
        const maxFootprint = 10.5;
        const sxz = Math.min(sy, maxFootprint / Math.max(raw.x || 1, raw.z || 1));
        obj.scale.set(sxz, s.uniformH ? sy : sxz, sxz);

        obj.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(obj);
        const c = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Wrap so wrap origin sits at bottom-center (x=0, y=0, z=0)
        const wrap = new THREE.Group();
        obj.position.set(-c.x, -box.min.y, -c.z);
        this.harmonizeAsset(obj, { minRough: 0.30, maxRough: 0.58, maxMetal: 0.70, envIntensity: 0.9 });
        wrap.add(obj);

        loaded[s.key] = { wrap, size };
        if (--remaining === 0) finalizeLayout();
        done();
      }, undefined, (err) => {
        console.warn('DC model failed:', s.path, err);
        if (--remaining === 0) finalizeLayout();
        done();
      });
    }
  }

  createWindSwissFlag() {
    // Wind-animated 3D Swiss Flag (square red banner + crisp white cross, zero background)
    const group = new THREE.Group();

    // Metallic flagpole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 24, 12),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.25 })
    );
    pole.position.set(-7, 12, 0);
    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.2 })
    );
    finial.position.set(-7, 24.4, 0);
    group.add(pole, finial);

    // High-res Swiss flag CanvasTexture (no background, pure red + white cross)
    const cvs = document.createElement('canvas');
    cvs.width = 512; cvs.height = 512;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(208, 96, 96, 320);
    ctx.fillRect(96, 208, 320, 96);
    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;

    const flagGeo = new THREE.PlaneGeometry(14, 14, 24, 16);
    const flagMat = new THREE.MeshStandardMaterial({
      map: tex, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.05
    });
    this.swissFlagMesh = new THREE.Mesh(flagGeo, flagMat);
    this.swissFlagMesh.position.set(0, 16.5, 0);
    // Cache rest X/Y so we can ripple Z smoothly in wind loop
    this.swissFlagBase = Float32Array.from(flagGeo.attributes.position.array);
    group.add(this.swissFlagMesh, new THREE.PointLight(0xf43f5e, 2.5, 34));
    return group;
  }

  create3DPhotoIdCard(scale = 1) {
    // High-res fictional 3D Government Photo ID Card (Driver's License)
    const cvs = document.createElement('canvas');
    cvs.width = 512; cvs.height = 320;
    const ctx = cvs.getContext('2d');

    // Card base gradient
    const bg = ctx.createLinearGradient(0, 0, 512, 320);
    bg.addColorStop(0, '#e0f2fe');
    bg.addColorStop(1, '#bae6fd');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 320);

    // Top header band
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(0, 0, 512, 58);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('DRIVER LICENSE  ·  SUBSCRIBER ID', 20, 36);

    // Portrait frame + stylized silhouette avatar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(22, 78, 128, 158);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.arc(86, 130, 28, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(86, 224, 48, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#0284c7'; ctx.lineWidth = 3;
    ctx.strokeRect(22, 78, 128, 158);

    // Fictional subscriber fields
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('DOE, JOHN A.', 170, 108);
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('ID:  D-849-221-904', 170, 140);
    ctx.fillText('DOB: 04/12/1991', 170, 166);
    ctx.fillText('TEL: +1 (555) 019-4821', 170, 192);
    ctx.fillText('742 EVERGREEN TER', 170, 218);
    ctx.fillText('IP:  198.51.100.42', 170, 244);

    // Bottom barcode strip
    ctx.fillStyle = '#0f172a';
    for (let x = 22; x < 488; x += 6) {
      const w = ((x * 13) % 4) + 1;
      ctx.fillRect(x, 266, w, 34);
    }

    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.4, roughness: 0.3 });
    const faceMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.22, metalness: 0.08, clearcoat: 0.9 });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 6.0, 0.3),
      [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, faceMat]
    );
    mesh.scale.setScalar(scale);
    return mesh;
  }

  create3DCreditCard(scale = 1) {
    // High-res fictional 3D Platinum Credit Card
    const cvs = document.createElement('canvas');
    cvs.width = 512; cvs.height = 320;
    const ctx = cvs.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, 512, 320);
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(0.55, '#1e3a8a');
    bg.addColorStop(1, '#020617');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 320);

    // Subtle diagonal metallic sheen band
    ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.beginPath(); ctx.moveTo(260, 0); ctx.lineTo(420, 0); ctx.lineTo(240, 320); ctx.lineTo(80, 320); ctx.closePath(); ctx.fill();

    // Issuer label
    ctx.fillStyle = '#93c5fd';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('BILLING CARD  ·  PLATINUM', 28, 42);

    // Gold EMV chip
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(32, 86, 68, 52);
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 2;
    ctx.strokeRect(32, 86, 68, 52);
    ctx.beginPath(); ctx.moveTo(32, 112); ctx.lineTo(100, 112); ctx.moveTo(66, 86); ctx.lineTo(66, 138); ctx.stroke();

    // Fictional card number
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('4532  8810  ••••  4921', 32, 198);

    // Cardholder & expiry
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 17px monospace';
    ctx.fillText('JOHN A DOE', 32, 266);
    ctx.fillText('EXP 09/29', 260, 266);

    // Overlapping network circles (red & amber)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
    ctx.beginPath(); ctx.arc(432, 256, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(251, 191, 36, 0.88)';
    ctx.beginPath(); ctx.arc(460, 256, 24, 0, Math.PI * 2); ctx.fill();

    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.25 });
    const faceMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.20, metalness: 0.35, clearcoat: 1.0 });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 6.0, 0.3),
      [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, faceMat]
    );
    mesh.scale.setScalar(scale);
    return mesh;
  }

  createSubscriberCardPair(scale = 1) {
    const g = new THREE.Group();
    const idCard = this.create3DPhotoIdCard(1.0);
    idCard.position.set(-2.6, 1.4, 0.8);
    idCard.rotation.set(0.05, 0.14, 0.08);
    const ccCard = this.create3DCreditCard(1.0);
    ccCard.position.set(2.6, -1.4, -0.8);
    ccCard.rotation.set(-0.05, -0.14, -0.08);
    g.add(idCard, ccCard, new THREE.PointLight(0x38bdf8, 3.2, 40));
    g.scale.setScalar(scale);
    return g;
  }

  initLeoStage() {
    // Underside Law Enforcement Reverse-Trace Stage (swings upright when worldPivot flips 180°!)
    const L = {
      bandit: new THREE.Vector3( D, 0,  D), // front-right: Suspect (badguy@protonmail.com)
      swat:   new THREE.Vector3(-D, 0,  D), // front-left:  Police / SWAT LEO
      proton: new THREE.Vector3(-D, 0, -D), // back-left:   Proton Switzerland (wind-animated flag!)
      ag:     new THREE.Vector3( D, 0, -D), // back-right:  Apple & Google Subscriber DB
      bot:    new THREE.Vector3( 0, 0,  4)  // center:      Mirrored Meta/X Datacentre + Facebook + SpiderFoot
    };
    this.leoPos = L;
    this.leoTops = { bandit: 26, swat: 26, bot: 24, proton: 26, ag: 26 };

    // Wind-Animated 3D Swiss Flag for Proton node (zero background)
    this.protonGroup = this.createWindSwissFlag();
    this.protonGroup.position.set(L.proton.x, 0, L.proton.z);
    this.protonGroup.rotation.y = Math.PI * 0.2;
    this.leoGroup.add(this.protonGroup);

    // Glowing red rejection X flash at Proton when demand bounces
    this.rejectX = new THREE.Group();
    const xMat = new THREE.MeshBasicMaterial({ color: 0xff1e56 });
    const x1 = new THREE.Mesh(new THREE.BoxGeometry(10, 1.5, 1.5), xMat); x1.rotation.z =  Math.PI / 4;
    const x2 = new THREE.Mesh(new THREE.BoxGeometry(10, 1.5, 1.5), xMat); x2.rotation.z = -Math.PI / 4;
    this.rejectX.add(x1, x2);
    this.rejectX.position.set(L.proton.x, 22, L.proton.z + 4);
    this.rejectX.visible = false;
    this.leoGroup.add(this.rejectX);

    // Apple & Google Subscriber Vault (cloned Shopping Bag mounts here once logos finish loading,
    // topped with a glowing 3D Subscriber ID Card stack!)
    this.leoAgGroup = new THREE.Group();
    this.leoAgGroup.position.set(L.ag.x, 0, L.ag.z);
    this.leoGroup.add(this.leoAgGroup);

    // Floating 3D Photo ID + 3D Credit Card hovering above the Apple/Google Shopping Bag
    this.leoIdStack = this.createSubscriberCardPair(1.1);
    this.leoIdStack.position.set(0, 35, 0);
    this.leoAgGroup.add(this.leoIdStack);
    this.leoTops.ag = 42;

    // LEO investigative arcs
    const pBandit = L.bandit.clone().setY(16);
    const pSwat   = L.swat.clone().setY(16);
    const pProton = L.proton.clone().setY(14);
    const pBot    = L.bot.clone().setY(14);
    const pAg     = L.ag.clone().setY(15);

    this.arcLeoThreat = new THREE.QuadraticBezierCurve3(pBandit, new THREE.Vector3(0, 22, R + 8), pSwat);
    this.arcLeoProton = new THREE.QuadraticBezierCurve3(pSwat,   new THREE.Vector3(-R - 8, 26, 0), pProton);
    this.arcLeoOsint  = new THREE.QuadraticBezierCurve3(pSwat,   new THREE.Vector3(-16, 24, 18),   pBot);
    this.arcLeoTokens = new THREE.QuadraticBezierCurve3(pBot,    new THREE.Vector3(-16, 28, 20),   pSwat);
    this.arcLeoToAg   = new THREE.QuadraticBezierCurve3(pSwat,   new THREE.Vector3(0, 34, 0),      pAg);
    this.arcLeoFromAg = new THREE.QuadraticBezierCurve3(pAg,     new THREE.Vector3(0, 26, 12),     pSwat);

    this.leoLines = [
      this.addArc(this.arcLeoThreat, 0xf43f5e, 0.5, this.leoGroup),
      this.addArc(this.arcLeoProton, 0xf43f5e, 0.35, this.leoGroup),
      this.addArc(this.arcLeoOsint,  0xfbbf24, 0.45, this.leoGroup),
      this.addArc(this.arcLeoToAg,   0x38bdf8, 0.45, this.leoGroup),
      this.addArc(this.arcLeoFromAg, 0x34d399, 0.5, this.leoGroup)
    ];

    // LEO moving packets (threat/demand/token/ID)
    this.leoPacketMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xbe123c, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.25 });
    this.leoPacket = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.8, 0.8), this.leoPacketMat);
    this.leoPacketLight = new THREE.PointLight(0xf43f5e, 3.5, 30);
    this.leoPacket.add(this.leoPacketLight);
    this.leoPacket.visible = false;
    this.leoGroup.add(this.leoPacket);

    this.leoKey = this.createTokenKey(1.3);
    this.leoKey.visible = false;
    this.leoGroup.add(this.leoKey);

    // 3D Photo ID + 3D Credit Card that fly from Apple/Google -> Police in Beat 6!
    this.leoDeliveredCards = this.createSubscriberCardPair(1.25);
    this.leoDeliveredCards.visible = false;
    this.leoGroup.add(this.leoDeliveredCards);

    this.leoGroup.visible = false;
  }

  loadModels() {
    const status = document.getElementById('load-status');
    let left = 16; // 8 datacentre + phone + postbox + apple + google + ufo + bandit + swat + facebook
    const done = () => { if (--left <= 0) status.style.display = 'none'; };

    // 1. Datacentre Cluster (front-left)
    this.initDatacentreCluster(done);

    // 2. Smartphone (front-right)
    this.loader.load('models/generic_smartphone_game-ready.glb', (gltf) => {
      const phone = gltf.scene;
      phone.rotation.y = -Math.PI * 0.25;
      this.harmonizeAsset(phone, { minRough: 0.22, maxRough: 0.55, maxMetal: 0.72, envIntensity: 0.95 });
      this.tops.phone = this.ground(phone, 28, POS.phone);
      this.normalGroup.add(phone);
      done();
    }, undefined, done);

    // 3. Edward VII Post Box — APNs/FCM (back-left)
    this.loader.load('models/postbox.glb', (gltf) => {
      const post = gltf.scene;
      post.rotation.y = Math.PI * 0.25;
      this.harmonizeAsset(post, { minRough: 0.32, maxRough: 0.60, maxMetal: 0.55, envIntensity: 0.85, liftDark: false });
      this.tops.post = this.ground(post, 32, POS.post);
      this.normalGroup.add(post);
      done();
    }, undefined, done);

    // 4. App Store Shopping Bag with Apple flat on front (+Z) and Google flat on back (-Z)
    this.initAppStoreBag(done);

    // 5. UFO — External Event Trigger hovering above the App Server!
    this.loader.load('models/ufo.glb', (gltf) => {
      this.ufoGroup = new THREE.Group();
      const ufo = gltf.scene;
      this.harmonizeAsset(ufo, { minRough: 0.26, maxRough: 0.55, maxMetal: 0.75, envIntensity: 0.95 });
      this.centerAndScale(ufo, 28);
      this.ufoGroup.add(ufo);

      this.ufoBeamMat = new THREE.MeshBasicMaterial({
        color: 0x34d399, transparent: true, opacity: 0.08, side: THREE.DoubleSide
      });
      const beam = new THREE.Mesh(new THREE.ConeGeometry(12, 24, 32, 1, true), this.ufoBeamMat);
      beam.position.y = -13;
      this.ufoGroup.add(beam);

      this.ufoGroup.position.copy(POS.ufo);
      this.normalGroup.add(this.ufoGroup);
      done();
    }, undefined, done);

    // 6. Law Enforcement Models (mounted on underside leoGroup)
    this.loader.load('models/leo/bandit.glb?v=6', (gltf) => {
      const rawModel = gltf.scene;
      // bandit_from_stalker.glb is Z-up (head at -Z); rotate +90° around X to stand upright on Y!
      const upright = new THREE.Group();
      rawModel.rotation.x = Math.PI / 2;
      upright.add(rawModel);
      upright.rotation.y = -Math.PI * 0.35;
      this.harmonizeAsset(rawModel, { minRough: 0.42, maxRough: 0.72, maxMetal: 0.30, envIntensity: 0.85, liftDark: false });
      this.leoTops.bandit = this.ground(upright, 26, this.leoPos.bandit);
      this.leoGroup.add(upright);
      done();
    }, undefined, done);

    this.loader.load('models/leo/swat.glb', (gltf) => {
      const m = gltf.scene;
      m.rotation.y = Math.PI * 0.35;
      this.harmonizeAsset(m, { minRough: 0.36, maxRough: 0.66, maxMetal: 0.45, envIntensity: 0.85, liftDark: false });
      this.leoTops.swat = this.ground(m, 26, this.leoPos.swat);
      this.leoGroup.add(m);
      done();
    }, undefined, done);

    // 7. Facebook / Meta Logo hovering above the Mirrored Datacentre in LEO mode (icon excluded from shine pass)
    this.loader.load('models/leo/facebook.glb', (gltf) => {
      this.fbLogo = gltf.scene;
      this.centerAndScale(this.fbLogo, 12);
      this.fbLogo.position.set(this.leoPos.bot.x, 22, this.leoPos.bot.z - 5);
      this.leoGroup.add(this.fbLogo);
      done();
    }, undefined, done);
  }

  initAppStoreBag(done) {
    // Sculpted tapered dark-obsidian luxury shopping bag (high contrast for silver Apple + colorful Google!)
    this.storeGroup = new THREE.Group();
    this.storeGroup.position.set(POS.store.x, 0, POS.store.z);
    this.storeGroup.rotation.y = -Math.PI * 0.25;
    this.normalGroup.add(this.storeGroup);

    const bagW = 19.5;
    const bagH = 21.5;
    const bagD = 9.6;
    const topScaleX = 0.86;
    const topScaleZ = 0.74;

    const bagMat = new THREE.MeshStandardMaterial({
      color: 0x111827, roughness: 0.50, metalness: 0.14, envMapIntensity: 0.9
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, roughness: 0.42, metalness: 0.22, envMapIntensity: 0.9
    });
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x020617, roughness: 0.95, metalness: 0.0
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1, roughness: 0.25, metalness: 0.85, envMapIntensity: 1.0
    });
    const cordMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8, emissive: 0x0369a1, emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.25
    });

    // Tapered bag body with authentic side gusset V-pinch
    const bodyGeo = new THREE.BoxGeometry(bagW, bagH, bagD, 4, 8, 4);
    const pos = bodyGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      const y = pos.getY(i);
      let z = pos.getZ(i);
      const tY = (y + bagH / 2) / bagH; // 0 at bottom, 1 at top
      const sx = 1 - (1 - topScaleX) * tY;
      const sz = 1 - (1 - topScaleZ) * tY;
      x *= sx;
      z *= sz;
      // Subtle inward gusset fold along left/right side midlines (where |z| is near 0)
      const isSide = Math.abs(Math.abs(x) - (bagW * sx) / 2) < 0.25;
      if (isSide && Math.abs(z) < (bagD * sz) * 0.35) {
        const fold = (1 - Math.abs(z) / ((bagD * sz) * 0.35)) * 1.15 * (0.3 + 0.7 * tY);
        x -= Math.sign(x) * fold;
      }
      pos.setXYZ(i, x, y, z);
    }
    bodyGeo.computeVertexNormals();
    const body = new THREE.Mesh(bodyGeo, bagMat);
    body.position.y = bagH / 2;
    this.storeGroup.add(body);

    const topW = bagW * topScaleX;
    const topD = bagD * topScaleZ;

    // Dark recessed interior opening at top
    const cavity = new THREE.Mesh(new THREE.BoxGeometry(topW - 1.1, 0.8, topD - 1.1), innerMat);
    cavity.position.y = bagH - 0.32;
    this.storeGroup.add(cavity);

    // Sleek reinforced cuff lip around top opening
    const rim = new THREE.Mesh(new THREE.BoxGeometry(topW + 0.35, 1.3, topD + 0.35), rimMat);
    rim.position.y = bagH - 0.65;
    this.storeGroup.add(rim);

    // Twin curved cord handles + silver grommet eyelets (front +Z and back -Z)
    const handleSpan = 3.8;
    const eyeletGeo = new THREE.TorusGeometry(0.5, 0.15, 8, 20);
    for (const side of [1, -1]) {
      const z = side * (topD / 2 + 0.14);
      for (const sx of [-1, 1]) {
        const eyelet = new THREE.Mesh(eyeletGeo, trimMat);
        eyelet.position.set(sx * handleSpan, bagH - 2.0, z);
        this.storeGroup.add(eyelet);
      }
      const handleCurve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(-handleSpan, bagH - 2.0, z),
        new THREE.Vector3(-handleSpan * 0.88, bagH + 6.8, z),
        new THREE.Vector3( handleSpan * 0.88, bagH + 6.8, z),
        new THREE.Vector3( handleSpan, bagH - 2.0, z)
      );
      const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 28, 0.36, 10, false), cordMat);
      this.storeGroup.add(handle);
    }

    this.tops.store = bagH + 9.2;

    // Exact surface depth & slope angle at mid-bag height (y = 0.46 * bagH)
    const logoY = bagH * 0.46;
    const midDepth = bagD * (1 - (1 - topScaleZ) * 0.46);
    const wallTilt = Math.atan2((bagD * (1 - topScaleZ)) / 2, bagH);

    // Mount Apple flat on front (+Z) and Google flat on back (-Z), matching tapered wall angle!
    let logosMounted = 0;
    const mountLogoFlat = (path, sideSign, targetSize) => {
      this.loader.load(path, (gltf) => {
        const logo = gltf.scene;
        let box = new THREE.Box3().setFromObject(logo);
        const raw = box.getSize(new THREE.Vector3());
        const s = targetSize / Math.max(raw.x || 1, raw.y || 1);
        logo.scale.set(s, s, Math.min(s, 1.1 / (raw.z || 1)));

        logo.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(logo);
        const c = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const wrap = new THREE.Group();
        logo.position.set(-c.x, -c.y, -c.z);
        wrap.add(logo);
        if (sideSign < 0) wrap.rotation.y = Math.PI;
        wrap.rotation.x = -sideSign * wallTilt; // sit 100% flush against the tapered bag face!
        wrap.position.set(0, logoY, sideSign * (midDepth / 2 + size.z / 2 + 0.12));
        this.storeGroup.add(wrap);

        // Once both Apple & Google logos are mounted, clone the complete bag onto the LEO Subscriber DB node!
        if (++logosMounted === 2 && this.leoAgGroup) {
          if (this.leoAgBag) this.leoAgGroup.remove(this.leoAgBag);
          this.leoAgBag = this.storeGroup.clone(true);
          this.leoAgBag.position.set(0, 0, 0);
          this.leoAgBag.rotation.set(0, 0, 0);
          this.leoAgGroup.add(this.leoAgBag);
        }
        done();
      }, undefined, (err) => { console.warn('Store logo load failed:', path, err); done(); });
    };

    mountLogoFlat('models/apple_logo.glb',  1, 10.2);
    mountLogoFlat('models/google_logo.glb', -1, 10.2);
  }

  centerAndScale(obj, size) {
    let box = new THREE.Box3().setFromObject(obj);
    const dim = box.getSize(new THREE.Vector3());
    obj.scale.setScalar(size / Math.max(dim.x, dim.y, dim.z));
    box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3());
    obj.position.sub(c);
  }

  ground(obj, size, at) {
    let box = new THREE.Box3().setFromObject(obj);
    const dim = box.getSize(new THREE.Vector3());
    obj.scale.setScalar(size / Math.max(dim.x, dim.y, dim.z));
    box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3());
    obj.position.set(at.x - c.x, -box.min.y, at.z - c.z);
    return new THREE.Box3().setFromObject(obj).max.y;
  }

  /* ---------------- Polarity & Law Enforcement Mode Switch ---------------- */
  setMode(mode, resetT = true) {
    if (mode !== 'leo') this.prevNormalMode = mode;
    this.mode = mode;
    if (resetT) {
      this.t = 0;
      this.targetT = 0;
    }

    const isPush = mode === 'push';
    const isLeo  = mode === 'leo';
    this.flipTarget = isLeo ? Math.PI : 0;

    const color = isLeo ? 0xf43f5e : (isPush ? 0x34d399 : 0xfbbf24);
    this.ringMat.color.setHex(color);
    this.beadMat.color.setHex(color);
    this.setupLines.forEach((l) => (l.visible = mode === 'setup'));
    this.pushLines.forEach((l) => (l.visible = isPush));
    this.flowCones.forEach((fc) => (fc.mesh.visible = !isLeo));
    this.leoLines.forEach((l) => (l.visible = isLeo));

    document.body.classList.toggle('leo-mode', isLeo);
    document.getElementById('btn-leo').classList.toggle('active', isLeo);
    document.getElementById('mode-setup').classList.toggle('active', mode === 'setup');
    document.getElementById('mode-push').classList.toggle('active', isPush);
    document.getElementById('brand-dot').classList.toggle('push', isPush);
    document.getElementById('brand-dot').classList.toggle('leo', isLeo);
    document.getElementById('btn-play').classList.toggle('push', isPush);
    document.getElementById('scrub').classList.toggle('push', isPush);

    const banner = document.getElementById('polarity-banner');
    banner.classList.toggle('push', isPush);
    banner.classList.toggle('leo', isLeo);
    document.getElementById('pol-arrow').textContent = isLeo ? '⚖' : (isPush ? '↻' : '↺');
    document.getElementById('pol-label').textContent = isLeo
      ? 'LAW ENFORCEMENT TRACE'
      : (isPush ? 'PUSH DELIVERY' : 'INSTALL & SETUP');
    document.getElementById('pol-route').textContent = isLeo
      ? 'Threat → Proton (Denied) → OSINT Pivot → Meta/X Tokens → Apple/Google ID'
      : (isPush
        ? 'UFO Event → Datacentre → Post Office → Phone'
        : 'Apple/Google → Phone → Post Office → Datacentre');
  }

  setAutoOrbit(on) {
    this.autoOrbit = on;
    document.getElementById('btn-orbit').classList.toggle('on', on);
  }

  setPlaying(auto) {
    this.playing = auto;
    if (!auto) this.targetT = this.t;
    // In Manual Scroll mode, mouse wheel / trackpad scroll smoothly scrubs the action cycle
    this.controls.enableZoom = auto;
    const btn = document.getElementById('btn-play');
    btn.textContent = auto ? '▶ Auto' : '🖱 Scroll';
    btn.classList.toggle('manual', !auto);
  }

  stepCycle(dir) {
    // Step cleanly to the next or previous narrative beat with smooth gliding
    if (this.playing) this.setPlaying(false);
    const stops = MODE_STEPS[this.mode];
    const eps = 0.015;
    if (dir > 0) {
      const next = stops.find((s) => s > this.targetT + eps);
      this.targetT = next !== undefined ? next : stops[0];
    } else {
      const prev = [...stops].reverse().find((s) => s < this.targetT - eps);
      this.targetT = prev !== undefined ? prev : stops[stops.length - 1];
    }
  }

  initUI() {
    document.getElementById('mode-setup').addEventListener('click', () => this.setMode('setup'));
    document.getElementById('mode-push').addEventListener('click', () => this.setMode('push'));
    document.getElementById('btn-leo').addEventListener('click', () => {
      this.setMode(this.mode === 'leo' ? this.prevNormalMode : 'leo');
    });
    document.getElementById('btn-flip').addEventListener('click', () => {
      this.setMode(this.mode === 'setup' ? 'push' : 'setup');
    });

    document.getElementById('scrub').addEventListener('input', (e) => {
      if (this.playing) this.setPlaying(false);
      this.targetT = parseInt(e.target.value, 10) / 1000;
    });
    document.getElementById('btn-play').addEventListener('click', () => {
      this.setPlaying(!this.playing);
    });
    document.getElementById('btn-step-prev').addEventListener('click', () => this.stepCycle(-1));
    document.getElementById('btn-step-next').addEventListener('click', () => this.stepCycle(1));
    document.getElementById('btn-orbit').addEventListener('click', () => this.setAutoOrbit(!this.autoOrbit));
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    });

    // Smooth mouse wheel / trackpad scroll scrubbing in Manual Scroll mode
    this.renderer.domElement.addEventListener('wheel', (e) => {
      if (this.playing) return;
      e.preventDefault();
      const delta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 100) * 0.00055;
      this.targetT = clamp01(this.targetT + delta);
    }, { passive: false });

    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); this.setPlaying(!this.playing); }
      else if (e.key === 'Tab') { e.preventDefault(); this.setMode(this.mode === 'setup' ? 'push' : 'setup'); }
      else if (e.key === '1') this.setMode('setup');
      else if (e.key === '2') this.setMode('push');
      else if (e.key.toLowerCase() === 'l') this.setMode(this.mode === 'leo' ? this.prevNormalMode : 'leo');
      else if (e.key === 'ArrowRight') this.stepCycle(1);
      else if (e.key === 'ArrowLeft')  this.stepCycle(-1);
    });

    this.setPlaying(true);
  }

  /* ---------------- render state from (mode, t) ---------------- */
  updateState() {
    const t = this.t;
    document.getElementById('scrub').value = Math.round(t * 1000);
    document.getElementById('scrub-pct').textContent = Math.round(t * 100) + '%';

    this.appOrb.visible = false;
    this.tokenKey.visible = false;
    this.pushOrb.visible = false;
    this.triggerBolt.visible = false;
    this.brainGroup.visible = false;
    this.leoPacket.visible = false;
    this.leoKey.visible = false;
    this.leoDeliveredCards.visible = false;
    this.rejectX.visible = false;

    const isLeo = this.mode === 'leo';

    // Bejeweled stays visibly installed on the phone once downloaded
    this.installedApp.visible = !isLeo && (this.mode === 'push' || t >= 0.28);
    // Key stays persistently stored on the server once registered!
    this.storedKey.visible = !isLeo && (this.mode === 'push' || t >= 0.90);

    // UFO tractor beam brightens when triggering an external event in Mode 2
    if (this.ufoBeamMat) {
      this.ufoBeamMat.opacity = (this.mode === 'push' && t < 0.20) ? 0.34 : 0.07;
    }

    let moverPos = null;
    let moverParent = this.worldGroup;
    let moverText = '';
    let moverCls = '';

    let showInstall = false;
    let showToken = false;
    let showSaved = false;
    let showPush = false;
    let showLedger = false;

    let showLeoThreat = false;
    let showLeoDenied = false;
    let showLeoOsint  = false;
    let showLeoTokens = false;
    let showLeoId     = false;

    if (this.mode === 'setup') {
      if (t < 0.28) {
        const p = this.arcStoreToPhone.getPoint(seg(t, 0, 0.28));
        this.appOrb.visible = true;
        this.appOrb.position.copy(p);
        moverPos = p;
        moverText = '💎 Installing Bejeweled';
        moverCls = 'cyan';
      } else if (t < 0.38) {
        showInstall = true;
      } else if (t < 0.62) {
        const p = this.arcPostToPhone.getPoint(seg(t, 0.38, 0.62));
        this.tokenKey.visible = true;
        this.tokenKey.position.copy(p);
        moverPos = p;
        moverText = '🔑 Mint Device Key';
      } else if (t < 0.70) {
        showToken = true;
      } else if (t < 0.92) {
        const p = this.arcPhoneToServer.getPoint(seg(t, 0.70, 0.92));
        this.tokenKey.visible = true;
        this.tokenKey.position.copy(p);
        moverPos = p;
        moverText = '🔑 Store Key in Datacentre';
      } else {
        showSaved = true;
      }
    } else if (this.mode === 'push') {
      if (t < 0.20) {
        const p = this.arcUfoToServer.getPoint(seg(t, 0, 0.20));
        this.triggerBolt.visible = true;
        this.triggerBolt.position.copy(p);
        moverPos = p;
        moverText = '⚡ External Event Trigger';
        moverCls = 'cyan';
      } else if (t < 0.42) {
        const p = this.arcServerToPost.getPoint(seg(t, 0.20, 0.42));
        this.pushOrb.visible = true;
        this.pushOrb.position.copy(p);
        moverPos = p;
        moverText = '✉ Payload + 🔑 Key → Post Office';
        moverCls = 'push';
      } else if (t < 0.68) {
        const bp = seg(t, 0.42, 0.68);
        this.brainGroup.visible = true;
        this.updateBrainAndLedger(bp);
        showLedger = true;
      } else if (t < 0.90) {
        const p = this.arcPostToPhone.getPoint(seg(t, 0.68, 0.90));
        this.pushOrb.visible = true;
        this.pushOrb.position.copy(p);
        moverPos = p;
        moverText = '✉ Delivering Push → Phone';
        moverCls = 'push';
      } else {
        showPush = true;
      }
    } else {
      // LAW ENFORCEMENT UPSIDE-DOWN REVERSE TRACE (6 Beats):
      // 0.00–0.16: Bandit sends bomb threat email (badguy@protonmail.com) -> Police
      // 0.16–0.34: Police emergency demand -> Proton Switzerland -> DENIED / BOUNCED!
      // 0.34–0.50: SpiderFoot / Meta & X LEO Portals confirm IG & X accounts
      // 0.50–0.68: Emergency demand to Meta & X -> Push Tokens (🔑) returned to Police!
      // 0.68–0.86: Police serves emergency demand + Tokens to Apple & Google
      // 0.86–1.00: Apple & Google return full Subscriber Identity to Police!
      moverParent = this.leoGroup;
      if (t < 0.16) {
        const p = this.arcLeoThreat.getPoint(seg(t, 0, 0.12));
        this.leoPacket.visible = true;
        this.leoPacket.position.copy(p);
        this.leoPacketMat.color.setHex(0xf43f5e);
        this.leoPacketMat.emissive.setHex(0xbe123c);
        this.leoPacketLight.color.setHex(0xf43f5e);
        if (t < 0.12) {
          moverPos = p;
          moverText = '✉ Threat · badguy@protonmail.com';
          moverCls = 'red';
        } else {
          showLeoThreat = true;
        }
      } else if (t < 0.34) {
        const u = seg(t, 0.16, 0.28);
        const p = this.arcLeoProton.getPoint(u);
        this.leoPacket.visible = t < 0.29;
        this.leoPacket.position.copy(p);
        this.leoPacketMat.color.setHex(0xf43f5e);
        this.leoPacketMat.emissive.setHex(0xbe123c);
        if (t < 0.26) {
          moverPos = p;
          moverText = '⚖ Emergency Demand → Proton (CH)';
          moverCls = 'red';
        } else {
          this.rejectX.visible = true;
          showLeoDenied = true;
        }
      } else if (t < 0.50) {
        const p = this.arcLeoOsint.getPoint(seg(t, 0.34, 0.44));
        this.leoPacket.visible = t < 0.45;
        this.leoPacket.position.copy(p);
        this.leoPacketMat.color.setHex(0xfbbf24);
        this.leoPacketMat.emissive.setHex(0xb45309);
        this.leoPacketLight.color.setHex(0xfbbf24);
        if (t < 0.43) {
          moverPos = p;
          moverText = '🔎 Query SpiderFoot / Meta & X Portals';
        } else {
          showLeoOsint = true;
        }
      } else if (t < 0.68) {
        const p = this.arcLeoTokens.getPoint(seg(t, 0.50, 0.63));
        this.leoKey.visible = true;
        this.leoKey.position.copy(p);
        if (t < 0.62) {
          moverPos = p;
          moverText = '🔑 Meta & X Return Push Tokens';
        } else {
          showLeoTokens = true;
        }
      } else if (t < 0.86) {
        const p = this.arcLeoToAg.getPoint(seg(t, 0.68, 0.84));
        this.leoKey.visible = true;
        this.leoKey.position.copy(p);
        moverPos = p;
        moverText = '⚖ Emergency Demand + 🔑 Tokens → Apple/Google';
        moverCls = 'cyan';
      } else {
        // Beat 6: 3D Photo ID + Credit Card fly from Apple/Google -> Police and fan out above Police!
        const p = this.arcLeoFromAg.getPoint(seg(t, 0.86, 0.94));
        this.leoDeliveredCards.visible = true;
        if (t < 0.94) {
          this.leoDeliveredCards.position.copy(p);
          moverPos = p;
          moverText = '🪪 Returning Photo ID + Billing Card';
          moverCls = 'push';
        } else {
          this.leoDeliveredCards.position.set(this.leoPos.swat.x, this.leoTops.swat + 8, this.leoPos.swat.z);
          showLeoId = true;
        }
      }
    }

    // Normal mode station labels (hidden when flipped to Law Enforcement)
    const showNorm = !isLeo && this.flipRoll < Math.PI * 0.45;
    this.place('pin-store',  new THREE.Vector3(POS.store.x,  this.tops.store, POS.store.z), showNorm);
    this.place('pin-post',   new THREE.Vector3(POS.post.x,   this.tops.post + 2, POS.post.z), showNorm);
    this.place('pin-phone',  new THREE.Vector3(POS.phone.x,  -1.5, POS.phone.z + 8), showNorm);
    this.place('pin-server', new THREE.Vector3(POS.server.x, -1.5, POS.server.z + 8), showNorm);
    this.place('pin-ufo',    new THREE.Vector3(POS.ufo.x,    POS.ufo.y + 10, POS.ufo.z), showNorm);

    // Law Enforcement station labels (visible when flipped upside down!)
    const showLeoPins = isLeo && this.flipRoll > Math.PI * 0.55;
    const L = this.leoPos;
    this.place('pin-leo-bandit', new THREE.Vector3(L.bandit.x, -1.5, L.bandit.z + 8), showLeoPins, this.leoGroup);
    this.place('pin-leo-swat',   new THREE.Vector3(L.swat.x,   -1.5, L.swat.z + 8),   showLeoPins, this.leoGroup);
    this.place('pin-leo-bot',    new THREE.Vector3(L.bot.x,    -1.5, L.bot.z + 8),    showLeoPins, this.leoGroup);
    this.place('pin-leo-proton', new THREE.Vector3(L.proton.x, this.leoTops.proton + 2, L.proton.z), showLeoPins, this.leoGroup);
    this.place('pin-leo-ag',     new THREE.Vector3(L.ag.x,     this.leoTops.ag + 2, L.ag.z), showLeoPins, this.leoGroup);

    // Normal contextual callouts
    const phoneTop  = new THREE.Vector3(POS.phone.x,  this.tops.phone + 11, POS.phone.z);
    const serverTop = new THREE.Vector3(POS.server.x, this.tops.server + 4, POS.server.z);
    this.place('pin-install', phoneTop,  showNorm && showInstall);
    this.place('pin-token',   phoneTop,  showNorm && showToken);
    this.place('pin-saved',   serverTop, showNorm && showSaved);
    this.place('pin-push',    phoneTop,  showNorm && showPush);
    this.place('pin-ledger',  new THREE.Vector3(POS.post.x, 46, POS.post.z), showNorm && showLedger);

    // Law Enforcement contextual callouts
    this.place('pin-leo-threat', new THREE.Vector3(L.swat.x,   this.leoTops.swat + 4,   L.swat.z),   showLeoPins && showLeoThreat, this.leoGroup);
    this.place('pin-leo-denied', new THREE.Vector3(L.proton.x, this.leoTops.proton + 6, L.proton.z), showLeoPins && showLeoDenied, this.leoGroup);
    this.place('pin-leo-osint',  new THREE.Vector3(L.bot.x,    this.leoTops.bot + 5,    L.bot.z),    showLeoPins && showLeoOsint,  this.leoGroup);
    this.place('pin-leo-tokens', new THREE.Vector3(L.swat.x,   this.leoTops.swat + 4,   L.swat.z),   showLeoPins && showLeoTokens, this.leoGroup);
    this.place('pin-leo-id',     new THREE.Vector3(L.swat.x,   this.leoTops.swat + 4,   L.swat.z),   showLeoPins && showLeoId,     this.leoGroup);

    const mv = document.getElementById('pin-mover');
    mv.className = 'pin pin-mover' + (moverCls ? ' ' + moverCls : '');
    mv.textContent = moverText;
    this.place('pin-mover', moverPos ? moverPos.clone().add(new THREE.Vector3(0, 4.5, 0)) : null, !!moverPos, moverParent);
  }

  place(id, localPos, show, parentGroup = this.worldGroup) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!show || !localPos) { el.style.display = 'none'; return; }
    const worldPos = localPos.clone().applyMatrix4(parentGroup.matrixWorld);
    const p = worldPos.project(this.camera);
    if (p.z > 1 || p.z < -1) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    const w = el.offsetWidth || 120;
    const h = el.offsetHeight || 40;
    const minY = id === 'pin-ledger' ? 84 + h : 76;
    const x = Math.max(w / 2 + 16, Math.min(innerWidth - w / 2 - 16, (p.x * 0.5 + 0.5) * innerWidth));
    const y = Math.max(minY, Math.min(innerHeight - 134, (-p.y * 0.5 + 0.5) * innerHeight));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    // Smooth 180° upside-down world flip with EXCLUSIVE visibility (never see the other world!)
    this.flipRoll += (this.flipTarget - this.flipRoll) * Math.min(1, dt * 4.5);
    if (Math.abs(this.flipTarget - this.flipRoll) < 0.002) this.flipRoll = this.flipTarget;
    this.worldPivot.rotation.z = this.flipRoll;
    const leoInFocus = this.flipRoll >= Math.PI * 0.5;
    this.normalGroup.visible = !leoInFocus;
    this.leoGroup.visible = leoInFocus;
    this.worldPivot.updateMatrixWorld(true);

    // Real-time wind wave animation for the 3D Swiss Flag (zero background)
    if (this.swissFlagMesh && this.leoGroup.visible) {
      const pos = this.swissFlagMesh.geometry.attributes.position;
      const base = this.swissFlagBase;
      const tW = now * 0.0055;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3];
        const by = base[i * 3 + 1];
        // Pin left edge (bx = -7) to flagpole; ripple increases cleanly toward right fly edge
        const pinFactor = clamp01((bx + 7) / 14);
        const wave = Math.sin(bx * 0.55 - tW) * 1.15 + Math.cos(by * 0.4 - tW * 0.8) * 0.45;
        pos.setZ(i, wave * pinFactor);
      }
      pos.needsUpdate = true;
      this.swissFlagMesh.geometry.computeVertexNormals();
    }

    if (this.fbLogo && this.leoGroup.visible) this.fbLogo.rotation.y += dt * 0.75;
    if (this.leoAgBag && this.leoGroup.visible) this.leoAgBag.rotation.y += dt * 0.45;
    if (this.leoIdStack && this.leoGroup.visible) {
      this.leoIdStack.rotation.y -= dt * 0.6;
      this.leoIdStack.position.y = 35 + Math.sin(now * 0.003) * 1.1;
    }
    if (this.leoDeliveredCards && this.leoDeliveredCards.visible) {
      this.leoDeliveredCards.rotation.y += dt * 0.7;
    }
    if (this.osintBot)    this.osintBot.rotation.y += dt * 0.55;
    if (this.leoKey && this.leoKey.visible) this.leoKey.rotation.y += dt * 2.4;
    if (this.rejectX && this.rejectX.visible) {
      const s = 1 + Math.sin(now * 0.015) * 0.12;
      this.rejectX.scale.setScalar(s);
    }

    if (this.playing) {
      this.t = (this.t + dt / MODE_SECONDS[this.mode]) % 1;
      this.targetT = this.t;
    } else {
      // Smooth damped glide toward targetT for silky scroll & step transitions
      this.t += (this.targetT - this.t) * Math.min(1, dt * 10);
      if (Math.abs(this.targetT - this.t) < 0.0004) this.t = this.targetT;
    }

    if (this.autoOrbit) {
      this.orbitAngle += dt * 0.12;
      const camR = 136;
      this.camera.position.set(
        Math.sin(this.orbitAngle) * camR,
        56 + Math.sin(this.orbitAngle * 0.7) * 6,
        Math.cos(this.orbitAngle) * camR
      );
      this.controls.target.set(0, 16, 0);
    }

    // Directional flow cones glide directly along the active mode's arcs
    const activeCurves = this.mode === 'setup' ? this.setupCurves : this.pushCurves;
    const speed = (now * 0.00028) % 1;
    for (const fc of this.flowCones) {
      const curve = activeCurves[fc.curveIdx];
      const u = (fc.offset + speed) % 1;
      const p = curve.getPoint(u);
      const pNext = curve.getPoint(Math.min(1, u + 0.02));
      fc.mesh.position.copy(p);
      fc.mesh.lookAt(pNext);
    }

    // Gently rotate the 3D Brain & neural sparks when active above the Post Office
    if (this.brainGroup && this.brainGroup.visible) {
      this.brainGroup.rotation.y += dt * 0.9;
      this.brainGroup.position.y = 38 + Math.sin(now * 0.004) * 0.8;
      if (this.brainSparks) this.brainSparks.rotation.y -= dt * 1.4;
    }

    if (this.ufoGroup) {
      this.ufoGroup.rotation.y += dt * 0.7;
      this.ufoGroup.position.y = POS.ufo.y + Math.sin(now * 0.0025) * 1.4;
    }
    if (this.storeGroup) {
      // Gently spin the App Store shopping bag so both Apple & Google sides showcase smoothly
      this.storeGroup.rotation.y += dt * 0.45;
    }

    this.appOrb.rotation.y += dt * 1.4;
    if (this.installedApp.visible) {
      this.installedApp.rotation.y += dt * 0.9;
      this.installedApp.position.y = this.tops.phone + 5 + Math.sin(now * 0.003) * 0.8;
    }
    this.tokenKey.rotation.y += dt * 2.4;
    if (this.storedKey.visible) {
      this.storedKey.rotation.y += dt * 1.1;
    }
    this.pushOrb.rotation.y = Math.sin(now * 0.003) * 0.35;
    this.stars.rotation.y += dt * 0.015;

    // Animate flashing Datacentre LEDs (burst faster when triggered or saving!)
    if (this.dcLeds) {
      const busy = (this.mode === 'push' && this.t < 0.44) || (this.mode === 'setup' && this.t >= 0.85);
      const mult = busy ? 2.6 : 1.0;
      const tSec = now * 0.001;
      for (const l of this.dcLeds) {
        const on = Math.sin(tSec * l.speed * mult + l.phase) > -0.15;
        l.mesh.visible = on;
      }
      if (this.dcLight) {
        this.dcLight.color.setHex(busy ? 0x34d399 : 0x38bdf8);
        this.dcLight.intensity = busy ? 4.5 + Math.sin(tSec * 14) * 1.5 : 2.8 + Math.sin(tSec * 4) * 0.6;
      }
    }

    this.controls.update();
    this.updateState();
    this.renderer.render(this.scene, this.camera);
  }
}

addEventListener('DOMContentLoaded', () => new PushnotOrbit());
