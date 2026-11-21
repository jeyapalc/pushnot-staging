import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

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
  store:  new THREE.Vector3( 0, 0, -R),
  phone:  new THREE.Vector3( D, 0,  D),
  server: new THREE.Vector3(-D, 0,  D),
  post:   new THREE.Vector3( 0, 0, -R),
  ufo:    new THREE.Vector3(-D, 50, D)
};

const MODE_SECONDS = { setup: 13, push: 11, world: 12, leo: 18 };
const MODE_STEPS = {
  setup: [0.06, 0.25, 0.34, 0.44, 0.56, 0.68, 0.84, 0.96],
  push:  [0.08, 0.24, 0.39, 0.56, 0.78, 0.95],
  world: [0.10, 0.30, 0.55, 0.80, 0.95],
  leo:   [0.05, 0.16, 0.28, 0.46, 0.54, 0.64, 0.78, 0.96]
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

    this.mode = 'setup'; // 'setup' | 'push' | 'world' | 'leo'
    this.currentOS = 'ios'; // 'ios' | 'android'
    this.prevNormalMode = 'setup';
    this.t = 0.0;
    this.targetT = 0.0;
    this.playing = true;
    this.autoOrbit = true;
    this.cinematicFollow = false;
    this.cineLookAt = new THREE.Vector3(0, 16, 0);
    this.cineCamPos = new THREE.Vector3(42, 58, 134);
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
    this.controls.minDistance = 15;
    this.controls.maxDistance = 450;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.addEventListener('start', () => {
      if (this.autoOrbit) this.setAutoOrbit(false);
      this.cinematicFollow = false;
      this.focusCamPos = null;
      this.focusTargetPos = null;
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

    // Arcs emerging cleanly between Apple and Google signs
    const pPhone  = POS.phone.clone().setY(15);
    const pPost   = POS.post.clone().setY(10.5); // centered right between Apple and Google signs
    const pServer = POS.server.clone().setY(15);

    this.arcStoreToPhone  = new THREE.QuadraticBezierCurve3(pPost,   new THREE.Vector3(D + 4, 18, -6), pPhone);
    this.arcPhoneToPost   = new THREE.QuadraticBezierCurve3(pPhone,  new THREE.Vector3(10, 19, -6),    pPost);
    this.arcPostToPhone   = new THREE.QuadraticBezierCurve3(pPost,   new THREE.Vector3(D + 4, 18, -6), pPhone);
    this.arcPhoneToServer = new THREE.QuadraticBezierCurve3(pPhone,  new THREE.Vector3(0, 14, R + 8),  pServer);
    this.arcServerToPost  = new THREE.QuadraticBezierCurve3(pServer, new THREE.Vector3(-D - 4, 18, -6), pPost);
    this.arcUfoToServer   = new THREE.LineCurve3(POS.ufo.clone().setY(44), POS.server.clone().setY(26));

    this.setupCurves = [this.arcStoreToPhone, this.arcPhoneToPost, this.arcPhoneToServer];
    this.pushCurves  = [this.arcUfoToServer,  this.arcServerToPost, this.arcPostToPhone];

    this.setupLines = [
      this.addArc(this.arcStoreToPhone,  0x38bdf8, 0.4,  this.normalGroup),
      this.addArc(this.arcPhoneToPost,   0xfbbf24, 0.38, this.normalGroup),
      this.addArc(this.arcPhoneToServer, 0xfbbf24, 0.4,  this.normalGroup)
    ];
    this.pushLines = [
      this.addArc(this.arcUfoToServer,  0x38bdf8, 0.4,  this.normalGroup),
      this.addArc(this.arcServerToPost, 0x34d399, 0.45, this.normalGroup),
      this.addArc(this.arcPostToPhone,  0x34d399, 0.45, this.normalGroup)
    ];

    // 4 Multi-Stream World Outbound Stimulus Lines from Planet Earth -> Datacentre -> Post Office -> Phone
    // (Bejeweled Notification, Facebook Message, Instagram Notification, X Message)
    this.initWorldStimStreams();

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

  /* ---- 3D App Brand Logo Tile (Facebook, Instagram, X, Uber, Amazon, Bejeweled) ---- */
  create3DBrandLogoOrb(brand, hexColor) {
    const cvs = document.createElement('canvas');
    cvs.width = 256; cvs.height = 256;
    const ctx = cvs.getContext('2d');

    if (brand === 'facebook') {
      ctx.fillStyle = '#1877f2';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 220px "Space Grotesk", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('f', 136, 232);
    } else if (brand === 'instagram') {
      const grad = ctx.createRadialGradient(75, 240, 15, 160, 80, 260);
      grad.addColorStop(0, '#fdf497');
      grad.addColorStop(0.45, '#fd5949');
      grad.addColorStop(0.65, '#d6249f');
      grad.addColorStop(1, '#285aeb');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      // Camera outline, lens circle, flash dot
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 16;
      ctx.strokeRect(46, 46, 164, 164);
      ctx.beginPath(); ctx.arc(128, 128, 42, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(178, 78, 11, 0, Math.PI * 2); ctx.fill();
    } else if (brand === 'x') {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, 236, 236);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 165px "Space Grotesk", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('𝕏', 128, 134);
    } else if (brand === 'uber') {
      ctx.fillStyle = '#05080f';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, 236, 236);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 84px "Space Grotesk", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Uber', 128, 130);
    } else if (brand === 'amazon') {
      ctx.fillStyle = '#131921';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#ff9900';
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, 236, 236);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 155px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('a', 128, 112);
      // Iconic orange Amazon smile arrow from a -> z
      ctx.strokeStyle = '#ff9900';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(62, 182);
      ctx.quadraticCurveTo(128, 222, 196, 178);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(176, 174);
      ctx.lineTo(198, 176);
      ctx.lineTo(190, 198);
      ctx.stroke();
    } else {
      // Bejeweled diamond badge
      const grad = ctx.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0, '#0ea5e9');
      grad.addColorStop(1, '#10b981');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#ffffff';
      ctx.font = '135px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💎', 128, 136);
    }

    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;

    const rimMat  = new THREE.MeshStandardMaterial({ color: hexColor, emissive: hexColor, emissiveIntensity: 0.55, metalness: 0.45, roughness: 0.25 });
    const faceMat = new THREE.MeshBasicMaterial({ map: tex });

    const orb = new THREE.Group();
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 4.6, 0.85),
      [rimMat, rimMat, rimMat, rimMat, faceMat, faceMat]
    );
    tile.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(tile.geometry),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
    ));
    orb.add(tile);
    return orb;
  }

  /* ---- 6 Animated World Outbound Stimulus Lines from Planet Earth -> Push Pipeline -> Phone ---- */
  initWorldStimStreams() {
    this.worldStimGroup = new THREE.Group();
    this.normalGroup.add(this.worldStimGroup);

    const specs = [
      { id: 'pin-stim-0', brand: 'bejeweled', color: 0x38bdf8, offset: 0.00,  spread: new THREE.Vector3(-8.0,  4.0, -6.0), mid1: new THREE.Vector3(-4.5,  3.0,  1.5), mid2: new THREE.Vector3( 0.0,  4.0, -3.5) },
      { id: 'pin-stim-1', brand: 'facebook',  color: 0x1877f2, offset: 0.166, spread: new THREE.Vector3( 8.0,  3.5, -5.0), mid1: new THREE.Vector3( 4.5,  2.0, -1.5), mid2: new THREE.Vector3( 0.0,  2.2,  3.5) },
      { id: 'pin-stim-2', brand: 'instagram', color: 0xec4899, offset: 0.333, spread: new THREE.Vector3(-7.0,  0.5,  7.0), mid1: new THREE.Vector3(-3.2,  0.0,  3.2), mid2: new THREE.Vector3( 0.0,  0.4, -2.2) },
      { id: 'pin-stim-3', brand: 'x',         color: 0xe2e8f0, offset: 0.500, spread: new THREE.Vector3( 7.0, -0.5,  7.0), mid1: new THREE.Vector3( 3.2, -1.2, -2.5), mid2: new THREE.Vector3( 0.0, -1.4,  2.5) },
      { id: 'pin-stim-4', brand: 'uber',      color: 0x34d399, offset: 0.666, spread: new THREE.Vector3(-6.0, -4.0, -4.5), mid1: new THREE.Vector3(-2.5, -2.8, -3.0), mid2: new THREE.Vector3( 0.0, -2.8, -1.5) },
      { id: 'pin-stim-5', brand: 'amazon',    color: 0xff9900, offset: 0.833, spread: new THREE.Vector3( 6.0, -4.5,  3.5), mid1: new THREE.Vector3( 2.5, -3.5,  2.8), mid2: new THREE.Vector3( 0.0, -4.0,  1.8) }
    ];

    this.worldStimStreams = specs.map((s) => {
      // Smooth continuous Catmull-Rom 3D path from Planet Earth -> Datacentre -> Apple/Google Skyscraper HQ -> Phone!
      const pEarth  = POS.ufo.clone().add(s.spread);
      const pEarth2 = POS.ufo.clone().setY(35).add(s.spread.clone().multiplyScalar(1.25));
      const pServer = POS.server.clone().setY(16).add(s.mid1);
      const pArc1   = new THREE.Vector3(-D - 4, 18, -6).add(s.mid1);
      const pPost   = POS.post.clone().setY(11).add(s.mid2);
      const pArc2   = new THREE.Vector3(D + 4, 18, -6).add(s.mid2);
      const pPhone  = POS.phone.clone().setY(15).add(s.mid2.clone().multiplyScalar(0.4));

      const curve = new THREE.CatmullRomCurve3([pEarth, pEarth2, pServer, pArc1, pPost, pArc2, pPhone]);
      const line = this.addArc(curve, s.color, 0.52, this.worldStimGroup);

      // 3D App Icon Tile travelling along the stream!
      const orb = this.create3DBrandLogoOrb(s.brand, s.color);
      this.worldStimGroup.add(orb);

      return { ...s, curve, line, orb, currentPos: pEarth.clone() };
    });
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

  /* ---- 3D Laser-Printing / Holographic Materialization Rig for Unique Key ---- */
  createKeyMaterializer() {
    const group = new THREE.Group();

    // Glowing cyan wireframe blueprint key shell (shows key geometry before solid metal prints)
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.75
    });
    const wireKey = new THREE.Group();
    const wBow = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.35, 10, 24), wireMat); wBow.position.x = -1.7;
    const wShaft = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.55, 0.4), wireMat);    wShaft.position.x = 0.8;
    const wT1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.9, 0.4), wireMat);       wT1.position.set(1.4, -0.65, 0);
    const wT2 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.2, 0.4), wireMat);       wT2.position.set(2.2, -0.8, 0);
    wireKey.add(wBow, wShaft, wT1, wT2);
    wireKey.scale.setScalar(1.28);
    group.add(wireKey);
    this.forgeWireKey = wireKey;
    this.forgeWireMat = wireMat;

    // Sweeping horizontal laser print ring + flat laser scan sheet
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 });
    const laserRing = new THREE.Mesh(new THREE.TorusGeometry(4.8, 0.16, 10, 48), ringMat);
    laserRing.rotation.x = Math.PI / 2;
    const laserDisc = new THREE.Mesh(
      new THREE.CircleGeometry(4.8, 36),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.24, side: THREE.DoubleSide })
    );
    laserRing.add(laserDisc);
    group.add(laserRing);
    this.forgeLaserRing = laserRing;

    // Vertical holographic printer containment beam
    const cylMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24, transparent: true, opacity: 0.14, side: THREE.DoubleSide
    });
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 8.5, 32, 1, true), cylMat);
    group.add(cyl);
    this.forgeCylMat = cylMat;

    // Swirling fabrication spark particles
    const pts = [];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const r = 2.0 + (i % 5) * 0.65;
      pts.push(Math.cos(a) * r, ((i % 9) - 4) * 0.85, Math.sin(a) * r);
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.forgeSparks = new THREE.Points(
      sparkGeo,
      new THREE.PointsMaterial({ color: 0xfef08a, size: 0.65, transparent: true, opacity: 0.95 })
    );
    group.add(this.forgeSparks);

    this.forgeLight = new THREE.PointLight(0x38bdf8, 5, 36);
    group.add(this.forgeLight);
    return group;
  }

  /* ---- 3D Diamond-Angled Monopoly "GO TO JAIL" Tile (Using original picture, facing LEFT, rotated 45° as a diamond!) ---- */
  createMonopolyRedirectSign(scale = 1) {
    const group = new THREE.Group();

    const W = 512;
    const H = 512;
    const cvs = document.createElement('canvas');
    cvs.width = W; cvs.height = H;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = '#f8f7f2';
    ctx.fillRect(0, 0, W, H);

    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;

    const img = new Image();
    img.onload = () => {
      // Crop just inside the outer black frame of the original photo and mirror horizontally so he faces LEFT!
      const sx = img.width * 0.085;
      const sy = img.height * 0.085;
      const sw = img.width * 0.83;
      const sh = img.height * 0.83;

      ctx.fillStyle = '#f8f7f2';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
      ctx.restore();

      // Re-stamp crisp un-mirrored "GO TO" and "JAIL" so the text isn't backwards when flipped!
      ctx.fillStyle = '#f8f7f2';
      ctx.save();
      ctx.translate(145, 130);
      ctx.rotate(-Math.PI / 4);
      ctx.fillRect(-115, -55, 230, 110);
      ctx.restore();
      ctx.save();
      ctx.translate(362, 355);
      ctx.rotate(-Math.PI / 4);
      ctx.fillRect(-105, -55, 210, 110);
      ctx.restore();

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 54px "Space Grotesk", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.save();
      ctx.translate(135, 125);
      ctx.rotate(-Math.PI * 0.25);
      ctx.fillText('GO TO', 0, 0);
      ctx.restore();

      ctx.save();
      ctx.translate(356, 352);
      ctx.rotate(-Math.PI * 0.25);
      ctx.fillText('JAIL', 0, 0);
      ctx.restore();

      // Crisp black border around the diamond tile
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 16;
      ctx.strokeRect(8, 8, W - 16, H - 16);

      tex.needsUpdate = true;
    };
    img.src = 'models/go_to_jail.jpg';

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, roughness: 0.3, metalness: 0.5
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 0.75, roughness: 0.25, metalness: 0.4
    });
    const faceMat = new THREE.MeshPhysicalMaterial({
      map: tex, roughness: 0.18, metalness: 0.08, clearcoat: 1.0, clearcoatRoughness: 0.1
    });

    // Diamond-angled container (`rotation.z = -Math.PI / 4`) so the square sits on a 45° diamond angle
    // AND the policeman inside is angled upright while pointing left!
    const diamond = new THREE.Group();
    diamond.rotation.z = -Math.PI / 4;

    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(13.2, 13.2, 1.3),
      [frameMat, frameMat, frameMat, frameMat, faceMat, faceMat]
    );
    const borderEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(13.6, 13.6, 1.45)),
      new THREE.LineBasicMaterial({ color: 0xfbbf24 })
    );
    const backingRim = new THREE.Mesh(
      new THREE.BoxGeometry(14.0, 14.0, 0.9),
      rimMat
    );
    this.jailBackingMat = rimMat;
    diamond.add(tile, borderEdges, backingRim);

    // Subtle red & blue police strobe lights positioned just behind the diamond tile!
    this.jailStrobeRed = new THREE.PointLight(0xff1e56, 3.5, 28);
    this.jailStrobeRed.position.set(-4.5, 2.5, -2.2);
    this.jailStrobeBlue = new THREE.PointLight(0x2563eb, 3.5, 28);
    this.jailStrobeBlue.position.set(4.5, -2.5, -2.2);

    const haloGeo = new THREE.PlaneGeometry(9.5, 9.5);
    this.jailHaloRedMat = new THREE.MeshBasicMaterial({
      color: 0xff1e56, transparent: true, opacity: 0.25, side: THREE.DoubleSide
    });
    this.jailHaloBlueMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6, transparent: true, opacity: 0.25, side: THREE.DoubleSide
    });
    const haloRed = new THREE.Mesh(haloGeo, this.jailHaloRedMat);
    haloRed.position.set(-3.2, 2.0, -1.0);
    haloRed.rotation.z = Math.PI / 4;
    const haloBlue = new THREE.Mesh(haloGeo, this.jailHaloBlueMat);
    haloBlue.position.set(3.2, -2.0, -1.0);
    haloBlue.rotation.z = Math.PI / 4;

    group.add(diamond, haloRed, haloBlue, this.jailStrobeRed, this.jailStrobeBlue);
    group.scale.setScalar(scale);
    return group;
  }

  /* ---- 3D Redirect Visual (Why App Maker cannot push directly to Phone -> Redirected to Post Office!) ---- */
  createDirectBlockVisual() {
    const group = new THREE.Group();

    // Red dashed direct line from Datacentre -> Phone (intercepted & redirected at midpoint)
    const pServer = POS.server.clone().setY(16);
    const pMid    = new THREE.Vector3(0, 17, POS.phone.z);
    const pPhone  = POS.phone.clone().setY(16);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(
      new THREE.LineCurve3(pServer, pPhone).getPoints(40)
    );
    const lineMat = new THREE.LineDashedMaterial({
      color: 0xff1e56, dashSize: 2.0, gapSize: 1.4, transparent: true, opacity: 0.85
    });
    const redLine = new THREE.Line(lineGeo, lineMat);
    redLine.computeLineDistances();
    group.add(redLine);

    // 3D Monopoly "GO TO JAIL" Officer pointing LEFT at the midpoint between Datacentre & Phone
    this.firewallBarrier = this.createMonopolyRedirectSign(1.0);
    this.firewallBarrier.position.copy(pMid);
    group.add(this.firewallBarrier);

    group.visible = false;
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

    // 3. Moving Device Token (3D Metallic Key) + Materialization / 3D Laser-Printing Rig
    this.tokenKey = this.createTokenKey(1.2);
    this.normalGroup.add(this.tokenKey);

    // 3b. Holographic 3D Key Materialization / Printing Rig above Post Office
    this.keyForge = this.createKeyMaterializer();
    this.keyForge.position.set(POS.post.x, 28, POS.post.z);
    this.keyForge.visible = false;
    this.normalGroup.add(this.keyForge);

    // 3c. OS Firewall Barrier blocking direct App Maker <-> Phone push connections
    this.directBlockGroup = this.createDirectBlockVisual();
    this.normalGroup.add(this.directBlockGroup);

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

    // 6. Push Notification Payload: Sleek 3D Glass Payload Card + Docked Token Key (Zero Noise / No Clutter)
    this.pushOrb = this.createPushNotificationPayload();
    this.normalGroup.add(this.pushOrb);

    // 7. 3D Neural Brain popping up above the Apple & Google Skyscraper HQ for routing lookup
    this.initBrain();

    // 8. 3D Phone App State Emoji Badge (😴 App Sleeping / 😃 App Awake!) hovering above the Phone
    this.phoneEmojiBadge = this.createPhoneEmojiBadge();
    this.phoneEmojiBadge.visible = false;
    this.normalGroup.add(this.phoneEmojiBadge);
  }

  /* ---- Mobile Operating System Switcher (Interactive iOS vs Android Toggle) ---- */
  setOS(os) {
    if (this.currentOS === os) return;
    this.currentOS = os;

    // Update 2D top buttons
    const btnIos = document.getElementById('btn-os-ios');
    const btnAndroid = document.getElementById('btn-os-android');
    if (btnIos) btnIos.classList.toggle('active', os === 'ios');
    if (btnAndroid) btnAndroid.classList.toggle('active', os === 'android');

    // Update floating 3D phone badge
    const badge = document.getElementById('phone-os-badge');
    const floatPill = document.getElementById('pin-phone-os');
    if (badge) badge.textContent = os === 'ios' ? ' iOS' : '🤖 Android';
    if (floatPill) {
      floatPill.classList.toggle('android', os === 'android');
    }

    // Update Station labels
    const pinPhone = document.getElementById('pin-phone');
    if (pinPhone) pinPhone.textContent = os === 'ios' ? 'IPHONE (iOS)' : 'ANDROID PHONE';

    const pinPost = document.getElementById('pin-post');
    if (pinPost) pinPost.textContent = os === 'ios' ? 'APPLE APNs (iTUNES / APP STORE)' : 'GOOGLE FCM (GOOGLE PLAY STORE)';

    // Update Apple & Google logo prominence on the San Francisco headquarters
    this.updateLogoHighlight();

    // Redraw phone screen and push payload
    this.updatePhoneScreenCanvas(this.lastPhoneScreenState || 'awake', this.lastPhoneNotifProgress || 0);
    this.updatePayloadCanvas();
  }

  toggleOS() {
    this.setOS(this.currentOS === 'ios' ? 'android' : 'ios');
  }

  updateLogoHighlight() {
    if (!this.appleLogoMesh || !this.googleLogoMesh) return;
    // Make Google and Apple logos exactly the same scale and balanced prominence
    this.appleLogoMesh.scale.setScalar(1.0);
    this.googleLogoMesh.scale.setScalar(1.0);
  }

  /* ---- Dynamic Phone Screen Canvas (Interactive iOS vs Android + Bejeweled Blitz) ---- */
  updatePhoneScreenCanvas(state = 'awake', notifProgress = 0) {
    this.lastPhoneScreenState = state;
    this.lastPhoneNotifProgress = notifProgress;
    if (!this.phoneCvs) return;
    const ctx = this.phoneCvs.getContext('2d');
    const w = 512, h = 1024;
    ctx.clearRect(0, 0, w, h);

    const isIos = this.currentOS === 'ios';

    if (isIos) {
      // ---- iOS RENDERING ----
      // 1. Wallpaper: Rich deep midnight indigo with pastel radial blooms
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#090d1e');
      bg.addColorStop(0.5, '#1e1b4b');
      bg.addColorStop(1, '#0f172a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Subtle iOS orb blooms
      const g1 = ctx.createRadialGradient(160, 280, 10, 160, 280, 240);
      g1.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
      g1.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      const g2 = ctx.createRadialGradient(360, 680, 10, 360, 680, 260);
      g2.addColorStop(0, 'rgba(168, 85, 247, 0.32)');
      g2.addColorStop(1, 'rgba(168, 85, 247, 0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      // 2. iOS Top Bar & Dynamic Island
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px -apple-system, sans-serif';
      ctx.fillText('9:41', 54, 74);

      // Dynamic Island pill
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(196, 42, 120, 36, 18);
      ctx.fill();
      // Selfie lens dot
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(292, 60, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(292, 60, 3, 0, Math.PI * 2);
      ctx.fill();

      // Battery & Signal icons
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('5G', 386, 72);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(424, 54, 46, 22);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(427, 57, 40, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(470, 60, 3, 10);

      if (state === 'sleeping') {
        // iOS Lock Screen Sleeping State
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = '300 96px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('9:41', w / 2, 290);
        ctx.font = '500 24px -apple-system, sans-serif';
        ctx.fillText('Saturday, November 21', w / 2, 335);

        // Sleep pill
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(w / 2 - 175, 520, 350, 68, 34);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 22px -apple-system, sans-serif';
        ctx.fillText('😴 App Sleeping · APNs Idle', w / 2, 562);
        ctx.textAlign = 'left';
      } else {
        // iOS Home Screen / Active State with Bejeweled App
        const drawSquircleIcon = (x, y, iconEmoji, title) => {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.beginPath();
          ctx.roundRect(x, y, 76, 76, 20);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.stroke();
          ctx.font = '38px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(iconEmoji, x + 38, y + 52);
          ctx.font = '500 15px -apple-system, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(title, x + 38, y + 98);
        };

        // Bejeweled blitz highlighted app icon
        const bjX = 86, bjY = 220;
        const bGrad = ctx.createLinearGradient(bjX, bjY, bjX + 88, bjY + 88);
        bGrad.addColorStop(0, '#8b5cf6');
        bGrad.addColorStop(1, '#ec4899');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.roundRect(bjX, bjY, 88, 88, 22);
        ctx.fill();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.font = '48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💎', bjX + 44, bjY + 62);
        ctx.font = 'bold 16px -apple-system, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Bejeweled', bjX + 44, bjY + 114);

        // Other utility icons
        drawSquircleIcon(212, 226, '💬', 'Messages');
        drawSquircleIcon(338, 226, '📷', 'Camera');
        drawSquircleIcon(86, 376, '🎵', 'Music');
        drawSquircleIcon(212, 376, '🗺️', 'Maps');
        drawSquircleIcon(338, 376, '⚙️', 'Settings');

        // iOS Frosted Glass Dock at bottom
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.beginPath();
        ctx.roundRect(46, 880, 420, 96, 32);
        ctx.fill();
        drawSquircleIcon(82, 890, '📞', '');
        drawSquircleIcon(176, 890, '🧭', '');
        drawSquircleIcon(268, 890, '✉️', '');
        drawSquircleIcon(360, 890, '', '');

        // If push notification is triggered / arrived:
        if (notifProgress > 0) {
          const bannerY = 110 + (1 - Math.pow(1 - notifProgress, 3)) * 20;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
          ctx.beginPath();
          ctx.roundRect(32, bannerY, 448, 126, 24);
          ctx.fill();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.textAlign = 'left';
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 17px -apple-system, sans-serif';
          ctx.fillText('💎 BEJEWELED BLITZ · now', 56, bannerY + 36);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px -apple-system, sans-serif';
          ctx.fillText('Energy Refilled! Play Now 💎', 56, bannerY + 68);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '16px -apple-system, sans-serif';
          ctx.fillText('Your lives are full. Tap to beat high scores!', 56, bannerY + 98);
        }
        ctx.textAlign = 'left';
      }
    } else {
      // ---- ANDROID RENDERING ----
      // 1. Wallpaper: Android 14 Material You teal/mint organic aesthetic
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#041716');
      bg.addColorStop(0.5, '#0b2926');
      bg.addColorStop(1, '#061a18');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Material You fluid curved shapes
      ctx.fillStyle = 'rgba(52, 211, 153, 0.18)';
      ctx.beginPath();
      ctx.ellipse(380, 260, 240, 180, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.beginPath();
      ctx.ellipse(140, 720, 220, 200, -Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();

      // 2. Android Status Bar with Center Punch-hole Camera
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px Roboto, sans-serif';
      ctx.fillText('09:41', 54, 72);

      // Center punch-hole camera
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(256, 60, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0d2825';
      ctx.beginPath();
      ctx.arc(256, 60, 5, 0, Math.PI * 2);
      ctx.fill();

      // Signal & battery
      ctx.font = 'bold 20px monospace';
      ctx.fillText('5G 📶 100%', 356, 70);

      if (state === 'sleeping') {
        // Android AOD Sleeping State
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#10b981';
        ctx.font = '300 110px Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('09', w / 2, 260);
        ctx.fillText('41', w / 2, 380);

        ctx.fillStyle = '#6ee7b7';
        ctx.font = '500 24px Roboto, sans-serif';
        ctx.fillText('Sat, Nov 21 · 21°C', w / 2, 450);

        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(w / 2 - 165, 560, 330, 56);

        ctx.fillStyle = '#a7f3d0';
        ctx.font = 'bold 20px Roboto, sans-serif';
        ctx.fillText('💤 Android Doze · FCM Socket', w / 2, 596);
        ctx.textAlign = 'left';
      } else {
        // Android Material You Home Screen with Bejeweled Blitz
        const drawCircleIcon = (x, y, iconEmoji, title) => {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.beginPath();
          ctx.arc(x + 40, y + 40, 40, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.font = '38px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(iconEmoji, x + 40, y + 53);
          ctx.font = '500 15px Roboto, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(title, x + 40, y + 98);
        };

        // Bejeweled circular adaptive icon
        const bjX = 86, bjY = 220;
        const bGrad = ctx.createLinearGradient(bjX, bjY, bjX + 84, bjY + 84);
        bGrad.addColorStop(0, '#059669');
        bGrad.addColorStop(1, '#0284c7');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(bjX + 44, bjY + 44, 44, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.font = '48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💎', bjX + 44, bjY + 60);
        ctx.font = 'bold 16px Roboto, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Bejeweled', bjX + 44, bjY + 114);

        // Other icons
        drawCircleIcon(212, 226, '🤖', 'Chrome');
        drawCircleIcon(338, 226, '📷', 'Photos');
        drawCircleIcon(86, 376, '▶️', 'YouTube');
        drawCircleIcon(212, 376, '🗺️', 'Maps');
        drawCircleIcon(338, 376, '⚙️', 'Settings');

        // Android Search Bar pill at bottom
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.beginPath();
        ctx.roundRect(46, 890, 420, 68, 34);
        ctx.fill();
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('G', 76, 934);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '18px Roboto, sans-serif';
        ctx.fillText('Search apps & web…', 116, 933);

        // If push notification is triggered / arrived:
        if (notifProgress > 0) {
          const bannerY = 110 + (1 - Math.pow(1 - notifProgress, 3)) * 20;
          ctx.fillStyle = '#0f2924';
          ctx.beginPath();
          ctx.roundRect(32, bannerY, 448, 126, 24);
          ctx.fill();
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.textAlign = 'left';
          ctx.fillStyle = '#34d399';
          ctx.font = 'bold 17px Roboto, sans-serif';
          ctx.fillText('💎 Bejeweled Blitz · Firebase FCM', 56, bannerY + 36);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px Roboto, sans-serif';
          ctx.fillText('Daily Energy Restored! 💎', 56, bannerY + 68);

          ctx.fillStyle = '#6ee7b7';
          ctx.font = '16px Roboto, sans-serif';
          ctx.fillText('Spin the Wheel & claim 5,000 Free Coins!', 56, bannerY + 98);
        }
        ctx.textAlign = 'left';
      }
    }

    if (this.phoneTex) this.phoneTex.needsUpdate = true;
  }

  /* ---- Interactive Camera Snap & Shallow Depth of Field Focus on Node Click ---- */
  snapFocusToNode(key) {
    let target = null;
    let dist = 42;
    let lift = 14;

    if (key === 'phone') {
      target = POS.phone.clone().setY(16);
      dist = 78;
    } else if (key === 'server') {
      target = POS.server.clone().setY(16);
      dist = 82;
    } else if (key === 'post' || key === 'store') {
      target = POS.post.clone().setY(22);
      dist = 94;
    } else if (key === 'world' || key === 'ufo') {
      target = POS.ufo.clone().setY(22);
      dist = 74;
    } else if (key === 'bandit') {
      target = this.leoPos.bandit.clone().setY(14);
      dist = 82; // Comfortable framing, not zoomed into face!
    } else if (key === 'swat') {
      target = this.leoPos.swat.clone().setY(14);
      dist = 82; // Clear view of Ranger Green RCMP officer & patches!
    } else if (key === 'osint') {
      target = this.leoPos.osint.clone().setY(22);
      dist = 56;
    } else if (key === 'facebook') {
      target = this.leoPos.bot.clone().setY(16);
      dist = 78;
    }

    if (!target) return;

    this.focusedNode = key;
    this.autoOrbit = false;
    const btnOrbit = document.getElementById('btn-orbit');
    if (btnOrbit) btnOrbit.classList.remove('on');

    this.focusTargetPos = target.clone();

    // Snap strictly to the OUTSIDE of the orbit ring, facing IN LATERALLY at eye level (no bird's eye view!)
    const radial = new THREE.Vector3(target.x, 0, target.z);
    if (radial.lengthSq() < 1) radial.set(0, 0, 1);
    radial.normalize();

    this.focusCamPos = target.clone().addScaledVector(radial, dist);
    this.focusCamPos.y = target.y + 1.5; // Lateral eye-level!

    // Shallow depth-of-field focal spotlight
    if (!this.focusSpot) {
      this.focusSpot = new THREE.SpotLight(0xffffff, 4.5, 95, Math.PI / 4, 0.4, 1.2);
      this.scene.add(this.focusSpot);
      this.scene.add(this.focusSpot.target);
    }
    this.focusSpot.visible = true;
    this.focusSpot.target.position.copy(target);
    this.focusSpot.position.copy(target).add(new THREE.Vector3(0, 32, 18));
  }

  resetFocus() {
    this.focusedNode = null;
    this.focusTargetPos = null;
    this.focusCamPos = null;
    if (this.focusSpot) this.focusSpot.visible = false;
  }

  /* ---- 3D Phone App State Emoji Badge (😴 App Sleeping vs. 😃 App Awake!) ---- */
  createPhoneEmojiBadge() {
    this.emojiCvs = document.createElement('canvas');
    this.emojiCvs.width = 320;
    this.emojiCvs.height = 128;
    this.emojiCtx = this.emojiCvs.getContext('2d');
    this.emojiTex = new THREE.CanvasTexture(this.emojiCvs);
    this.emojiTex.colorSpace = THREE.SRGBColorSpace;
    this.currentEmojiState = '';

    const mat = new THREE.SpriteMaterial({ map: this.emojiTex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(13.5, 5.4, 1);
    return sprite;
  }

  setPhoneEmojiState(state) {
    if (!this.phoneEmojiBadge) return;
    if (!state) {
      this.phoneEmojiBadge.visible = false;
      return;
    }
    this.phoneEmojiBadge.visible = true;
    this.phoneEmojiBadge.position.set(POS.phone.x, this.tops.phone + 17.5, POS.phone.z);
    if (this.currentEmojiState === state) return;
    this.currentEmojiState = state;

    const ctx = this.emojiCtx;
    ctx.clearRect(0, 0, 320, 128);

    const isAwake = state === 'awake';
    const borderCol = isAwake ? '#34d399' : '#94a3b8';
    const bgCol = isAwake ? 'rgba(6, 28, 22, 0.92)' : 'rgba(15, 23, 42, 0.92)';

    // Rounded pill card
    ctx.fillStyle = bgCol;
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(8, 14, 304, 100, 50);
    ctx.fill();
    ctx.stroke();

    // Emoji + state label
    ctx.font = '54px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(isAwake ? '😃' : '😴', 28, 66);

    ctx.fillStyle = isAwake ? '#6ee7b7' : '#cbd5e1';
    ctx.font = 'bold 28px "Space Grotesk", sans-serif';
    ctx.fillText(isAwake ? 'App Awake!' : 'App Sleeping', 102, 54);

    ctx.fillStyle = isAwake ? '#34d399' : '#38bdf8';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillText(isAwake ? '🔔 PUSH WOKE APP' : '💤 ZzZ · CLOSED', 104, 86);

    this.emojiTex.needsUpdate = true;
  }

  /* ---- Sleek Glassmorphic 3D Push Notification Payload Card with Docked Token Key (Zero Noise / No Clutter) ---- */
  createPushNotificationPayload() {
    const group = new THREE.Group();

    // 1. Sleek glassmorphic payload card (translucent dark chassis with glowing emerald border)
    const cardW = 6.4, cardH = 3.4, cardD = 0.38;
    const cardGeo = new THREE.BoxGeometry(cardW, cardH, cardD);
    const cardMat = new THREE.MeshPhysicalMaterial({
      color: 0x090d16,
      metalness: 0.85,
      roughness: 0.18,
      transparent: true,
      opacity: 0.92,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05
    });
    const card = new THREE.Mesh(cardGeo, cardMat);
    card.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(cardGeo),
      new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.9 })
    ));
    group.add(card);

    // 2. High-res dynamic canvas texture on front face of the payload
    this.payloadCvs = document.createElement('canvas');
    this.payloadCvs.width = 512;
    this.payloadCvs.height = 256;
    this.payloadTex = new THREE.CanvasTexture(this.payloadCvs);
    this.payloadTex.colorSpace = THREE.SRGBColorSpace;
    this.updatePayloadCanvas();

    const faceGeo = new THREE.PlaneGeometry(cardW * 0.96, cardH * 0.94);
    const faceMat = new THREE.MeshBasicMaterial({
      map: this.payloadTex,
      transparent: true,
      side: THREE.DoubleSide
    });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.z = cardD / 2 + 0.03;
    const faceBack = face.clone();
    faceBack.position.z = -(cardD / 2 + 0.03);
    faceBack.rotation.y = Math.PI;
    group.add(face, faceBack);

    // 3. Single sleek Golden Device Token Key docked cleanly into the payload card
    this.pushOrbKey = this.createTokenKey(0.72);
    this.pushOrbKey.position.set(-cardW * 0.44, 0, 0);
    this.pushOrbKey.rotation.z = Math.PI * 0.5;
    group.add(this.pushOrbKey);

    group.add(new THREE.PointLight(0x34d399, 3.0, 28));
    return group;
  }

  updatePayloadCanvas() {
    if (!this.payloadCvs) return;
    const ctx = this.payloadCvs.getContext('2d');
    ctx.clearRect(0, 0, 512, 256);

    const isIos = this.currentOS === 'ios';

    // Background gradient with emerald glow
    const bg = ctx.createLinearGradient(0, 0, 512, 256);
    bg.addColorStop(0, '#061715');
    bg.addColorStop(1, '#0c221d');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 240, 18);
    ctx.fill();

    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Top banner
    ctx.fillStyle = isIos ? '#38bdf8' : '#34d399';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(isIos ? ' APNs PUSH PAYLOAD' : '🤖 FCM PUSH PAYLOAD', 28, 44);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('🔑 TOKEN: #7A9F-2B4C', 28, 82);

    // Separator rule
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(28, 98); ctx.lineTo(484, 98);
    ctx.stroke();

    // Message content
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('💎 Bejeweled Blitz', 28, 140);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px sans-serif';
    ctx.fillText('"Energy Refilled! Play now 💎"', 28, 178);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('ROUTE: App Server ➔ Apple/Google ➔ Phone', 28, 222);

    if (this.payloadTex) this.payloadTex.needsUpdate = true;
  }

  initBrain() {
    // Load the real Brain Point Cloud GLB above the Apple & Google Skyscraper HQ during Ledger matching
    this.brainGroup = new THREE.Group();
    this.brainGroup.position.set(POS.post.x, 46, POS.post.z);
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
      this.brainMesh = brain;
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
    // Clean, single animated 3D Server Tower (`models/data_center_rack.glb`) with live blinking blade LEDs
    // and an animated vertical data-scan pulse bar (replaces the old 8-rack cluster!)
    this.dcGroup = new THREE.Group();
    this.dcGroup.position.copy(POS.server);
    this.dcGroup.rotation.y = Math.PI * 0.25;
    this.normalGroup.add(this.dcGroup);

    const floorY = 0.8;
    const TOWER_H = 26;

    this.loader.load('models/data_center_rack.glb', (gltf) => {
      const rawScene = gltf.scene;

      const buildSingleTower = () => {
        const towerGroup = new THREE.Group();
        const obj = rawScene.clone(true);
        // Rotate server model by -90 deg so front glass door (with handle & blade bays) faces +Z (towards viewer/orbit)!
        obj.rotation.y = -Math.PI * 0.5;
        obj.updateMatrixWorld(true);

        let box = new THREE.Box3().setFromObject(obj);
        const raw = box.getSize(new THREE.Vector3());
        const s = TOWER_H / (raw.y || 1);
        obj.scale.setScalar(s);

        obj.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(obj);
        const c = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        obj.position.set(-c.x, floorY - box.min.y, -c.z);
        this.harmonizeAsset(obj, { minRough: 0.24, maxRough: 0.52, maxMetal: 0.78, envIntensity: 1.15 });
        towerGroup.add(obj);

        // Sleek server plinth with glowing cyan trim ring
        const padW = Math.max(size.x, size.z) + 4.2;
        const pad = new THREE.Mesh(
          new THREE.BoxGeometry(padW, floorY, padW),
          new THREE.MeshStandardMaterial({ color: 0x0b1220, metalness: 0.75, roughness: 0.25 })
        );
        pad.position.set(0, floorY / 2, 0);
        pad.add(new THREE.LineSegments(
          new THREE.EdgesGeometry(pad.geometry),
          new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 })
        ));
        towerGroup.add(pad);

        // Animated vertical laser-telemetry scan bar gliding strictly across the front glass door
        const frontFaceZ = size.z / 2 + 0.18;
        const scanBar = new THREE.Mesh(
          new THREE.BoxGeometry(size.x * 0.68, 0.28, 0.12),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.88 })
        );
        scanBar.position.set(0, floorY + size.y * 0.5, frontFaceZ);
        towerGroup.add(scanBar);

        // Clean activity LEDs strictly on the front door bezel frame (zero side wall spill!)
        const leds = [];
        const ledGeo = new THREE.BoxGeometry(0.32, 0.22, 0.12);
        const palette = [0x38bdf8, 0x34d399, 0x38bdf8, 0x34d399, 0xfbbf24];
        const ledX = size.x * 0.26;
        for (let row = 0; row < 10; row++) {
          const hex = palette[row % palette.length];
          const mat = new THREE.MeshBasicMaterial({ color: hex });
          const led = new THREE.Mesh(ledGeo, mat);
          led.position.set(
            ledX,
            floorY + 2.0 + row * ((size.y - 4.0) / 9),
            frontFaceZ
          );
          towerGroup.add(led);
          leds.push({
            mesh: led,
            mat,
            speed: 5 + ((row * 3) % 8),
            phase: row * 1.1
          });
        }

        towerGroup.userData = { size, padW, frontFaceZ, scanBar, leds };
        return towerGroup;
      };

      const mainTower = buildSingleTower();
      this.dcGroup.add(mainTower);
      this.dcLeds = mainTower.userData.leds;
      this.dcScanBar = mainTower.userData.scanBar;
      this.dcTowerHeight = mainTower.userData.size.y;

      this.dcLight = new THREE.PointLight(0x38bdf8, 3.2, 48);
      this.dcLight.position.set(0, 18, mainTower.userData.frontFaceZ + 8);
      this.dcGroup.add(this.dcLight);

      this.tops.server = floorY + mainTower.userData.size.y + 3;

      if (this.storedKey) {
        const offset = mainTower.userData.padW * 0.55;
        this.storedKey.position.set(POS.server.x + offset, 20, POS.server.z + offset);
      }

      // Build the single animated Server Tower on the Law Enforcement side (`APP SERVERS`) as well!
      if (this.leoGroup && this.leoPos) {
        if (this.leoDcMirror) this.leoGroup.remove(this.leoDcMirror);
        this.leoDcMirror = buildSingleTower();
        this.leoDcMirror.position.set(this.leoPos.bot.x, 0, this.leoPos.bot.z - 5);
        this.leoDcMirror.scale.setScalar(0.88);
        this.leoDcLeds = this.leoDcMirror.userData.leds;
        this.leoDcScanBar = this.leoDcMirror.userData.scanBar;
        this.leoGroup.add(this.leoDcMirror);
      }

      done();
    }, undefined, (err) => {
      console.warn('Single server tower load failed:', err);
      done();
    });
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
    // High-res fictional 3D Canadian Provincial Photo ID Card (BC Driver's Licence)
    const cvs = document.createElement('canvas');
    cvs.width = 512; cvs.height = 320;
    const ctx = cvs.getContext('2d');

    // Card base gradient
    const bg = ctx.createLinearGradient(0, 0, 512, 320);
    bg.addColorStop(0, '#e0f2fe');
    bg.addColorStop(1, '#bae6fd');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 320);

    // Top header band (Canadian BC Driver's Licence)
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(0, 0, 512, 58);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(0, 54, 512, 6);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 19px monospace';
    ctx.fillText('BRITISH COLUMBIA · CANADA  DRIVER\'S LICENCE', 16, 36);

    // Portrait frame + stylized silhouette avatar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(22, 78, 128, 158);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.arc(86, 130, 28, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(86, 224, 48, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#0284c7'; ctx.lineWidth = 3;
    ctx.strokeRect(22, 78, 128, 158);

    // Fictional Canadian subscriber fields
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 23px sans-serif';
    ctx.fillText('DOE, JOHN A.', 170, 106);
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 14.5px monospace';
    ctx.fillText('DL:  BC-8492-104', 170, 138);
    ctx.fillText('DOB: 1991-04-12', 170, 164);
    ctx.fillText('TEL: +1 (604) 555-0194', 170, 190);
    ctx.fillText('742 ROBSON ST, VANCOUVER BC', 170, 216);
    ctx.fillText('IP:  24.84.100.42 (TELUS CA)', 170, 242);

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

  /* ---- Authentic RCMP ERT Tactical Uniform Patches (Solid Ranger Green & Subdued Insignia) ---- */
  createPoliceChestPatchTexture() {
    const cvs = document.createElement('canvas');
    cvs.width = 1024;
    cvs.height = 320;
    const ctx = cvs.getContext('2d');

    // Solid Ranger Green background (#48563f) matching Canadian RCMP ERT uniform
    ctx.fillStyle = '#48563f';
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    // Dark tactical embroidered outer border
    ctx.strokeStyle = '#1b2318';
    ctx.lineWidth = 18;
    ctx.strokeRect(9, 9, cvs.width - 18, cvs.height - 18);

    // Subtle inner stitched thread border
    ctx.setLineDash([16, 12]);
    ctx.strokeStyle = '#2d3726';
    ctx.lineWidth = 5;
    ctx.strokeRect(28, 28, cvs.width - 56, cvs.height - 56);
    ctx.setLineDash([]);

    // Bold solid black block "POLICE" in all caps
    ctx.fillStyle = '#0a0a0a';
    ctx.font = '900 180px "Impact", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('POLICE', cvs.width / 2, cvs.height / 2 + 4);

    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  createRcmpBackPatchTexture() {
    const cvs = document.createElement('canvas');
    cvs.width = 1024;
    cvs.height = 480;
    const ctx = cvs.getContext('2d');

    // Solid Ranger Green background (#48563f)
    ctx.fillStyle = '#48563f';
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    // Dark tactical embroidered outer border
    ctx.strokeStyle = '#1b2318';
    ctx.lineWidth = 22;
    ctx.strokeRect(11, 11, cvs.width - 22, cvs.height - 22);

    // Inner stitching
    ctx.setLineDash([18, 12]);
    ctx.strokeStyle = '#2d3726';
    ctx.lineWidth = 6;
    ctx.strokeRect(32, 32, cvs.width - 64, cvs.height - 64);
    ctx.setLineDash([]);

    // Prominent bold solid black "RCMP" on back panel
    ctx.fillStyle = '#0a0a0a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 190px "Impact", "Arial Black", sans-serif';
    ctx.fillText('RCMP', cvs.width / 2, 156);

    // Bold solid black "POLICE" on back panel
    ctx.font = '900 136px "Impact", "Arial Black", sans-serif';
    ctx.fillText('POLICE', cvs.width / 2, 336);

    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  createRcmpSubduedShoulderFlashTexture() {
    const cvs = document.createElement('canvas');
    cvs.width = 768;
    cvs.height = 960;
    const ctx = cvs.getContext('2d');

    // Shield path (Canadian police shoulder flash shape)
    function drawShieldPath(pad = 0) {
      ctx.beginPath();
      const w = cvs.width - pad * 2;
      const h = cvs.height - pad * 2;
      const x0 = pad;
      const y0 = pad;
      const r = 48;
      ctx.moveTo(x0 + r, y0);
      ctx.lineTo(x0 + w - r, y0);
      ctx.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
      ctx.lineTo(x0 + w, y0 + h * 0.62);
      ctx.bezierCurveTo(x0 + w, y0 + h * 0.86, x0 + w * 0.65, y0 + h * 0.96, x0 + w * 0.5, y0 + h);
      ctx.bezierCurveTo(x0 + w * 0.35, y0 + h * 0.96, x0, y0 + h * 0.86, x0, y0 + h * 0.62);
      ctx.lineTo(x0, y0 + r);
      ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
      ctx.closePath();
    }

    // Solid Ranger Green base fill
    drawShieldPath(8);
    ctx.fillStyle = '#48563f';
    ctx.fill();

    // Dark embroidered outer border
    ctx.strokeStyle = '#1b2318';
    ctx.lineWidth = 26;
    ctx.stroke();

    // Inner stitching
    drawShieldPath(36);
    ctx.setLineDash([16, 12]);
    ctx.strokeStyle = '#2d3726';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.setLineDash([]);

    // Arched banner at top: "ROYAL CANADIAN MOUNTED POLICE"
    ctx.fillStyle = '#111710';
    ctx.font = '900 48px "Impact", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ROYAL CANADIAN', 384, 108);
    ctx.font = '900 44px "Impact", "Arial Black", sans-serif';
    ctx.fillText('MOUNTED POLICE', 384, 164);

    // Subdued Crown at top center of crest
    ctx.beginPath();
    ctx.arc(384, 276, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(320, 296, 128, 16);
    ctx.fillRect(336, 264, 96, 28);

    // Circular garter ring
    ctx.beginPath();
    ctx.arc(384, 470, 124, 0, Math.PI * 2);
    ctx.lineWidth = 24;
    ctx.strokeStyle = '#111710';
    ctx.stroke();

    // Subdued Bison / Buffalo head silhouette in center
    ctx.beginPath();
    ctx.arc(384, 444, 56, 0, Math.PI * 2);
    ctx.arc(384, 496, 36, 0, Math.PI * 2);
    ctx.fill();
    // Horns
    ctx.beginPath();
    ctx.arc(324, 412, 24, 0, Math.PI * 1.5);
    ctx.arc(444, 412, 24, Math.PI * 1.5, Math.PI * 3);
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#111710';
    ctx.stroke();

    // Scroll at bottom: "MAINTIENS LE DROIT"
    ctx.fillStyle = '#111710';
    ctx.font = '900 36px "Impact", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MAINTIENS LE DROIT', 384, 670);

    // Subdued tactical unit badge: "RCMP · ERT"
    ctx.font = '900 64px "Impact", "Arial Black", sans-serif';
    ctx.fillText('RCMP · ERT', 384, 776);

    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /* ---- 3D RCMP OSINT Laptop (`personal_computer.glb`) with Live Kali Linux Recon Terminal Animation! ---- */
  makeRcmpLaptopScreenTexture() {
    const cvs = document.createElement('canvas');
    cvs.width = 1024;
    cvs.height = 1024;
    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;

    this.rcmpCvs = cvs;
    this.rcmpScreenTex = tex;

    const bannerImg = new Image();
    const crestImg  = new Image();
    this.rcmpBannerImg = bannerImg;
    this.rcmpCrestImg = crestImg;

    let loaded = 0;
    const onImg = () => {
      loaded++;
      this.updateRcmpLaptopScreen(0.35);
    };
    bannerImg.onload = onImg;
    crestImg.onload  = onImg;
    bannerImg.src = 'models/leo/rcmp_banner_white.png?v=33';
    crestImg.src  = 'models/leo/rcmp_crest_white.png?v=33';

    this.updateRcmpLaptopScreen(0);
    return tex;
  }

  updateRcmpLaptopScreen(t) {
    if (!this.rcmpCvs) return;
    const ctx = this.rcmpCvs.getContext('2d');
    ctx.save();
    // Correct mapping for monitor screen UVs (upright Y, normal left-to-right X)
    ctx.translate(0, 1024);
    ctx.scale(1, -1);

    // Deep tactical RCMP navy screen background
    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, '#040914');
    grad.addColorStop(0.5, '#071124');
    grad.addColorStop(1, '#030712');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    // Top RCMP Scarlet & Gold header bar
    ctx.fillStyle = '#be123c'; ctx.fillRect(0, 0, 1024, 24);
    ctx.fillStyle = '#fbbf24'; ctx.fillRect(0, 24, 1024, 8);

    // Outer screen frame
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 36, 1000, 976);

    // Official RCMP Crest + Bilingual Wordmark Banner at top of laptop screen
    if (this.rcmpBannerImg && this.rcmpBannerImg.complete && this.rcmpBannerImg.naturalWidth > 0) {
      ctx.drawImage(this.rcmpBannerImg, 44, 48, 936, 170);
    }
    if (this.rcmpCrestImg && this.rcmpCrestImg.complete && this.rcmpCrestImg.naturalWidth > 0) {
      // Subtle glowing gold shield halo behind the RCMP Crest
      const halo = ctx.createRadialGradient(180, 390, 20, 180, 390, 150);
      halo.addColorStop(0, 'rgba(251, 191, 36, 0.28)');
      halo.addColorStop(1, 'rgba(251, 191, 36, 0.0)');
      ctx.fillStyle = halo;
      ctx.fillRect(40, 230, 280, 320);
      ctx.drawImage(this.rcmpCrestImg, 65, 235, 230, 290);
    }

    // Terminal container (Kali Linux OSINT Recon Workflow)
    ctx.fillStyle = '#081426';
    ctx.fillRect(320, 236, 660, 310);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(320, 236, 660, 310);

    // Terminal header bar
    ctx.fillStyle = '#0e2646';
    ctx.fillRect(320, 236, 660, 42);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillText('⚡ KALI LINUX · RCMP CYBER OSINT RECON', 338, 265);

    // Live reconnaissance progression based on timeline `t`:
    // Beat 1 (t: 0.20 - 0.32): Google Search & Sherlock reconnaissance on the ProtonMail address
    // Beat 2 (t: 0.32 - 0.44): Sherlock connects Meta, Instagram, X profiles & detects 3 Push Tokens
    // Beat 3 (t: 0.44 - 0.60): Police serve emergency data demands (s. 487.014) to demand the 3 Push Tokens!
    const p1 = clamp01(seg(t, 0.20, 0.32));
    const p2 = clamp01(seg(t, 0.32, 0.44));
    const p3 = clamp01(seg(t, 0.44, 0.60));

    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('root@rcmp-cyber:~# sherlock badguy@proton.me', 338, 316);

    const scanStr = '🔍 Google Search: "badguy@proton.me" across platforms…';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px "JetBrains Mono", monospace';
    ctx.fillText(scanStr.slice(0, Math.floor(scanStr.length * Math.min(1, p1 * 1.4 + 0.1))), 338, 354);

    if (p1 >= 0.7) {
      ctx.fillStyle = '#34d399';
      ctx.fillText('[✓] 3 Connected Social Accounts Found via Proton ID', 338, 392);
    }
    if (p2 > 0) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('► PUSH TOKENS DETECTED: Meta (APNs) · IG (FCM) · X (APNs)', 338, 432);
    }
    if (p3 > 0) {
      ctx.fillStyle = '#fda4af';
      ctx.font = 'bold 20px "JetBrains Mono", monospace';
      ctx.fillText('⚖ EMERGENCY DEMAND (s. 487.014): Preserving 3 Push Tokens!', 338, 474);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('➔ Production Orders Dispatched to Apple & Google', 338, 510);
    }

    // 4 Live Platform Cards below the terminal showing the 3 Keys and the Legal Demand
    const cards = [
      {
        x: 42, y: 566, w: 450, h: 180,
        title: 'f  FACEBOOK (META)', user: 'fb.com/badguy.yvr',
        token: '🔑 TOKEN: #META-9182',
        active: p2 > 0.15, color: '#3b82f6'
      },
      {
        x: 530, y: 566, w: 450, h: 180,
        title: '📸 INSTAGRAM (META)', user: '@badguy_604',
        token: '🔑 TOKEN: #INSTA-4401',
        active: p2 > 0.45, color: '#ec4899'
      },
      {
        x: 42, y: 770, w: 450, h: 180,
        title: '𝕏  X (TWITTER)', user: '@badguy_van',
        token: '🔑 TOKEN: #XTWT-8832',
        active: p2 > 0.75, color: '#38bdf8'
      },
      {
        x: 530, y: 770, w: 450, h: 180,
        title: '⚖ EXIGENT PRODUCTION', user: '3 PUSH TOKENS MATCHED',
        token: p3 > 0.4 ? '✓ 3 SUBSCRIBER IDENTITIES UNMASKED' : 'Awaiting Apple/Google Decryption…',
        active: p3 > 0.15, color: '#10b981'
      }
    ];

    for (const c of cards) {
      ctx.fillStyle = c.active ? '#0a1d35' : '#050c18';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = c.active ? c.color : '#334155';
      ctx.fillRect(c.x, c.y, c.w, 12);
      ctx.strokeStyle = c.active ? c.color : '#1e293b';
      ctx.lineWidth = c.active ? 3 : 1;
      ctx.strokeRect(c.x, c.y, c.w, c.h);

      ctx.fillStyle = c.active ? '#ffffff' : '#64748b';
      ctx.font = 'bold 26px "JetBrains Mono", monospace';
      ctx.fillText(c.title, c.x + 20, c.y + 60);

      ctx.fillStyle = c.active ? '#bae6fd' : '#475569';
      ctx.font = 'bold 22px "JetBrains Mono", monospace';
      ctx.fillText(c.user, c.x + 20, c.y + 104);

      ctx.fillStyle = c.active ? '#fbbf24' : '#475569';
      ctx.font = 'bold 20px "JetBrains Mono", monospace';
      ctx.fillText(c.token, c.x + 20, c.y + 148);
    }

    ctx.restore();
    if (this.rcmpScreenTex) this.rcmpScreenTex.needsUpdate = true;
  }

  createRcmpOsintLaptop(done) {
    const group = new THREE.Group();
    const screenTex = this.makeRcmpLaptopScreenTexture();

    this.loader.load('models/leo/personal_computer.glb?v=33', (gltf) => {
      const laptop = gltf.scene;
      this.harmonizeAsset(laptop, { minRough: 0.24, maxRough: 0.58, maxMetal: 0.65, envIntensity: 0.95, liftDark: true });

      // Replace the laptop's internal screen mesh (`Cube_Screen_0` / material `Screen`) with our RCMP Logo & SpiderFoot display
      const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
      laptop.traverse((ch) => {
        if (ch.isMesh && (ch.name.includes('Screen') || ch.material?.name === 'Screen')) {
          ch.material = screenMat;
        }
      });

      // Center and scale the laptop so it sits cleanly on the elevated disc above the Police officer's head
      this.centerAndScale(laptop, 25);
      // Align bottom of laptop with the elevated platform disc (y = -10.8) and angle the screen toward the front-right camera
      const box = new THREE.Box3().setFromObject(laptop);
      laptop.position.y -= (box.min.y + 10.6);
      laptop.rotation.y = Math.PI * 0.22;

      group.add(laptop, new THREE.PointLight(0x38bdf8, 3.2, 42));
      if (done) done();
    }, undefined, () => { if (done) done(); });

    return group;
  }

  /* ---- 3D Hacker Laptop Screen: ProtonMail Encrypted Threat Email ---- */
  createHackerEmailScreenTexture() {
    const cvs = document.createElement('canvas');
    cvs.width = 1024;
    cvs.height = 1024;
    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI; // Invert because model UVs are upside-down

    this.hackerScreenCvs = cvs;
    this.hackerScreenTex = tex;
    this.updateHackerEmailScreen(1.0);
    return tex;
  }

  updateHackerEmailScreen(progress = 1.0) {
    if (!this.hackerScreenCvs) return;
    const ctx = this.hackerScreenCvs.getContext('2d');
    const W = 1024, H = 1024;

    // Dark sleek cyberpunk desktop background
    ctx.fillStyle = '#080711';
    ctx.fillRect(0, 0, W, H);

    // ProtonMail window centered on screen
    const pad = 40;
    const winW = W - pad * 2;
    const winH = H - pad * 2;
    const winX = pad;
    const winY = pad;

    // Window shadow / outer glow
    ctx.fillStyle = 'rgba(109, 74, 255, 0.25)';
    ctx.fillRect(winX - 6, winY - 6, winW + 12, winH + 12);

    // Window background
    ctx.fillStyle = '#121024';
    ctx.fillRect(winX, winY, winW, winH);

    // Window border
    ctx.strokeStyle = '#6d4aff';
    ctx.lineWidth = 4;
    ctx.strokeRect(winX, winY, winW, winH);

    // Proton Purple Header Bar
    const grad = ctx.createLinearGradient(winX, winY, winX + winW, winY);
    grad.addColorStop(0, '#6d4aff');
    grad.addColorStop(0.7, '#4c1d95');
    grad.addColorStop(1, '#2e1065');
    ctx.fillStyle = grad;
    ctx.fillRect(winX, winY, winW, 80);

    // Window Control Dots (macOS/Linux style)
    const dots = ['#ef4444', '#f59e0b', '#10b981'];
    dots.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(winX + 45 + i * 36, winY + 40, 12, 0, Math.PI * 2);
      ctx.fill();
    });

    // Proton Mail Header Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 38px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🇨🇭 Proton Mail · Encrypted Threat Composer', winX + 175, winY + 42);

    // Helper for progressive text typing
    const clip = (str, startP, endP) => {
      const p = clamp01((progress - startP) / (endP - startP));
      return str.slice(0, Math.ceil(str.length * p));
    };

    // Metadata field rows (TO, FROM, SUBJECT)
    const drawField = (y, label, val, color) => {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 32px "JetBrains Mono", monospace';
      ctx.fillText(label, winX + 36, winY + y);

      ctx.fillStyle = color;
      ctx.font = '900 36px "JetBrains Mono", monospace';
      ctx.fillText(val, winX + 220, winY + y);

      // Separator line
      ctx.strokeStyle = 'rgba(109, 74, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(winX + 30, winY + y + 26);
      ctx.lineTo(winX + winW - 30, winY + y + 26);
      ctx.stroke();
    };

    drawField(150, 'TO:',      clip('911@POJ.CA', 0.0, 0.25),        '#38bdf8');
    drawField(230, 'FROM:',    clip('BADGUY@PROTON.ME', 0.20, 0.50),  '#c4b5fd');
    drawField(310, 'SUBJECT:', clip('RISE UP! THREAT NOTICE', 0.45, 0.70), '#fb7185');

    // Message Body Area
    const bodyY = 380;
    const bodyH = winH - bodyY - 110;
    ctx.fillStyle = '#0a0915';
    ctx.fillRect(winX + 30, winY + bodyY, winW - 60, bodyH);
    ctx.strokeStyle = 'rgba(109, 74, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(winX + 30, winY + bodyY, winW - 60, bodyH);

    // Body content lines
    if (progress >= 0.55) {
      const bodyAlpha = clamp01((progress - 0.55) / 0.35);
      ctx.save();
      ctx.globalAlpha = bodyAlpha;

      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 30px "JetBrains Mono", monospace';
      ctx.fillText('> TARGET: CANADIAN POLICE HEADQUARTERS', winX + 60, winY + bodyY + 65);

      ctx.fillStyle = '#ef4444';
      ctx.font = '900 34px "JetBrains Mono", monospace';
      ctx.fillText('⚠ THREAT: IMMINENT ATTACK SCHEDULED', winX + 60, winY + bodyY + 125);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 26px "JetBrains Mono", monospace';
      ctx.fillText('ENCRYPTION: 4096-bit RSA · ZERO-ACCESS PGP', winX + 60, winY + bodyY + 185);
      ctx.fillText('ORIGIN: SWISS RELAY · IP ANONYMIZED', winX + 60, winY + bodyY + 230);

      // Skull & warning badge
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 54px monospace';
      ctx.fillText('☠ 💣 ⚠', winX + 60, winY + bodyY + 310);

      ctx.restore();
    }

    // Status bar at bottom
    const statusY = winY + winH - 75;
    ctx.fillStyle = '#161426';
    ctx.fillRect(winX + 30, statusY, winW - 60, 55);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.strokeRect(winX + 30, statusY, winW - 60, 55);

    ctx.fillStyle = '#22c55e';
    ctx.font = '900 28px "JetBrains Mono", monospace';
    ctx.fillText('✔ STATUS: DISPATCHED [SWISS ZERO-ACCESS]', winX + 60, statusY + 36);

    // Send button icon
    ctx.fillStyle = '#6d4aff';
    ctx.fillRect(winX + winW - 200, statusY + 8, 150, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SENT ✉', winX + winW - 125, statusY + 34);

    this.hackerScreenTex.needsUpdate = true;
  }

  animateWickSparks(nowMs) {
    if (!this.wickSparks) return;
    const t = nowMs * 0.004;
    for (const s of this.wickSparks) {
      const u = (t * s.speed + s.phase) % 1.0;
      const dist = u * 2.2;
      s.mesh.position.set(
        s.dir.x * dist,
        s.dir.y * dist - u * u * 0.65,
        s.dir.z * dist
      );
      s.mesh.scale.setScalar(1.15 * (1.0 - u * 0.75));
      s.mesh.rotation.x += 0.2;
      s.mesh.rotation.y += 0.25;
    }
    if (this.wickEmberHalo) {
      this.wickEmberHalo.scale.setScalar(0.85 + Math.sin(nowMs * 0.035) * 0.35);
    }
    if (this.wickLight) {
      this.wickLight.intensity = 4.0 + Math.sin(nowMs * 0.045) * 1.8;
    }
  }

  initLeoStage() {
    // Underside Law Enforcement Reverse-Trace Stage (swings upright when worldPivot flips 180°!)
    const L = {
      bandit:      new THREE.Vector3( D, 0,  D), // front-right: Suspect (badguy@proton.me)
      swat:        new THREE.Vector3(-D, 0,  D), // front-left:  Canadian Police / RCMP / VPD
      osint:       new THREE.Vector3(-D, 48, D), // upper plane directly above Police head: 3D RCMP OSINT Laptop!
      proton:      new THREE.Vector3(-D, 0, -D), // back-left:   Proton Switzerland (wind-animated flag!)
      ag:          new THREE.Vector3( D, 0, -D), // back-right:  Apple & Google Skyscraper HQ
      bot:         new THREE.Vector3( 0, 0,  4)  // center:      Single Animated App Server Tower + Facebook
    };
    this.leoPos = L;
    this.leoTops = { bandit: 26, swat: 26, osint: 62, bot: 26, proton: 26, ag: 26 };

    // 1. Elevated Holographic OSINT Plane directly above Canadian Police's head
    this.osintPlaneGroup = new THREE.Group();
    this.osintPlaneGroup.position.copy(L.osint);
    const planeDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(16, 16, 0.35, 48),
      new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.14 })
    );
    planeDisc.position.y = -11;
    const planeRing = new THREE.Mesh(
      new THREE.TorusGeometry(16.2, 0.22, 12, 64),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 })
    );
    planeRing.rotation.x = Math.PI / 2;
    planeRing.position.y = -11;
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(11.0, 0.12, 10, 48),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.45 })
    );
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = -10.8;
    this.osintPlaneGroup.add(planeDisc, planeRing, innerRing);
    this.leoGroup.add(this.osintPlaneGroup);

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

    // Apple & Google Subscriber Vault (cloned Skyscraper HQ mounts here once logos finish loading,
    // topped with a glowing 3D Subscriber ID Card stack!)
    this.leoAgGroup = new THREE.Group();
    this.leoAgGroup.position.set(L.ag.x, 0, L.ag.z);
    this.leoGroup.add(this.leoAgGroup);

    // Floating 3D Photo ID + 3D Credit Card hovering above the Apple & Google Skyscraper HQ
    this.leoIdStack = this.createSubscriberCardPair(1.1);
    this.leoIdStack.position.set(0, 46, 0);
    this.leoAgGroup.add(this.leoIdStack);
    this.leoTops.ag = 52;

    // LEO investigative arcs (Police queries Proton -> OSINT investigation -> Meta/X Push Tokens -> Apple/Google HQ)
    const pSwat        = L.swat.clone().setY(22);
    const pOsint       = L.osint.clone().setY(44);
    const pProton      = L.proton.clone().setY(14);
    const pBot         = L.bot.clone().setY(16);
    const pAg          = L.ag.clone().setY(15);

    this.arcLeoProton      = new THREE.QuadraticBezierCurve3(pSwat,        new THREE.Vector3(-R - 8, 26, 0), pProton);
    this.arcLeoOsint       = new THREE.LineCurve3(pSwat, pOsint);
    this.arcLeoOsintToMeta = new THREE.QuadraticBezierCurve3(pOsint,       new THREE.Vector3(-16, 42, 18),   pBot);
    this.arcLeoTokens      = new THREE.QuadraticBezierCurve3(pBot,         new THREE.Vector3(-16, 28, 20),   pSwat);
    this.arcLeoToAg        = new THREE.QuadraticBezierCurve3(pSwat,        new THREE.Vector3(0, 34, 0),      pAg);
    this.arcLeoFromAg      = new THREE.QuadraticBezierCurve3(pAg,          new THREE.Vector3(0, 26, 12),     pSwat);

    this.leoLines = [
      this.addArc(this.arcLeoProton,      0xf43f5e, 0.45, this.leoGroup),
      this.addArc(this.arcLeoOsint,       0xfbbf24, 0.55, this.leoGroup),
      this.addArc(this.arcLeoOsintToMeta, 0xfbbf24, 0.45, this.leoGroup),
      this.addArc(this.arcLeoTokens,      0xfbbf24, 0.45, this.leoGroup),
      this.addArc(this.arcLeoToAg,        0x38bdf8, 0.45, this.leoGroup),
      this.addArc(this.arcLeoFromAg,      0x34d399, 0.5,  this.leoGroup)
    ];

    // LEO moving packets (demand/query/token/ID)
    this.leoPacketMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xbe123c, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.25 });
    this.leoPacket = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.8, 0.8), this.leoPacketMat);
    this.leoPacketLight = new THREE.PointLight(0xf43f5e, 3.5, 30);
    this.leoPacket.add(this.leoPacketLight);
    this.leoPacket.visible = false;
    this.leoGroup.add(this.leoPacket);

    this.leoKey = this.createTokenKey(1.3);
    this.leoKey.visible = false;
    this.leoGroup.add(this.leoKey);

    this.leoBomb = null;

    // 3D Photo ID + 3D Credit Card that fly from Apple/Google -> Police in final beat!
    this.leoDeliveredCards = this.createSubscriberCardPair(1.25);
    this.leoDeliveredCards.visible = false;
    this.leoGroup.add(this.leoDeliveredCards);

    this.leoGroup.visible = false;
  }

  loadModels() {
    const status = document.getElementById('load-status');
    let left = 9; // single server tower + phone + skyscraper + apple + google + earth + bandit + swat + facebook + rcmp laptop
    const done = () => { if (--left <= 0) status.style.display = 'none'; };

    // 1. Datacentre Cluster (front-left)
    this.initDatacentreCluster(done);

    // 2. Interactive Smartphone (front-right) with dynamic iOS / Android screen
    this.phoneCvs = document.createElement('canvas');
    this.phoneCvs.width = 512;
    this.phoneCvs.height = 1024;
    this.phoneTex = new THREE.CanvasTexture(this.phoneCvs);
    this.phoneTex.colorSpace = THREE.SRGBColorSpace;
    this.updatePhoneScreenCanvas('awake', 0);

    this.loader.load('models/generic_smartphone_game-ready.glb', (gltf) => {
      const phone = gltf.scene;
      phone.rotation.y = -Math.PI * 0.25;
      this.phoneMesh = phone;
      phone.userData.stationKey = 'phone';

      phone.traverse((child) => {
        if (child.isMesh) {
          child.userData.stationKey = 'phone';
          const mName = child.material ? (child.material.name || '') : '';
          if (mName === 'Screen' || child.name.toLowerCase().includes('screen')) {
            this.phoneScreenMesh = child;
            // Normalize UV coordinates so 0..1 fills the screen edge to edge
            const uvAttr = child.geometry.attributes.uv;
            if (uvAttr) {
              const minU = 0.5649, maxU = 0.8515, minV = 0.1344, maxV = 0.8602;
              for (let i = 0; i < uvAttr.count; i++) {
                const u = (uvAttr.getX(i) - minU) / (maxU - minU);
                const v = (uvAttr.getY(i) - minV) / (maxV - minV);
                uvAttr.setXY(i, u, v);
              }
              uvAttr.needsUpdate = true;
            }
            child.material = new THREE.MeshBasicMaterial({
              map: this.phoneTex,
              toneMapped: false
            });
          }
        }
      });

      this.harmonizeAsset(phone, { minRough: 0.22, maxRough: 0.55, maxMetal: 0.72, envIntensity: 0.95 });
      this.tops.phone = this.ground(phone, 28, POS.phone);
      this.normalGroup.add(phone);
      done();
    }, undefined, done);

    // 3. San Francisco Skyscraper HQ topped with 3D Apple & Google Icons (Unified App Store + APNs/FCM Hub)
    this.initAppleGoogleSkyscraper(done);

    // 4. Planet Earth — Global World Stimulus Source hovering above the Datacentre (no tractor beam cone!)
    this.loader.load('models/earth.glb?v=15', (gltf) => {
      this.ufoGroup = new THREE.Group();
      this.ufoGroup.userData.stationKey = 'world';
      const earth = gltf.scene;
      earth.userData.stationKey = 'world';
      this.harmonizeAsset(earth, { minRough: 0.34, maxRough: 0.72, maxMetal: 0.25, envIntensity: 0.9, liftDark: false });
      this.centerAndScale(earth, 26);
      this.ufoGroup.add(earth);

      this.ufoGroup.position.copy(POS.ufo);
      this.normalGroup.add(this.ufoGroup);
      done();
    }, undefined, done);

    // 5. Law Enforcement Models (mounted on underside leoGroup)
    this.loader.load('models/leo/hack.glb?v=8', (gltf) => {
      const hacker = gltf.scene;
      hacker.rotation.y = -Math.PI * 0.35;
      hacker.userData.stationKey = 'bandit';
      this.harmonizeAsset(hacker, { minRough: 0.36, maxRough: 0.68, maxMetal: 0.35, envIntensity: 0.85, liftDark: false });

      // Live ProtonMail Threat Email mapped directly onto Hacker's Laptop Screen!
      const screenTex = this.createHackerEmailScreenTexture();
      const screenMat = new THREE.MeshBasicMaterial({
        map: screenTex,
        side: THREE.DoubleSide
      });

      hacker.traverse(c => {
        if (!c.isMesh) return;
        c.userData.stationKey = 'bandit';
        const mName = c.material ? (c.material.name || '') : '';
        if (mName.includes('blinn4') || c.name.includes('blinn4')) {
          c.material = screenMat;
          this.hackerScreenMesh = c;
        }
      });

      // Cool purple/blue screen glow illuminating the hacker's face and hands
      const screenGlow = new THREE.PointLight(0x8b5cf6, 2.5, 20);
      screenGlow.position.set(0, 16, 4);
      hacker.add(screenGlow);

      this.leoTops.bandit = this.ground(hacker, 28, this.leoPos.bandit);
      this.leoGroup.add(hacker);
      done();
    }, undefined, done);

    this.loader.load('models/leo/swat.glb', (gltf) => {
      const m = gltf.scene;
      m.rotation.y = Math.PI * 0.35;
      m.userData.stationKey = 'swat';

      m.traverse(c => {
        if (!c.isMesh) return;
        c.userData.stationKey = 'swat';

        const matName = c.material ? (c.material.name || '') : '';
        const normMap = c.material?.normalMap || null;

        if (matName.includes('rifle')) {
          // Tactical matte black carbine / rifle
          c.material = new THREE.MeshStandardMaterial({
            color: 0x141414,
            metalness: 0.65,
            roughness: 0.35,
            normalMap: normMap
          });
        } else if (matName.includes('Surface5SG')) {
          // Tactical assault boots - solid matte black
          c.material = new THREE.MeshStandardMaterial({
            color: 0x121212,
            metalness: 0.2,
            roughness: 0.8,
            normalMap: normMap
          });
        } else if (matName.includes('Surface8SG')) {
          // Goggles lens - dark smoke polarized glass
          c.material = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            metalness: 0.9,
            roughness: 0.08
          });
        } else if (matName.includes('Surface6SG') || matName.includes('Surface14SG')) {
          // Comms headset & radio mic wire - solid matte black
          c.material = new THREE.MeshStandardMaterial({
            color: 0x181818,
            metalness: 0.3,
            roughness: 0.7
          });
        } else {
          // Solid Canadian RCMP ERT Ranger Green uniform, plate carrier vest, helmet, pouches, and BDU
          c.material = new THREE.MeshStandardMaterial({
            color: 0x48563f, // Solid authentic Ranger Green (#48563f)
            metalness: 0.12,
            roughness: 0.68,
            normalMap: normMap
          });
        }
      });

      // Front chest POLICE patch (Velcro plate on tactical vest)
      const chestTex = this.createPoliceChestPatchTexture();
      const chestMat = new THREE.MeshStandardMaterial({
        map: chestTex,
        roughness: 0.75,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -8,
        polygonOffsetUnits: -8,
        side: THREE.DoubleSide
      });
      const chestPatch = new THREE.Mesh(new THREE.PlaneGeometry(16.5, 5.8), chestMat);
      chestPatch.position.set(0.0, 142.5, 21.0);
      chestPatch.rotation.x = -0.14;
      m.add(chestPatch);

      // Back RCMP POLICE panel on upper back plate
      const backTex = this.createRcmpBackPatchTexture();
      const backMat = new THREE.MeshStandardMaterial({
        map: backTex,
        roughness: 0.75,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -8,
        polygonOffsetUnits: -8,
        side: THREE.DoubleSide
      });
      const backPatch = new THREE.Mesh(new THREE.PlaneGeometry(21.0, 9.5), backMat);
      backPatch.position.set(0.0, 150.0, -18.0);
      backPatch.rotation.set(0.12, Math.PI, 0);
      m.add(backPatch);

      // Subdued RCMP shoulder flashes on sleeves
      const shoulderTex = this.createRcmpSubduedShoulderFlashTexture();
      const shoulderMat = new THREE.MeshStandardMaterial({
        map: shoulderTex,
        roughness: 0.75,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -8,
        polygonOffsetUnits: -8,
        side: THREE.DoubleSide
      });
      const leftFlash = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 9.0), shoulderMat);
      leftFlash.position.set(-27.0, 137.0, 2.0);
      leftFlash.rotation.set(0, -Math.PI * 0.48, -0.08);
      m.add(leftFlash);

      const rightFlash = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 9.0), shoulderMat);
      rightFlash.position.set(27.0, 137.0, 2.0);
      rightFlash.rotation.set(0, Math.PI * 0.48, 0.08);
      m.add(rightFlash);

      this.leoTops.swat = this.ground(m, 26, this.leoPos.swat);
      this.leoGroup.add(m);
      done();
    }, undefined, done);

    // 6. Facebook / Meta Logo hovering above the Mirrored Datacentre in LEO mode
    this.loader.load('models/leo/facebook.glb', (gltf) => {
      this.fbLogo = gltf.scene;
      this.fbLogo.userData.stationKey = 'facebook';
      this.fbLogo.traverse(c => { if (c.isMesh) c.userData.stationKey = 'facebook'; });
      this.centerAndScale(this.fbLogo, 12);
      this.fbLogo.position.set(this.leoPos.bot.x, 22, this.leoPos.bot.z - 5);
      this.leoGroup.add(this.fbLogo);
      done();
    }, undefined, done);

    // 7. 3D RCMP OSINT Laptop (`personal_computer.glb`) with Official RCMP Logo & SpiderFoot screen mounted on the elevated plane above the Police officer's head!
    this.osintWebGroup = this.createRcmpOsintLaptop(done);
    this.osintWebGroup.position.copy(this.leoPos.osint);
    this.leoGroup.add(this.osintWebGroup);
    this.leoTops.osint = this.leoPos.osint.y + 10;
  }

  initAppleGoogleSkyscraper(done) {
    // Push Service / App Stores Station — Apple & Google Signs ONLY
    this.storeGroup = new THREE.Group();
    this.storeGroup.position.set(POS.post.x, 0, POS.post.z);
    this.normalGroup.add(this.storeGroup);

    // Sleek dark architectural cyber-plinth at ground level
    const plinthGeo = new THREE.CylinderGeometry(14, 15.5, 1.2, 48);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x0a0f1d,
      roughness: 0.35,
      metalness: 0.8
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = 0.6;
    this.storeGroup.add(plinth);

    // Glowing cyan cyber rim ring around plinth
    const ringGeo = new THREE.TorusGeometry(14.8, 0.18, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = 1.22;
    this.storeGroup.add(ring);

    // Front-facing logo mount group for Apple and Google signs
    this.frontLogosGroup = new THREE.Group();
    this.frontLogosGroup.position.set(0, 10.5, 0);
    this.storeGroup.add(this.frontLogosGroup);

    // Illumination for the signs
    const signLight = new THREE.PointLight(0xffffff, 2.8, 60);
    signLight.position.set(0, 14, 12);
    this.storeGroup.add(signLight);

    const cyanGlow = new THREE.PointLight(0x38bdf8, 2.0, 35);
    cyanGlow.position.set(-6.8, 8, 4);
    this.storeGroup.add(cyanGlow);

    const amberGlow = new THREE.PointLight(0xf59e0b, 2.0, 35);
    amberGlow.position.set(6.8, 8, 4);
    this.storeGroup.add(amberGlow);

    this.tops.post  = 18;
    this.tops.store = 18;

    let partsReady = 0;
    const partsExpected = 2; // Only Apple and Google logos
    const checkClone = () => {
      partsReady++;
      if (partsReady === partsExpected && this.leoAgGroup) {
        if (this.leoAgBag) this.leoAgGroup.remove(this.leoAgBag);
        this.leoAgBag = this.storeGroup.clone(true);
        this.leoAgBag.position.set(0, 0, 0);
        this.leoAgGroup.add(this.leoAgBag);
      }
      done();
    };

    // Mount Apple Logo (left) and Google Logo (right) - Identical scale and matching finish
    const mountLogo = (path, xOffset, isApple) => {
      this.loader.load(path, (gltf) => {
        const logo = gltf.scene;
        logo.traverse((ch) => {
          if (ch.isMesh && ch.material) {
            ch.material.metalness = 0.52;
            ch.material.roughness = 0.24;
            ch.material.envMapIntensity = 1.35;
            ch.castShadow = true;
          }
        });
        let box = new THREE.Box3().setFromObject(logo);
        const raw = box.getSize(new THREE.Vector3());
        // Large, prominent, identical scale for both logos
        const targetSize = 10.5;
        const s = targetSize / Math.max(raw.x || 1, raw.y || 1);
        logo.scale.setScalar(s);
        logo.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(logo);
        const c = box.getCenter(new THREE.Vector3());

        const wrap = new THREE.Group();
        logo.position.set(-c.x, -c.y, -c.z);
        wrap.add(logo);
        wrap.position.set(xOffset, 0, 0);

        if (isApple) this.appleLogoMesh = wrap;
        else this.googleLogoMesh = wrap;

        this.frontLogosGroup.add(wrap);
        this.updateLogoHighlight();
        checkClone();
      }, undefined, checkClone);
    };

    mountLogo('models/apple_logo.glb', -6.8, true);
    mountLogo('models/google_logo.glb',  6.8, false);
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

    const isPush  = mode === 'push';
    const isWorld = mode === 'world';
    const isLeo   = mode === 'leo';
    this.flipTarget = isLeo ? Math.PI : 0;

    const color = isLeo ? 0xf43f5e : (isWorld ? 0x38bdf8 : (isPush ? 0x34d399 : 0xfbbf24));
    this.ringMat.color.setHex(color);
    this.beadMat.color.setHex(color);
    this.setupLines.forEach((l) => (l.visible = mode === 'setup'));
    this.pushLines.forEach((l) => (l.visible = isPush));
    this.flowCones.forEach((fc) => (fc.mesh.visible = !isLeo && !isWorld));
    this.leoLines.forEach((l) => (l.visible = isLeo));

    document.body.classList.toggle('leo-mode', isLeo);
    document.getElementById('btn-leo').classList.toggle('active', isLeo);
    document.getElementById('mode-setup').classList.toggle('active', mode === 'setup');
    document.getElementById('mode-push').classList.toggle('active', isPush);
    const btnWorld = document.getElementById('mode-world');
    if (btnWorld) btnWorld.classList.toggle('active', isWorld);
    document.getElementById('brand-dot').classList.toggle('push', isPush || isWorld);
    document.getElementById('brand-dot').classList.toggle('leo', isLeo);
    document.getElementById('btn-play').classList.toggle('push', isPush || isWorld);
    document.getElementById('scrub').classList.toggle('push', isPush || isWorld);

    const banner = document.getElementById('polarity-banner');
    banner.classList.toggle('push', isPush || isWorld);
    banner.classList.toggle('leo', isLeo);
    document.getElementById('pol-arrow').textContent = isLeo ? '⚖' : (isWorld ? '🌐' : (isPush ? '↻' : '↺'));
    document.getElementById('pol-label').textContent = isLeo
      ? 'LAW ENFORCEMENT TRACE'
      : (isWorld ? 'ALL WORLD STIMS' : (isPush ? 'BEJEWELED PUSH' : 'INSTALL & SETUP'));
    document.getElementById('pol-route').textContent = isLeo
      ? 'Threat → Proton (Denied) → RCMP OSINT Laptop → Meta/X Tokens → Apple/Google HQ'
      : (isWorld
        ? 'Planet Earth (Bejeweled / FB / IG / X / Uber / Amazon) → Datacentre → Apple/Google HQ → Phone'
        : (isPush
          ? 'Planet Earth Trigger → Datacentre → Apple/Google HQ → Phone'
          : 'Apple/Google HQ → Phone → Unique Key → Datacentre'));
  }

  setAutoOrbit(on) {
    this.autoOrbit = on;
    if (on) this.cinematicFollow = false;
    document.getElementById('btn-orbit').classList.toggle('on', on);
  }

  setPlaying(auto) {
    this.playing = auto;
    if (!auto) {
      this.targetT = this.t;
      this.cinematicFollow = true;
    } else {
      this.cinematicFollow = false;
    }
    // Always allow 100% free zoom on mouse wheel and trackpad pinch
    this.controls.enableZoom = true;
    const btn = document.getElementById('btn-play');
    btn.textContent = auto ? '▶' : '🎥';
    btn.classList.toggle('manual', !auto);
  }

  stepCycle(dir) {
    // Step cleanly to the next or previous narrative beat with smooth cinematic camera tracking
    if (this.playing) this.setPlaying(false);
    this.cinematicFollow = true;
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
    const btnIos = document.getElementById('btn-os-ios');
    const btnAndroid = document.getElementById('btn-os-android');
    if (btnIos) btnIos.addEventListener('click', () => this.setOS('ios'));
    if (btnAndroid) btnAndroid.addEventListener('click', () => this.setOS('android'));

    const pinPhoneOs = document.getElementById('pin-phone-os');
    if (pinPhoneOs) pinPhoneOs.addEventListener('click', () => this.toggleOS());

    document.getElementById('mode-setup').addEventListener('click', () => this.setMode('setup'));
    document.getElementById('mode-push').addEventListener('click', () => this.setMode('push'));
    const btnWorld = document.getElementById('mode-world');
    if (btnWorld) btnWorld.addEventListener('click', () => this.setMode('world'));
    document.getElementById('btn-leo').addEventListener('click', () => {
      this.setMode(this.mode === 'leo' ? this.prevNormalMode : 'leo');
    });
    document.getElementById('btn-flip').addEventListener('click', () => {
      const order = ['setup', 'push', 'world'];
      const next = order[(order.indexOf(this.mode) + 1) % order.length];
      this.setMode(next);
    });

    document.getElementById('scrub').addEventListener('input', (e) => {
      if (this.playing) this.setPlaying(false);
      this.cinematicFollow = true;
      this.targetT = parseInt(e.target.value, 10) / 1000;
    });
    document.getElementById('btn-play').addEventListener('click', () => {
      this.setPlaying(!this.playing);
    });
    document.getElementById('btn-step-prev').addEventListener('click', () => this.stepCycle(-1));
    document.getElementById('btn-step-next').addEventListener('click', () => this.stepCycle(1));
    document.getElementById('btn-orbit').addEventListener('click', () => {
      this.resetFocus();
      this.setAutoOrbit(!this.autoOrbit);
    });
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    });

    // Raycast click detection on 3D GLB models -> Snap camera into close cinematic focus with shallow DOF lighting!
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let downX = 0, downY = 0;

    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
    });

    this.renderer.domElement.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) return; // user dragged/orbited

      const rect = this.renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, this.camera);

      const activeGroup = this.mode === 'leo' ? this.leoGroup : this.normalGroup;
      const hits = raycaster.intersectObjects(activeGroup.children, true);

      if (hits.length > 0) {
        let nodeKey = null;
        for (const hit of hits) {
          let curr = hit.object;
          while (curr && curr !== activeGroup) {
            if (curr.userData && curr.userData.stationKey) {
              nodeKey = curr.userData.stationKey;
              break;
            }
            curr = curr.parent;
          }
          if (nodeKey) break;
        }

        if (!nodeKey) {
          const hp = hits[0].point;
          if (this.mode === 'leo') {
            const d1 = hp.distanceTo(this.leoPos.bandit);
            const d2 = hp.distanceTo(this.leoPos.swat);
            const d3 = hp.distanceTo(this.leoPos.osint);
            const d4 = hp.distanceTo(this.leoPos.bot);
            const minD = Math.min(d1, d2, d3, d4);
            if (minD === d1) nodeKey = 'bandit';
            else if (minD === d2) nodeKey = 'swat';
            else if (minD === d3) nodeKey = 'osint';
            else nodeKey = 'facebook';
          } else {
            const d1 = hp.distanceTo(POS.phone);
            const d2 = hp.distanceTo(POS.server);
            const d3 = hp.distanceTo(POS.post);
            const d4 = hp.distanceTo(POS.ufo);
            const minD = Math.min(d1, d2, d3, d4);
            if (minD === d1) nodeKey = 'phone';
            else if (minD === d2) nodeKey = 'server';
            else if (minD === d3) nodeKey = 'post';
            else nodeKey = 'world';
          }
        }

        if (nodeKey === 'phone') {
          this.toggleOS();
        }

        if (nodeKey) {
          this.snapFocusToNode(nodeKey);
        }
      } else {
        this.resetFocus();
      }
    });

    // Wheel zoom releases cinematic follow and focus lock so user has instant free zoom
    this.renderer.domElement.addEventListener('wheel', () => {
      this.cinematicFollow = false;
      this.focusCamPos = null;
      this.focusTargetPos = null;
    }, { passive: true });

    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); this.setPlaying(!this.playing); }
      else if (e.key === 'Tab') {
        e.preventDefault();
        const order = ['setup', 'push', 'world'];
        this.setMode(order[(order.indexOf(this.mode) + 1) % order.length]);
      }
      else if (e.key === '1') this.setMode('setup');
      else if (e.key === '2') this.setMode('push');
      else if (e.key === '3') this.setMode('world');
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
    this.tokenKey.scale.setScalar(1.2);
    this.keyForge.visible = false;
    this.directBlockGroup.visible = false;
    this.pushOrb.visible = false;
    this.triggerBolt.visible = false;
    this.brainGroup.visible = false;
    this.leoPacket.visible = false;
    if (this.leoBomb) this.leoBomb.visible = false;
    this.leoKey.visible = false;
    this.leoDeliveredCards.visible = false;
    this.rejectX.visible = false;
    if (this.phoneEmojiBadge) this.phoneEmojiBadge.visible = false;

    const isLeo = this.mode === 'leo';

    // Show 3D Emoji State above the Phone (`😴 App Sleeping` vs. `😃 App Awake!`)
    if (!isLeo) {
      if (this.mode === 'setup' && t >= 0.24) {
        this.setPhoneEmojiState(t < 0.76 ? 'awake' : 'sleep');
      } else if (this.mode === 'push') {
        this.setPhoneEmojiState(t < 0.90 ? 'sleep' : 'awake');
      }
    }

    // Bejeweled gemstones stay visibly installed on the phone ONLY in Mode 1 (after install) & Mode 2 (Bejeweled push) — hidden during Mode 3 multi-app push stream!
    this.installedApp.visible = !isLeo && (this.mode === 'push' || (this.mode === 'setup' && t >= 0.24));
    // Key stays persistently stored on the server once registered!
    this.storedKey.visible = !isLeo && (this.mode === 'push' || this.mode === 'world' || t >= 0.92);

    let moverPos = null;
    let moverParent = this.worldGroup;
    let moverText = '';
    let moverCls = '';

    let showInstall = false;
    let showToken = false;
    let showNoDirect = false;
    let showSaved = false;
    let showPush = false;
    let showLedger = false;

    let showLeoThreat = false;
    let showLeoDenied = false;
    let showLeoOsint  = false;
    let showLeoTokens = false;
    let showLeoId     = false;

    if (this.mode === 'setup') {
      this.updatePhoneScreenCanvas(t < 0.76 ? 'awake' : 'sleeping', 0);
      if (t < 0.24) {
        const p = this.arcStoreToPhone.getPoint(seg(t, 0, 0.24));
        this.appOrb.visible = true;
        this.appOrb.position.copy(p);
        moverPos = p;
        moverText = this.currentOS === 'ios' ? ' App Store · Bejeweled Blitz' : '🤖 Google Play · Bejeweled Blitz';
        moverCls = 'cyan';
      } else if (t < 0.30) {
        showInstall = true;
      } else if (t < 0.38) {
        // Explicit registration request from Phone -> Post Office before the Post Office prints the new Unique Key!
        const p = this.arcPhoneToPost.getPoint(seg(t, 0.30, 0.38));
        this.triggerBolt.visible = true;
        this.triggerBolt.position.copy(p);
        moverPos = p;
        moverText = this.currentOS === 'ios' ? '📲 Request APNs Token' : '📲 Request FCM Token';
        moverCls = 'cyan';
      } else if (t < 0.50) {
        // 3D Laser-Printing / Holographic Materialization of the brand-new Unique Device Key at Post Office!
        const mp = seg(t, 0.38, 0.50);
        const forgePos = new THREE.Vector3(POS.post.x, this.tops.post + 6, POS.post.z);
        this.keyForge.visible = true;
        this.keyForge.position.copy(forgePos);

        // Sweeping laser ring prints bottom-to-top (-3.8 -> +3.8) twice while key solidifies
        const scanY = -3.8 + ((mp * 2.0) % 1.0) * 7.6;
        this.forgeLaserRing.position.y = scanY;
        this.forgeWireKey.rotation.y = this.tokenKey.rotation.y;
        this.forgeWireMat.opacity = 0.85 * (1 - mp * 0.65);
        this.forgeCylMat.opacity = 0.22 * Math.sin(mp * Math.PI);
        this.forgeSparks.rotation.y += 0.14;

        // Solid golden key materializes inside the wireframe blueprint shell
        this.tokenKey.visible = true;
        this.tokenKey.position.copy(forgePos);
        const easeScale = 0.15 + 1.05 * (1 - Math.pow(1 - mp, 2.5));
        this.tokenKey.scale.set(1.2 * easeScale, 1.2 * Math.max(0.08, mp), 1.2 * easeScale);

        moverPos = forgePos;
        moverText = this.currentOS === 'ios' ? '🔑 Apple Generates APNs Token' : '🔑 Google Generates FCM Token';
        moverCls = 'cyan';
      } else if (t < 0.62) {
        const p = this.arcPostToPhone.getPoint(seg(t, 0.50, 0.62));
        this.tokenKey.visible = true;
        this.tokenKey.position.copy(p);
        moverPos = p;
        moverText = this.currentOS === 'ios' ? '🔑 APNs Token → iPhone' : '🔑 FCM Token → Android';
      } else if (t < 0.76) {
        // Dedicated beat on Phone showing the Unique Gold Key on the Phone
        this.tokenKey.visible = true;
        this.tokenKey.position.set(POS.phone.x, this.tops.phone + 12.5, POS.phone.z);
        this.tokenKey.scale.setScalar(1.45);
        showToken = true;
      } else if (t < 0.92) {
        const p = this.arcPhoneToServer.getPoint(seg(t, 0.76, 0.92));
        this.tokenKey.visible = true;
        this.tokenKey.position.copy(p);
        moverPos = p;
        moverText = '🔑 Register Token with Server';
      } else {
        showSaved = true;
      }
    } else if (this.mode === 'push') {
      if (t < 0.70) {
        this.updatePhoneScreenCanvas('sleeping', 0);
      } else {
        this.updatePhoneScreenCanvas('awake', seg(t, 0.70, 0.92));
      }

      if (t < 0.16) {
        const p = this.arcUfoToServer.getPoint(seg(t, 0, 0.16));
        this.triggerBolt.visible = true;
        this.triggerBolt.position.copy(p);
        moverPos = p;
        moverText = '⚡ Promo Trigger';
        moverCls = 'cyan';
      } else if (t < 0.30) {
        // Beat 2 in Push Delivery: App Maker tries to reach Phone directly -> Blocked by OS Firewall! Must go via Apple / Google
        const bp = seg(t, 0.16, 0.30);
        this.directBlockGroup.visible = true;
        const pServer = POS.server.clone().setY(16);
        const pMid    = new THREE.Vector3(0, 16, POS.phone.z);
        const bounceU = bp < 0.65 ? (bp / 0.65) : (1 - (bp - 0.65) / 0.35 * 0.45);
        const p = pServer.clone().lerp(pMid, clamp01(bounceU));
        this.pushOrb.visible = true;
        this.pushOrb.position.copy(p);
        showNoDirect = true;
      } else if (t < 0.48) {
        const p = this.arcServerToPost.getPoint(seg(t, 0.30, 0.48));
        this.pushOrb.visible = true;
        this.pushOrb.position.copy(p);
        moverPos = p;
        moverText = this.currentOS === 'ios' ? ' APNs Payload + 🔑 Key' : '🤖 FCM Payload + 🔑 Key';
        moverCls = 'push';
      } else if (t < 0.70) {
        const bp = seg(t, 0.48, 0.70);
        this.brainGroup.visible = true;
        this.updateBrainAndLedger(bp);
        showLedger = true;
      } else if (t < 0.90) {
        const p = this.arcPostToPhone.getPoint(seg(t, 0.70, 0.90));
        this.pushOrb.visible = true;
        this.pushOrb.position.copy(p);
        moverPos = p;
        moverText = this.currentOS === 'ios' ? ' Deliver APNs Push → iPhone' : '🤖 Deliver FCM Push → Android';
        moverCls = 'push';
      } else {
        showPush = true;
      }
    } else if (this.mode === 'world') {
      this.updatePhoneScreenCanvas('awake', 1.0);
      for (const s of this.worldStimStreams) {
        const u = (s.offset + t) % 1;
        const p = s.curve.getPoint(u);
        s.currentPos.copy(p);
        s.orb.position.copy(p);
        s.orb.lookAt(this.camera.position);
      }
    } else {
      // LAW ENFORCEMENT UPSIDE-DOWN REVERSE TRACE:
      moverParent = this.leoGroup;
      if (t >= 0.18 && t < 0.65) {
        this.updateRcmpLaptopScreen(t);
      }

      if (t < 0.20) {
        // Bad guy types ProtonMail threat email directly on his laptop screen
        const tp = seg(t, 0, 0.16);
        this.updateHackerEmailScreen(tp);
        moverPos = this.leoPos.bandit.clone().add(new THREE.Vector3(0, 16, 0));
        moverText = t < 0.15 ? '💻 badguy@proton.me composing encrypted threat…' : '✉ Threat Sent: badguy@proton.me → 911@poj.ca';
        moverCls = 'red';
      } else if (t < 0.36) {
        showLeoThreat = true;
        const u = seg(t, 0.22, 0.31);
        const p = this.arcLeoProton.getPoint(u);
        this.leoPacket.visible = t < 0.32;
        this.leoPacket.position.copy(p);
        this.leoPacketMat.color.setHex(0xf43f5e);
        this.leoPacketMat.emissive.setHex(0xbe123c);
        if (t < 0.30) {
          moverPos = p;
          moverText = '🇨🇦 Police → Proton';
          moverCls = 'red';
        } else {
          this.rejectX.visible = true;
          showLeoDenied = true;
        }
      } else if (t < 0.50) {
        // Beat 3: Police runs Google & Sherlock OSINT Search on the elevated RCMP Laptop directly above their head!
        const p = this.arcLeoOsint.getPoint(seg(t, 0.36, 0.43));
        this.leoPacket.visible = t < 0.44;
        this.leoPacket.position.copy(p);
        this.leoPacketMat.color.setHex(0xfbbf24);
        this.leoPacketMat.emissive.setHex(0xb45309);
        this.leoPacketLight.color.setHex(0xfbbf24);
        if (t < 0.43) {
          moverPos = p;
          moverText = '💻 Sherlock & Google OSINT Recon';
        } else {
          showLeoOsint = true;
        }
      } else if (t < 0.68) {
        // Beat 4: OSINT Web pivots to Meta/Instagram/X (0.50–0.56) with Exigent Section 487.014 Production Demand,
        // and Meta/X return the 3 Push Tokens (0.56–0.68)!
        if (t < 0.56) {
          const p = this.arcLeoOsintToMeta.getPoint(seg(t, 0.50, 0.56));
          this.leoPacket.visible = true;
          this.leoPacket.position.copy(p);
          this.leoPacketMat.color.setHex(0x38bdf8);
          this.leoPacketMat.emissive.setHex(0x0284c7);
          this.leoPacketLight.color.setHex(0x38bdf8);
          moverPos = p;
          moverText = '⚖ Exigent Demand → Meta / IG / X';
          moverCls = 'cyan';
        } else {
          const p = this.arcLeoTokens.getPoint(seg(t, 0.56, 0.64));
          this.leoKey.visible = true;
          this.leoKey.position.copy(p);
          if (t < 0.63) {
            moverPos = p;
            moverText = '🔑 3 Push Tokens Acquired';
          } else {
            showLeoTokens = true;
          }
        }
      } else if (t < 0.86) {
        const p = this.arcLeoToAg.getPoint(seg(t, 0.68, 0.84));
        this.leoKey.visible = true;
        this.leoKey.position.copy(p);
        moverPos = p;
        moverText = '🇨🇦 Order + 🔑 Tokens → Apple / Google';
        moverCls = 'cyan';
      } else {
        // Beat 6: 3D Photo ID + Credit Card fly from Apple/Google -> Police and fan out above Police!
        const p = this.arcLeoFromAg.getPoint(seg(t, 0.86, 0.94));
        this.leoDeliveredCards.visible = true;
        if (t < 0.94) {
          this.leoDeliveredCards.position.copy(p);
          moverPos = p;
          moverText = '🪪 ID + Billing Card';
          moverCls = 'push';
        } else {
          this.leoDeliveredCards.position.set(this.leoPos.swat.x, this.leoTops.swat + 8, this.leoPos.swat.z);
          showLeoId = true;
        }
      }
    }

    // Normal mode station labels (3 Unified Ground Nodes + World above Datacentre; hidden when flipped to Law Enforcement)
    const showNorm = !isLeo && this.flipRoll < Math.PI * 0.45;
    this.place('pin-store',  null, false);
    this.place('pin-post',   new THREE.Vector3(POS.post.x,   this.tops.post + 2, POS.post.z), showNorm);
    this.place('pin-phone',  new THREE.Vector3(POS.phone.x,  -1.5, POS.phone.z + 8), showNorm);
    this.place('pin-phone-os', new THREE.Vector3(POS.phone.x, this.tops.phone + 14.5, POS.phone.z), showNorm);
    this.place('pin-server', new THREE.Vector3(POS.server.x, -1.5, POS.server.z + 8), showNorm);
    this.place('pin-ufo',    new THREE.Vector3(POS.ufo.x,    POS.ufo.y + 15, POS.ufo.z), showNorm);

    // 3D App Icon Tiles stream in Mode 3 (no 2D HUD pills attached to them, keeping the HUD clean!)
    const showStims = showNorm && this.mode === 'world';
    if (this.worldStimGroup) this.worldStimGroup.visible = showStims;
    if (this.worldStimStreams) {
      for (const s of this.worldStimStreams) {
        s.orb.visible = showStims;
        this.place(s.id, null, false);
      }
    }

    // Law Enforcement station labels (visible when flipped upside down!)
    const showLeoPins = isLeo && this.flipRoll > Math.PI * 0.55;
    const L = this.leoPos;
    this.place('pin-leo-bandit',      new THREE.Vector3(L.bandit.x, -1.5, L.bandit.z + 8), showLeoPins, this.leoGroup);
    this.place('pin-leo-swat',        new THREE.Vector3(L.swat.x,   -1.5, L.swat.z + 8),   showLeoPins, this.leoGroup);
    this.place('pin-leo-bot',         new THREE.Vector3(L.bot.x,    -1.5, L.bot.z + 8),    showLeoPins, this.leoGroup);
    this.place('pin-leo-osint-plane', new THREE.Vector3(L.osint.x,  this.leoTops.osint + 2, L.osint.z), showLeoPins, this.leoGroup);
    this.place('pin-leo-proton',      new THREE.Vector3(L.proton.x, this.leoTops.proton + 2, L.proton.z), showLeoPins, this.leoGroup);
    this.place('pin-leo-ag',          new THREE.Vector3(L.ag.x,     this.leoTops.ag + 2, L.ag.z), showLeoPins, this.leoGroup);

    // Normal contextual callouts (genuine push banner sits right on top of the Phone screen!)
    const phoneTop  = new THREE.Vector3(POS.phone.x,  this.tops.phone + 11, POS.phone.z);
    const phoneFace = new THREE.Vector3(POS.phone.x,  this.tops.phone + 3,  POS.phone.z + 2);
    const serverTop = new THREE.Vector3(POS.server.x, this.tops.server + 4, POS.server.z);
    const blockTop  = new THREE.Vector3(0, 29, POS.phone.z);
    this.place('pin-install',   phoneTop,  showNorm && showInstall);
    this.place('pin-token',     phoneTop,  showNorm && showToken);
    this.place('pin-no-direct', blockTop,  showNorm && showNoDirect);
    this.place('pin-saved',     serverTop, showNorm && showSaved);
    this.place('pin-push',      phoneFace, showNorm && showPush);
    this.place('pin-ledger',    new THREE.Vector3(POS.post.x, 54, POS.post.z), showNorm && showLedger);

    // Law Enforcement contextual callouts (OSINT callout sits on the elevated OSINT plane above Police's head!)
    this.place('pin-leo-threat', new THREE.Vector3(L.swat.x,   this.leoTops.swat + 4,   L.swat.z),   showLeoPins && showLeoThreat, this.leoGroup);
    this.place('pin-leo-denied', new THREE.Vector3(L.proton.x, this.leoTops.proton + 6, L.proton.z), showLeoPins && showLeoDenied, this.leoGroup);
    this.place('pin-leo-osint',  new THREE.Vector3(L.osint.x,  this.leoTops.osint + 4,  L.osint.z),  showLeoPins && showLeoOsint,  this.leoGroup);
    this.place('pin-leo-tokens', new THREE.Vector3(L.swat.x,   this.leoTops.swat + 4,   L.swat.z),   showLeoPins && showLeoTokens, this.leoGroup);
    this.place('pin-leo-id',     new THREE.Vector3(L.swat.x,   this.leoTops.swat + 4,   L.swat.z),   showLeoPins && showLeoId,     this.leoGroup);

    const mv = document.getElementById('pin-mover');
    mv.className = 'pin pin-mover' + (moverCls ? ' ' + moverCls : '');
    mv.textContent = moverText;
    this.place('pin-mover', moverPos ? moverPos.clone().add(new THREE.Vector3(0, 4.5, 0)) : null, !!moverPos, moverParent);

    // Compute exact 3D world-space focus point for Cinematic Step-by-Step Camera!
    let focusLocal = null;
    let focusGroup = this.worldGroup;
    let focusDist = 80;

    if (moverPos) {
      focusLocal = moverPos.clone();
      focusGroup = moverParent;
      focusDist = 80;
    } else if (!isLeo) {
      if (showInstall || showPush || showToken) {
        focusLocal = new THREE.Vector3(POS.phone.x, 16, POS.phone.z);
        focusDist = 78;
      } else if (showNoDirect) {
        focusLocal = new THREE.Vector3(0, 16, POS.phone.z);
        focusDist = 80;
      } else if (showLedger) {
        focusLocal = new THREE.Vector3(POS.post.x, 22, POS.post.z);
        focusDist = 94;
      } else if (showSaved) {
        focusLocal = new THREE.Vector3(POS.server.x, 16, POS.server.z);
        focusDist = 82;
      } else if (this.mode === 'world' && this.worldStimStreams?.length) {
        focusLocal = this.worldStimStreams[0].currentPos.clone();
        focusDist = 82;
      }
    } else {
      focusGroup = this.leoGroup;
      if (t < 0.20) {
        focusLocal = new THREE.Vector3(L.bandit.x, 14, L.bandit.z);
        focusDist = 65;
      } else if (showLeoThreat || showLeoTokens || showLeoId) {
        focusLocal = new THREE.Vector3(L.swat.x, 14, L.swat.z);
        focusDist = 82;
      } else if (showLeoDenied) {
        focusLocal = new THREE.Vector3(L.proton.x, 16, L.proton.z);
        focusDist = 80;
      } else if (showLeoOsint) {
        focusLocal = new THREE.Vector3(L.osint.x, L.osint.y, L.osint.z);
        focusDist = 58;
      }
    }

    if (focusLocal) {
      const worldFocus = focusLocal.applyMatrix4(focusGroup.matrixWorld);
      this.cineLookAt.copy(worldFocus);

      // Snap strictly to the OUTSIDE facing IN LATERALLY at eye level (NO bird's eye view from top!)
      const radial = new THREE.Vector3(worldFocus.x, 0, worldFocus.z);
      if (radial.lengthSq() < 1) radial.set(0, 0, 1);
      radial.normalize();

      this.cineCamPos
        .copy(worldFocus)
        .addScaledVector(radial, focusDist);
      this.cineCamPos.y = worldFocus.y + 1.5; // Lateral eye-level!
    }
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
    // Sparkling fuse wick animation at the tip of the round bomb (`comical_bomb.glb`)
    if (this.leoBomb && this.leoBomb.visible) {
      this.animateWickSparks(now);
    }
    if (this.leoAgBag && this.leoGroup.visible) this.leoAgBag.rotation.y += dt * 0.45;
    if (this.leoIdStack && this.leoGroup.visible) {
      this.leoIdStack.rotation.y -= dt * 0.6;
      this.leoIdStack.position.y = 46 + Math.sin(now * 0.003) * 1.1;
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
    if (this.directBlockGroup && this.directBlockGroup.visible) {
      // Subtle alternating red / blue police strobe just behind the diamond tile (no scale throbbing!)
      const pulse = Math.sin(now * 0.011);
      const redWeight  = pulse > 0 ? 1.0 : 0.15;
      const blueWeight = pulse > 0 ? 0.15 : 1.0;
      if (this.jailStrobeRed)   this.jailStrobeRed.intensity = 4.2 * redWeight;
      if (this.jailStrobeBlue)  this.jailStrobeBlue.intensity = 4.2 * blueWeight;
      if (this.jailHaloRedMat)  this.jailHaloRedMat.opacity = 0.28 * redWeight;
      if (this.jailHaloBlueMat) this.jailHaloBlueMat.opacity = 0.28 * blueWeight;
      if (this.jailBackingMat) {
        const hex = pulse > 0 ? 0xff1e56 : 0x2563eb;
        this.jailBackingMat.color.setHex(hex);
        this.jailBackingMat.emissive.setHex(hex);
      }
    }

    if (this.playing) {
      this.t = (this.t + dt / MODE_SECONDS[this.mode]) % 1;
      this.targetT = this.t;
    } else {
      // Smooth damped glide toward targetT for silky scroll & step transitions
      this.t += (this.targetT - this.t) * Math.min(1, dt * 10);
      if (Math.abs(this.targetT - this.t) < 0.0004) this.t = this.targetT;
    }

    if (this.focusTargetPos && this.focusCamPos) {
      // Smooth cinematic camera snap into focus on clicked GLB model with shallow depth of field emphasis!
      this.controls.target.lerp(this.focusTargetPos, Math.min(1, dt * 5.0));
      this.camera.position.lerp(this.focusCamPos, Math.min(1, dt * 4.2));
      this.orbitAngle = Math.atan2(this.camera.position.x, this.camera.position.z);
      if (this.camera.position.distanceTo(this.focusCamPos) < 1.0) {
        this.focusTargetPos = null;
        this.focusCamPos = null;
      }
    } else if (!this.playing && this.cinematicFollow) {
      // Video-Game Cinematic Step-by-Step Camera: smoothly dolly & pan onto the active packet / node!
      const camLerp = Math.min(1, dt * 3.8);
      const tgtLerp = Math.min(1, dt * 5.0);
      this.camera.position.lerp(this.cineCamPos, camLerp);
      this.controls.target.lerp(this.cineLookAt, tgtLerp);
      this.orbitAngle = Math.atan2(this.camera.position.x, this.camera.position.z);
      if (this.camera.position.distanceTo(this.cineCamPos) < 1.2) {
        this.cinematicFollow = false;
      }
    } else if (this.autoOrbit) {
      this.orbitAngle += dt * 0.12;
      const camR = 136;
      const desiredPos = new THREE.Vector3(
        Math.sin(this.orbitAngle) * camR,
        56 + Math.sin(this.orbitAngle * 0.7) * 6,
        Math.cos(this.orbitAngle) * camR
      );
      this.camera.position.lerp(desiredPos, Math.min(1, dt * 3.5));
      this.controls.target.lerp(new THREE.Vector3(0, 16, 0), Math.min(1, dt * 4.0));
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

    // Gently rotate ONLY the 3D Brain mesh when active above the Apple & Google Skyscraper HQ
    if (this.brainGroup && this.brainGroup.visible) {
      if (this.brainMesh) this.brainMesh.rotation.y += dt * 0.9;
      this.brainGroup.position.y = 46 + Math.sin(now * 0.004) * 0.8;
    }

    if (this.ufoGroup) {
      this.ufoGroup.rotation.y += dt * 0.7;
      this.ufoGroup.position.y = POS.ufo.y + Math.sin(now * 0.0025) * 1.4;
    }
    if (this.storeGroup && this.camera) {
      // Always keep the San Francisco cityscape and logos facing directly towards the camera during orbit!
      const dx = this.camera.position.x - POS.post.x;
      const dz = this.camera.position.z - POS.post.z;
      this.storeGroup.rotation.y = Math.atan2(dx, dz);
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
    if (this.pushOrb && this.pushOrb.visible) {
      // Keep the 3D Push Payload Card facing the camera so it is always crisp and legible
      this.pushOrb.lookAt(this.camera.position);
    }
    this.stars.rotation.y += dt * 0.015;

    // Animate single Server Tower LEDs + vertical data-scan bar (burst faster when triggered or saving!)
    if (this.dcLeds) {
      const busy = (this.mode === 'push' && this.t < 0.44) || (this.mode === 'setup' && this.t >= 0.85) || this.mode === 'world';
      const mult = busy ? 2.6 : 1.0;
      const tSec = now * 0.001;
      for (const l of this.dcLeds) {
        const on = Math.sin(tSec * l.speed * mult + l.phase) > -0.15;
        l.mesh.visible = on;
      }
      if (this.leoDcLeds && this.leoGroup.visible) {
        for (const l of this.leoDcLeds) {
          l.mesh.visible = Math.sin(tSec * l.speed * 1.6 + l.phase) > -0.15;
        }
      }
      const towerH = this.dcTowerHeight || 26;
      const scanY = 2.5 + ((Math.sin(tSec * (busy ? 4.5 : 2.0)) * 0.5 + 0.5) * (towerH - 4.0));
      if (this.dcScanBar) this.dcScanBar.position.y = scanY;
      if (this.leoDcScanBar && this.leoGroup.visible) this.leoDcScanBar.position.y = scanY;

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
