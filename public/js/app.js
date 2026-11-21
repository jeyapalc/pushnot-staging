import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

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

const MODE_SECONDS = { setup: 11, push: 9 };
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));

class PushnotOrbit {
  constructor() {
    this.container = document.getElementById('canvas-container');

    this.loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
    this.loader.setDRACOLoader(draco);

    this.mode = 'setup';
    this.t = 0.0;
    this.playing = true;
    this.autoOrbit = true;
    this.orbitAngle = 0.35;
    this.lastFrame = performance.now();
    this.tops = { phone: 28, server: 34, post: 32, store: 28 };

    this.initScene();
    this.initLights();
    this.initOrbitRing();
    this.initMovers();
    this.loadModels();
    this.initUI();
    this.setMode('setup', false);
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05080f, 0.003);

    this.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 1500);
    this.camera.position.set(42, 58, 134);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;
    this.container.appendChild(this.renderer.domElement);

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
    this.scene.add(new THREE.AmbientLight(0xeef6ff, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(60, 130, 80); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x38bdf8, 1.4); fill.position.set(-80, 90, -50); this.scene.add(fill);
    const warm = new THREE.DirectionalLight(0xfbbf24, 1.1); warm.position.set(0, 50, -110); this.scene.add(warm);
  }

  initOrbitRing() {
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.32 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.22, 12, 128), this.ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    this.scene.add(ring);

    const outer = new THREE.Mesh(
      new THREE.TorusGeometry(R + 11, 0.08, 8, 128),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.12 })
    );
    outer.rotation.x = Math.PI / 2;
    outer.position.y = 0.1;
    this.scene.add(outer);

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
      this.addArc(this.arcStoreToPhone,  0x38bdf8, 0.4),
      this.addArc(this.arcPostToPhone,   0xfbbf24, 0.35),
      this.addArc(this.arcPhoneToServer, 0xfbbf24, 0.4)
    ];
    this.pushLines = [
      this.addArc(this.arcServerToPost, 0x34d399, 0.45),
      this.addArc(this.arcPostToPhone,  0x34d399, 0.45)
    ];

    // Directional flow cones gliding directly along the active mode's arcs (100% accurate polarity!)
    this.flowCones = [];
    this.beadMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const coneGeo = new THREE.ConeGeometry(0.85, 2.4, 8);
    coneGeo.rotateX(Math.PI / 2);
    for (let c = 0; c < 3; c++) {
      for (let k = 0; k < 3; k++) {
        const mesh = new THREE.Mesh(coneGeo, this.beadMat);
        this.scene.add(mesh);
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

  addArc(curve, color, opacity) {
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
    const mat = new THREE.LineDashedMaterial({ color, dashSize: 2.2, gapSize: 1.4, transparent: true, opacity });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    this.scene.add(line);
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
    this.scene.add(this.appOrb);

    // 2. Installed Bejeweled hovering above the Phone
    this.installedApp = this.createBejeweledCluster(0.85);
    this.installedApp.position.set(POS.phone.x, 32, POS.phone.z);
    this.scene.add(this.installedApp);

    // 3. Moving Device Token (3D Metallic Key)
    this.tokenKey = this.createTokenKey(1.2);
    this.scene.add(this.tokenKey);

    // 4. Persistent Stored Token Key docked on front of the Datacentre!
    this.storedKey = this.createTokenKey(1.0);
    this.storedKey.position.set(POS.server.x + 12, 24, POS.server.z + 12);
    this.scene.add(this.storedKey);

    // 5. External Event Trigger Pulse (UFO -> App Server)
    this.triggerBolt = new THREE.Mesh(
      new THREE.SphereGeometry(2.0, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    this.triggerBolt.add(new THREE.PointLight(0x38bdf8, 4, 30));
    this.scene.add(this.triggerBolt);

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
    this.scene.add(this.pushOrb);

    // 7. 3D Token-Matching Zipper hovering above the Post Office
    this.initZipper();
  }

  initZipper() {
    this.zipperGroup = new THREE.Group();
    this.zipperGroup.position.set(POS.post.x, 38, POS.post.z);
    this.zipperTeeth = [];

    const toothGeo = new THREE.BoxGeometry(2.4, 0.75, 0.75);
    const count = 8;
    for (let i = 0; i < count; i++) {
      const y = (i - (count - 1) / 2) * 1.45;
      const matL = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.8, metalness: 0.85, roughness: 0.2 });
      const matR = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.8, metalness: 0.85, roughness: 0.2 });
      const left  = new THREE.Mesh(toothGeo, matL);
      const right = new THREE.Mesh(toothGeo, matR);
      left.position.set(-3.2, y, 0);
      right.position.set(3.2, y + 0.55, 0);
      this.zipperGroup.add(left, right);
      this.zipperTeeth.push({ left, right, matL, matR, y, idx: i / (count - 1) });
    }

    // Glowing zipper slider pull
    this.zipSlider = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 2.4, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x10b981, emissiveIntensity: 1.0, metalness: 0.7, roughness: 0.2 })
    );
    this.zipperGroup.add(this.zipSlider, new THREE.PointLight(0x34d399, 3, 28));
    this.zipperGroup.visible = false;
    this.scene.add(this.zipperGroup);
  }

  updateZipper(progress) {
    // progress 0..1 zips the left (server key) & right (registry key) teeth together!
    const count = this.zipperTeeth.length;
    const minY = this.zipperTeeth[0].y;
    const maxY = this.zipperTeeth[count - 1].y;
    const sliderY = minY + (maxY - minY) * progress;
    this.zipSlider.position.set(0, sliderY, 0);

    for (const pair of this.zipperTeeth) {
      const zipped = progress >= pair.idx;
      const openSpread = Math.max(0, (pair.idx - progress) * 4.5);
      const xOffset = zipped ? 0.85 : 1.1 + openSpread;
      pair.left.position.x = -xOffset;
      pair.right.position.x = xOffset;

      if (zipped) {
        pair.matL.color.setHex(0x34d399);
        pair.matL.emissive.setHex(0x059669);
        pair.matR.color.setHex(0x34d399);
        pair.matR.emissive.setHex(0x059669);
      } else {
        pair.matL.color.setHex(0xfbbf24);
        pair.matL.emissive.setHex(0xb45309);
        pair.matR.color.setHex(0x38bdf8);
        pair.matR.emissive.setHex(0x0284c7);
      }
    }
  }

  initDatacentreCluster(done) {
    // Collision-free Datacentre cluster: measure exact bounding boxes of all 8 GLBs,
    // then lay out back row, front row, top unit, plinth, and front-bezel LEDs with zero clipping.
    this.dcGroup = new THREE.Group();
    this.dcGroup.position.copy(POS.server);
    this.dcGroup.rotation.y = Math.PI * 0.25;
    this.scene.add(this.dcGroup);

    const floorY = 0.8;
    const RACK_H = 18;
    const specs = [
      { key: 'argos',   row: 'back',  path: 'models/dc/cabinet_argos.glb', targetH: RACK_H, uniformH: true },
      { key: 'main',    row: 'back',  path: 'models/data_center_rack.glb', targetH: RACK_H, uniformH: true },
      { key: 'net',     row: 'back',  path: 'models/dc/network_rack.glb',  targetH: RACK_H, uniformH: true },
      { key: 'rack1',   row: 'back',  path: 'models/dc/rack_1.glb',        targetH: RACK_H, uniformH: true },
      { key: 'rack2',   row: 'front', path: 'models/dc/rack_2.glb',        targetH: RACK_H, uniformH: true },
      { key: 'panel',   row: 'front', path: 'models/dc/control_panel.glb', targetH: 9,      uniformH: false },
      { key: 'console', row: 'front', path: 'models/dc/rack_console.glb',  targetH: RACK_H, uniformH: true },
      { key: 'topbox',  row: 'top',   path: 'models/dc/server_box.glb',    targetH: 6,      uniformH: false }
    ];

    const loaded = {};
    let remaining = specs.length;

    const finalizeLayout = () => {
      const gapX = 1.8;
      const gapZ = 2.6;

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

      // 2. Lay out FRONT row cleanly in front of back row's forward-most edge
      const frontKeys = ['rack2', 'panel', 'console'].filter((k) => loaded[k]);
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

      // 3. Stack TOP server box flush on top of the tallest center back-row rack
      if (loaded.topbox && backPlaced.length) {
        const anchor = backPlaced.find((b) => b.key === 'main') || backPlaced[Math.floor(backPlaced.length / 2)];
        loaded.topbox.wrap.position.set(anchor.x, floorY + anchor.size.y + 0.15, anchor.z);
        this.dcGroup.add(loaded.topbox.wrap);
      }

      // 4. Size the raised floor plinth to the exact combined footprint + clean margin
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
      const topExtra = loaded.topbox ? loaded.topbox.size.y : 0;
      this.tops.server = floorY + maxBackH + topExtra + 3;

      // Dock stored golden key cleanly outside the front-right edge (zero clipping)
      if (this.storedKey) {
        this.storedKey.position.set(POS.server.x + padW * 0.42, 22, POS.server.z + padD * 0.42);
      }
    };

    for (const s of specs) {
      this.loader.load(s.path, (gltf) => {
        const obj = gltf.scene;
        let box = new THREE.Box3().setFromObject(obj);
        const raw = box.getSize(new THREE.Vector3());
        const sy = s.targetH / (raw.y || 1);
        const maxFootprint = s.row === 'top' ? 10 : 11;
        const sxz = Math.min(sy, maxFootprint / Math.max(raw.x || 1, raw.z || 1));
        // Keep every server rack at the EXACT same roofline height (sy), capping X/Z footprint cleanly
        obj.scale.set(sxz, s.uniformH ? sy : sxz, sxz);

        box = new THREE.Box3().setFromObject(obj);
        const c = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Wrap so wrap origin sits at bottom-center (x=0, y=0, z=0)
        const wrap = new THREE.Group();
        obj.position.set(-c.x, -box.min.y, -c.z);
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

  loadModels() {
    const status = document.getElementById('load-status');
    let left = 13; // 8 datacentre units + phone + postbox + apple + google + ufo
    const done = () => { if (--left <= 0) status.style.display = 'none'; };

    // 1. Datacentre Cluster (front-left)
    this.initDatacentreCluster(done);

    // 2. Smartphone (front-right)
    this.loader.load('models/generic_smartphone_game-ready.glb', (gltf) => {
      const phone = gltf.scene;
      phone.rotation.y = -Math.PI * 0.25;
      this.tops.phone = this.ground(phone, 28, POS.phone);
      this.scene.add(phone);
      done();
    }, undefined, done);

    // 3. Edward VII Post Box — APNs/FCM (back-left)
    this.loader.load('models/postbox.glb', (gltf) => {
      const post = gltf.scene;
      post.rotation.y = Math.PI * 0.25;
      this.tops.post = this.ground(post, 32, POS.post);
      this.scene.add(post);
      done();
    }, undefined, done);

    // 4. App Store Shopping Bag with Apple flat on front (+Z) and Google flat on back (-Z)
    this.initAppStoreBag(done);

    // 5. UFO — External Event Trigger hovering above the App Server!
    this.loader.load('models/ufo.glb', (gltf) => {
      this.ufoGroup = new THREE.Group();
      const ufo = gltf.scene;
      this.centerAndScale(ufo, 28);
      this.ufoGroup.add(ufo);

      this.ufoBeamMat = new THREE.MeshBasicMaterial({
        color: 0x34d399, transparent: true, opacity: 0.08, side: THREE.DoubleSide
      });
      const beam = new THREE.Mesh(new THREE.ConeGeometry(12, 24, 32, 1, true), this.ufoBeamMat);
      beam.position.y = -13;
      this.ufoGroup.add(beam);

      this.ufoGroup.position.copy(POS.ufo);
      this.scene.add(this.ufoGroup);
      done();
    }, undefined, done);
  }

  initAppStoreBag(done) {
    // Sleek luxury retail shopping bag grounded at POS.store,
    // with Apple logo mounted flat on front (+Z) and Google logo mounted flat on back (-Z).
    this.storeGroup = new THREE.Group();
    this.storeGroup.position.set(POS.store.x, 0, POS.store.z);
    this.storeGroup.rotation.y = -Math.PI * 0.25;
    this.scene.add(this.storeGroup);

    const bagW = 19;
    const bagH = 22;
    const bagD = 9.5;

    const paperMat = new THREE.MeshStandardMaterial({
      color: 0xe6edf6, roughness: 0.52, metalness: 0.06
    });
    const creaseMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1, roughness: 0.65, metalness: 0.05
    });
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, roughness: 0.9, metalness: 0.0
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, roughness: 0.3, metalness: 0.8
    });
    const cordMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8, emissive: 0x0369a1, emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.25
    });

    // Main bag body (grounded: bottom at y = 0)
    const body = new THREE.Mesh(new THREE.BoxGeometry(bagW, bagH, bagD), paperMat);
    body.position.y = bagH / 2;
    this.storeGroup.add(body);

    // Subtle dark interior opening at top rim
    const cavity = new THREE.Mesh(new THREE.BoxGeometry(bagW - 1.2, 0.8, bagD - 1.2), innerMat);
    cavity.position.y = bagH - 0.3;
    this.storeGroup.add(cavity);

    // Folded side gusset vertical creases (left & right)
    const creaseGeo = new THREE.BoxGeometry(0.35, bagH - 1.2, 0.35);
    const leftCrease = new THREE.Mesh(creaseGeo, creaseMat);
    leftCrease.position.set(-bagW / 2 - 0.05, bagH / 2, 0);
    const rightCrease = new THREE.Mesh(creaseGeo, creaseMat);
    rightCrease.position.set(bagW / 2 + 0.05, bagH / 2, 0);
    this.storeGroup.add(leftCrease, rightCrease);

    // Top folded lip reinforcement strip
    const rim = new THREE.Mesh(new THREE.BoxGeometry(bagW + 0.25, 1.4, bagD + 0.25), creaseMat);
    rim.position.y = bagH - 0.7;
    this.storeGroup.add(rim);

    // Twin curved cord handles + metallic grommet eyelets (front +Z and back -Z)
    const handleSpan = 4.2;
    const eyeletGeo = new THREE.TorusGeometry(0.55, 0.16, 8, 20);
    for (const side of [1, -1]) {
      const z = side * (bagD / 2 + 0.08);
      for (const sx of [-1, 1]) {
        const eyelet = new THREE.Mesh(eyeletGeo, trimMat);
        eyelet.position.set(sx * handleSpan, bagH - 2.2, z);
        this.storeGroup.add(eyelet);
      }
      const handleCurve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(-handleSpan, bagH - 2.2, z),
        new THREE.Vector3(-handleSpan * 0.9, bagH + 7.2, z),
        new THREE.Vector3( handleSpan * 0.9, bagH + 7.2, z),
        new THREE.Vector3( handleSpan, bagH - 2.2, z)
      );
      const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 28, 0.38, 10, false), cordMat);
      this.storeGroup.add(handle);
    }

    this.tops.store = bagH + 9.5;

    // Helper: mount a logo GLB flat & flush onto the front (+1) or back (-1) face of the bag
    const mountLogoFlat = (path, sideSign, targetSize) => {
      this.loader.load(path, (gltf) => {
        const logo = gltf.scene;
        let box = new THREE.Box3().setFromObject(logo);
        const raw = box.getSize(new THREE.Vector3());
        const s = targetSize / Math.max(raw.x || 1, raw.y || 1);
        logo.scale.set(s, s, Math.min(s, 1.2 / (raw.z || 1))); // keep flat embossed relief

        box = new THREE.Box3().setFromObject(logo);
        const c = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const wrap = new THREE.Group();
        logo.position.set(-c.x, -c.y, -c.z);
        wrap.add(logo);
        if (sideSign < 0) wrap.rotation.y = Math.PI; // face cleanly outward on back side
        wrap.position.set(0, bagH * 0.48, sideSign * (bagD / 2 + size.z / 2 + 0.12));
        this.storeGroup.add(wrap);
        done();
      }, undefined, (err) => { console.warn('Store logo load failed:', path, err); done(); });
    };

    // Apple flat on front (+Z), Google flat on back (-Z)
    mountLogoFlat('models/apple_logo.glb',  1, 10.5);
    mountLogoFlat('models/google_logo.glb', -1, 10.5);
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

  /* ---------------- Polarity Mode Switch ---------------- */
  setMode(mode, resetT = true) {
    this.mode = mode;
    if (resetT) this.t = 0;

    const isPush = mode === 'push';
    const color = isPush ? 0x34d399 : 0xfbbf24;
    this.ringMat.color.setHex(color);
    this.beadMat.color.setHex(color);
    this.setupLines.forEach((l) => (l.visible = !isPush));
    this.pushLines.forEach((l) => (l.visible = isPush));

    document.getElementById('mode-setup').classList.toggle('active', !isPush);
    document.getElementById('mode-push').classList.toggle('active', isPush);
    document.getElementById('brand-dot').classList.toggle('push', isPush);
    document.getElementById('btn-play').classList.toggle('push', isPush);
    document.getElementById('scrub').classList.toggle('push', isPush);

    const banner = document.getElementById('polarity-banner');
    banner.classList.toggle('push', isPush);
    document.getElementById('pol-arrow').textContent = isPush ? '↻' : '↺';
    document.getElementById('pol-label').textContent = isPush ? 'PUSH DELIVERY' : 'INSTALL & SETUP';
    document.getElementById('pol-route').textContent = isPush
      ? 'UFO Event → Datacentre → Post Office → Phone'
      : 'Apple/Google → Phone → Post Office → Datacentre';
  }

  setAutoOrbit(on) {
    this.autoOrbit = on;
    document.getElementById('btn-orbit').classList.toggle('on', on);
  }

  setPlaying(auto) {
    this.playing = auto;
    // In Manual Scrub mode, mouse wheel / trackpad scroll scrubs the action cycle instead of zooming
    this.controls.enableZoom = auto;
    const btn = document.getElementById('btn-play');
    btn.textContent = auto ? '▶ Auto' : '🖱 Scroll';
    btn.classList.toggle('manual', !auto);
  }

  initUI() {
    document.getElementById('mode-setup').addEventListener('click', () => this.setMode('setup'));
    document.getElementById('mode-push').addEventListener('click', () => this.setMode('push'));
    document.getElementById('btn-flip').addEventListener('click', () => {
      this.setMode(this.mode === 'setup' ? 'push' : 'setup');
    });

    document.getElementById('scrub').addEventListener('input', (e) => {
      if (this.playing) this.setPlaying(false);
      this.t = parseInt(e.target.value, 10) / 1000;
    });
    document.getElementById('btn-play').addEventListener('click', () => {
      this.setPlaying(!this.playing);
    });
    document.getElementById('btn-orbit').addEventListener('click', () => this.setAutoOrbit(!this.autoOrbit));
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    });

    // Mouse wheel / trackpad scroll scrubs the action cycle when in Manual Scrub mode
    this.renderer.domElement.addEventListener('wheel', (e) => {
      if (this.playing) return;
      e.preventDefault();
      const delta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0006;
      this.t = ((this.t + delta) % 1 + 1) % 1;
    }, { passive: false });

    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); this.setPlaying(!this.playing); }
      else if (e.key === 'Tab') { e.preventDefault(); this.setMode(this.mode === 'setup' ? 'push' : 'setup'); }
      else if (e.key === '1') this.setMode('setup');
      else if (e.key === '2') this.setMode('push');
      else if (e.key === 'ArrowRight') { if (this.playing) this.setPlaying(false); this.t = (this.t + 0.04) % 1; }
      else if (e.key === 'ArrowLeft')  { if (this.playing) this.setPlaying(false); this.t = (this.t - 0.04 + 1) % 1; }
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
    this.zipperGroup.visible = false;

    // Bejeweled stays visibly installed on the phone once downloaded
    this.installedApp.visible = this.mode === 'push' || t >= 0.28;
    // Key stays persistently stored on the server once registered!
    this.storedKey.visible = this.mode === 'push' || t >= 0.90;

    // UFO tractor beam brightens when triggering an external event in Mode 2
    if (this.ufoBeamMat) {
      this.ufoBeamMat.opacity = (this.mode === 'push' && t < 0.22) ? 0.34 : 0.07;
    }

    let moverPos = null;
    let moverText = '';
    let moverCls = '';

    let showInstall = false;
    let showToken = false;
    let showSaved = false;
    let showPush = false;

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
    } else {
      // PUSH DELIVERY MODE:
      // 0.00–0.22: UFO External Event -> App Server
      // 0.22–0.44: App Server -> Post Office
      // 0.44–0.64: 3D Zipper Token Matching at Post Office!
      // 0.64–0.88: Post Office -> Phone
      // 0.88–1.00: Delivered banner on Phone
      if (t < 0.22) {
        const p = this.arcUfoToServer.getPoint(seg(t, 0, 0.22));
        this.triggerBolt.visible = true;
        this.triggerBolt.position.copy(p);
        moverPos = p;
        moverText = '⚡ External Event Trigger';
        moverCls = 'cyan';
      } else if (t < 0.44) {
        const p = this.arcServerToPost.getPoint(seg(t, 0.22, 0.44));
        this.pushOrb.visible = true;
        this.pushOrb.position.copy(p);
        moverPos = p;
        moverText = '✉ Payload + 🔑 Key → Post Office';
        moverCls = 'push';
      } else if (t < 0.64) {
        const zp = seg(t, 0.44, 0.62);
        this.zipperGroup.visible = true;
        this.updateZipper(zp);
        moverPos = new THREE.Vector3(POS.post.x, 45, POS.post.z);
        moverText = zp < 0.92 ? '🔑 Matching Token…' : '✓ Token Matched!';
        moverCls = zp < 0.92 ? '' : 'push';
      } else if (t < 0.88) {
        const p = this.arcPostToPhone.getPoint(seg(t, 0.64, 0.88));
        this.pushOrb.visible = true;
        this.pushOrb.position.copy(p);
        moverPos = p;
        moverText = '✉ Delivering Push → Phone';
        moverCls = 'push';
      } else {
        showPush = true;
      }
    }

    // Station labels
    this.place('pin-store',  new THREE.Vector3(POS.store.x,  this.tops.store, POS.store.z), true);
    this.place('pin-post',   new THREE.Vector3(POS.post.x,   this.tops.post + 2, POS.post.z), true);
    this.place('pin-phone',  new THREE.Vector3(POS.phone.x,  -1.5, POS.phone.z + 8), true);
    this.place('pin-server', new THREE.Vector3(POS.server.x, -1.5, POS.server.z + 8), true);
    this.place('pin-ufo',    new THREE.Vector3(POS.ufo.x,    POS.ufo.y + 10, POS.ufo.z), true);

    const phoneTop  = new THREE.Vector3(POS.phone.x,  this.tops.phone + 11, POS.phone.z);
    const serverTop = new THREE.Vector3(POS.server.x, this.tops.server + 4, POS.server.z);
    this.place('pin-install', phoneTop,  showInstall);
    this.place('pin-token',   phoneTop,  showToken);
    this.place('pin-saved',   serverTop, showSaved);
    this.place('pin-push',    phoneTop,  showPush);

    const mv = document.getElementById('pin-mover');
    mv.className = 'pin pin-mover' + (moverCls ? ' ' + moverCls : '');
    mv.textContent = moverText;
    this.place('pin-mover', moverPos ? moverPos.clone().add(new THREE.Vector3(0, 4.5, 0)) : null, !!moverPos);
  }

  place(id, worldPos, show) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!show || !worldPos) { el.style.display = 'none'; return; }
    const p = worldPos.clone().project(this.camera);
    if (p.z > 1 || p.z < -1) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    const w = el.offsetWidth || 120;
    const x = Math.max(w / 2 + 16, Math.min(innerWidth - w / 2 - 16, (p.x * 0.5 + 0.5) * innerWidth));
    const y = Math.max(76, Math.min(innerHeight - 134, (-p.y * 0.5 + 0.5) * innerHeight));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    if (this.playing) {
      this.t = (this.t + dt / MODE_SECONDS[this.mode]) % 1;
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

    // Keep zipper facing the camera smoothly
    if (this.zipperGroup && this.zipperGroup.visible) {
      this.zipperGroup.lookAt(this.camera.position.x, this.zipperGroup.position.y, this.camera.position.z);
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
