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
     Phone (Smartphone + Candy Crush): front-right  (+32.5, 0, +32.5)
     App Server (Server Rack)      : front-left   (-32.5, 0, +32.5)
     Post Office (Post Box)        : back-left    (-32.5, 0, -32.5)
     External Stimulus (UFO)       : hovering above App Server (-32.5, 48, +32.5)

   Two Polarity Modes:
     'setup' (↺): App Stores -> Phone (Candy Crush) -> Post Office -> Key Token -> App Server (stored)
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

const MODE_SECONDS = { setup: 15, push: 11, world: 12, leo: 18 };
const MODE_STEPS = {
  setup: [0.04, 0.12, 0.22, 0.32, 0.42, 0.52, 0.64, 0.74, 0.86, 0.96],
  push:  [0.08, 0.24, 0.39, 0.56, 0.78, 0.95],
  world: [0.08, 0.24, 0.40, 0.56, 0.72, 0.88],
  leo:   [0.08, 0.20, 0.28, 0.40, 0.58, 0.68, 0.82, 0.94]
};

// Default Director's Camera Rigs (Eye-level circular carousel track orbiting at natural eye level Y ≈ 26, constant R = 90)
const DEFAULT_DIRECTOR_RIGS = {
  // Mode 1: Setup (10 steps) — Eye-level Circular Track Carousel at constant R = 90.0, cam.y = 26.0, target.y = 18.0
  "setup_step_0": { angle: 0.43,  radius: 57.3, cam: { x: 24.0,  y: 30.0, z: 52.0 }, target: { x: 0.0,  y: 14.0, z: -46.0 } },
  "setup_step_1": { angle: 0.45,  radius: 90.0, cam: { x: 39.1,  y: 26.0, z: 81.0 }, target: { x: 24.0, y: 18.0, z: -20.0 } },
  "setup_step_2": { angle: 0.65,  radius: 90.0, cam: { x: 54.5,  y: 26.0, z: 71.6 }, target: { x: 28.0, y: 18.0, z: 8.0 } },
  "setup_step_3": { angle: 0.82,  radius: 90.0, cam: { x: 65.8,  y: 26.0, z: 61.4 }, target: { x: 32.5, y: 18.0, z: 32.5 } },
  "setup_step_4": { angle: 0.60,  radius: 90.0, cam: { x: 50.8,  y: 26.0, z: 74.3 }, target: { x: 22.0, y: 18.0, z: -4.0 } },
  "setup_step_5": { angle: 0.35,  radius: 90.0, cam: { x: 30.9,  y: 26.0, z: 84.5 }, target: { x: 18.0, y: 18.0, z: -28.0 } },
  "setup_step_6": { angle: 0.70,  radius: 90.0, cam: { x: 58.0,  y: 26.0, z: 68.8 }, target: { x: 26.0, y: 18.0, z: 16.0 } },
  "setup_step_7": { angle: 0.82,  radius: 90.0, cam: { x: 65.8,  y: 26.0, z: 61.4 }, target: { x: 32.5, y: 18.0, z: 32.5 } },
  "setup_step_8": { angle: -0.82, radius: 90.0, cam: { x: -65.8, y: 26.0, z: 61.4 }, target: { x: -32.5, y: 18.0, z: 32.5 } },
  "setup_step_9": { angle: 0.00,  radius: 90.0, cam: { x: 0.0,   y: 26.0, z: 90.0 }, target: { x: 0.0, y: 18.0, z: 0.0 } },

  // Mode 2: Push (6 steps) — Eye-level Circular Track Carousel at constant R = 90.0, cam.y = 26.0, target.y = 18.0
  "push_step_0": { angle: -0.82, radius: 90.0, cam: { x: -65.8, y: 26.0, z: 61.4 }, target: { x: -32.5, y: 18.0, z: 32.5 } },
  "push_step_1": { angle: -0.40, radius: 90.0, cam: { x: -35.0, y: 26.0, z: 82.9 }, target: { x: -16.0, y: 18.0, z: -8.0 } },
  "push_step_2": { angle: 0.35,  radius: 90.0, cam: { x: 30.9,  y: 26.0, z: 84.5 }, target: { x: 18.0, y: 18.0, z: -26.0 } },
  "push_step_3": { angle: 0.65,  radius: 90.0, cam: { x: 54.5,  y: 26.0, z: 71.6 }, target: { x: 26.0, y: 18.0, z: 14.0 } },
  "push_step_4": { angle: 0.82,  radius: 90.0, cam: { x: 65.8,  y: 26.0, z: 61.4 }, target: { x: 32.5, y: 18.0, z: 32.5 } },
  "push_step_5": { angle: 0.00,  radius: 90.0, cam: { x: 0.0,   y: 26.0, z: 90.0 }, target: { x: 0.0, y: 18.0, z: 0.0 } },

  // Mode 3: World (6 steps) — Continuous 360° orbital dolly sweep around Earth
  "world_step_0": { angle: 0.60, radius: 108.0, cam: { x: 61.0, y: 56.0, z: 89.0 },   target: { x: 0.0, y: 32.0, z: 0.0 } },
  "world_step_1": { angle: 1.65, radius: 108.0, cam: { x: 108.0, y: 54.0, z: -9.0 },  target: { x: 0.0, y: 18.0, z: 0.0 } },
  "world_step_2": { angle: 2.70, radius: 108.0, cam: { x: 46.0, y: 58.0, z: -98.0 },  target: { x: 0.0, y: 18.0, z: 0.0 } },
  "world_step_3": { angle: 3.75, radius: 108.0, cam: { x: -61.0, y: 58.0, z: -89.0 }, target: { x: 0.0, y: 18.0, z: 0.0 } },
  "world_step_4": { angle: 4.80, radius: 108.0, cam: { x: -108.0, y: 54.0, z: 10.0 }, target: { x: 0.0, y: 18.0, z: 0.0 } },
  "world_step_5": { angle: 5.85, radius: 108.0, cam: { x: -45.0, y: 56.0, z: 98.0 },  target: { x: 0.0, y: 18.0, z: 0.0 } },

  // Mode 4: Law Enforcement (8 steps) — Elevated eye-level carousel track framing origin, destination & transit arcs
  "leo_step_0": { angle: 0.87,  radius: 65.3, cam: { x: 50.0,  y: 55.0, z: 42.0 },  target: { x: 26.0, y: 45.0, z: 26.0 } }, // Suspect on Rule of Thirds
  "leo_step_1": { angle: 0.00,  radius: 76.0, cam: { x: 0.0,   y: 56.0, z: 76.0 },  target: { x: 6.0,  y: 44.0, z: 6.0 } },  // Central RCMP Green Timbers HQ
  "leo_step_2": { angle: 2.63,  radius: 85.2, cam: { x: 41.7,  y: 55.0, z: -74.2 }, target: { x: -16.2, y: 44.0, z: -16.2 } }, // Transit: RCMP -> Swiss Proton (origin, dest & arc)
  "leo_step_3": { angle: -2.08, radius: 85.2, cam: { x: -74.2, y: 55.0, z: -41.7 }, target: { x: -16.2, y: 44.0, z: 16.2 } },  // Transit: RCMP -> App Server (origin, dest & arc)
  "leo_step_4": { angle: -2.08, radius: 85.2, cam: { x: -74.2, y: 55.0, z: -41.7 }, target: { x: -16.2, y: 44.0, z: 16.2 } },  // Transit: App Server -> RCMP Tokens (origin, dest & arc)
  "leo_step_5": { angle: 1.06,  radius: 85.2, cam: { x: 74.2,  y: 55.0, z: 41.7 },  target: { x: 16.2,  y: 44.0, z: -16.2 } }, // Transit: RCMP -> Apple/Google HQ (origin, dest & arc)
  "leo_step_6": { angle: 1.06,  radius: 85.2, cam: { x: 74.2,  y: 55.0, z: 41.7 },  target: { x: 16.2,  y: 44.0, z: -16.2 } }, // Transit: Apple/Google -> RCMP Record (origin, dest & arc)
  "leo_step_7": { angle: 0.87,  radius: 65.3, cam: { x: 50.0,  y: 55.0, z: 42.0 },  target: { x: 26.0, y: 48.0, z: 26.0 } }  // Suspect unmasked on Rule of Thirds
};

const WORLD_APPS = [
  { brand: 'candycrush', name: 'Candy Crush Saga', emoji: '🍬', title: 'Lives Full! Play Now 🍬', body: 'Your 5 lives have refilled. Tap to crush candies!', color: '#f59e0b' },
  { brand: 'facebook',  name: 'Facebook',        emoji: '📘', title: 'Sarah Jenkins sent a message', body: '“Hey, are you presenting the push talk today?”', color: '#1877f2' },
  { brand: 'instagram', name: 'Instagram',       emoji: '📸', title: 'Alex Rivera liked your post', body: '“Tagged you in: Tech Architecture 2026”', color: '#ec4899' },
  { brand: 'x',         name: '𝕏 Alert',         emoji: '𝕏',  title: 'Your post is trending on 𝕏!', body: '“Push notification forensic reverse-tracing!”', color: '#e2e8f0' },
  { brand: 'uber',      name: 'Uber',            emoji: '🚗', title: 'Driver arriving in 2 minutes', body: 'Michael · Silver Toyota Prius (BC 784-XYZ)', color: '#34d399' },
  { brand: 'amazon',    name: 'Amazon Delivery', emoji: '📦', title: 'Package Delivered!', body: 'Order #408-9821 was placed on front porch', color: '#ff9900' }
];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));

function shortestAngleDiff(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function smoothDamp(current, target, velRef, smoothTime, maxSpeed, dt) {
  smoothTime = Math.max(0.0001, smoothTime);
  const omega = 2.0 / smoothTime;
  const x = omega * dt;
  const exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const origTarget = target;
  const maxChange = maxSpeed * smoothTime;
  change = Math.max(-maxChange, Math.min(maxChange, change));
  target = current - change;
  const temp = (velRef.v + omega * change) * dt;
  velRef.v = (velRef.v - omega * temp) * exp;
  let output = target + (change + temp) * exp;
  if ((origTarget - current > 0) === (output > origTarget)) {
    output = origTarget;
    velRef.v = 0;
  }
  return output;
}

function smoothDampAngle(current, target, velRef, smoothTime, maxSpeed, dt) {
  const delta = shortestAngleDiff(current, target);
  return smoothDamp(current, current + delta, velRef, smoothTime, maxSpeed, dt);
}

function catmullRom(p0, p1, p2, p3, u) {
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * u +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * u3
  );
}

function catmullRomAngle(a0, a1, a2, a3, u) {
  const b1 = a1;
  const b0 = b1 + shortestAngleDiff(b1, a0);
  const b2 = b1 + shortestAngleDiff(b1, a2);
  const b3 = b2 + shortestAngleDiff(b2, a3);
  return catmullRom(b0, b1, b2, b3, u);
}

class RoboticCameraRig {
  constructor(camera, target) {
    this.active = false;
    this.theta = 0;
    this.radius = 60;
    this.y = 30;
    this.tx = 0;
    this.ty = 14;
    this.tz = -46;
    this.vTheta = { v: 0 };
    this.vRadius = { v: 0 };
    this.vY = { v: 0 };
    this.vTx = { v: 0 };
    this.vTy = { v: 0 };
    this.vTz = { v: 0 };
    if (camera && target) this.syncFromCamera(camera, target);
  }

  zeroVelocities() {
    this.vTheta.v = 0;
    this.vRadius.v = 0;
    this.vY.v = 0;
    this.vTx.v = 0;
    this.vTy.v = 0;
    this.vTz.v = 0;
  }

  syncFromCamera(camera, target) {
    this.theta = Math.atan2(camera.position.x, camera.position.z);
    this.radius = Math.hypot(camera.position.x, camera.position.z);
    this.y = camera.position.y;
    this.tx = target.x;
    this.ty = target.y;
    this.tz = target.z;
    this.zeroVelocities();
  }

  engage(camera, target) {
    if (!this.active) {
      this.syncFromCamera(camera, target);
      this.active = true;
    }
  }

  disengage() {
    if (this.active) {
      this.active = false;
      this.zeroVelocities();
    }
  }

  stepToCylindrical(targetTheta, targetRadius, targetY, targetLook, smoothTime, dt, camera, controlsTarget) {
    this.theta = smoothDampAngle(this.theta, targetTheta, this.vTheta, smoothTime, Infinity, dt);
    this.radius = smoothDamp(this.radius, targetRadius, this.vRadius, smoothTime, Infinity, dt);
    this.y = smoothDamp(this.y, targetY, this.vY, smoothTime, Infinity, dt);

    this.tx = smoothDamp(this.tx, targetLook.x, this.vTx, smoothTime, Infinity, dt);
    this.ty = smoothDamp(this.ty, targetLook.y, this.vTy, smoothTime, Infinity, dt);
    this.tz = smoothDamp(this.tz, targetLook.z, this.vTz, smoothTime, Infinity, dt);

    camera.position.set(
      Math.sin(this.theta) * this.radius,
      this.y,
      Math.cos(this.theta) * this.radius
    );
    controlsTarget.set(this.tx, this.ty, this.tz);
    camera.lookAt(controlsTarget);
  }

  stepToCartesian(targetCam, targetLook, smoothTime, dt, camera, controlsTarget) {
    const targetTheta = Math.atan2(targetCam.x, targetCam.z);
    const targetRadius = Math.hypot(targetCam.x, targetCam.z);
    this.stepToCylindrical(targetTheta, targetRadius, targetCam.y, targetLook, smoothTime, dt, camera, controlsTarget);
  }

  isSettled(targetCam, targetLook, posEps = 0.02, velEps = 0.02) {
    const cx = Math.sin(this.theta) * this.radius;
    const cz = Math.cos(this.theta) * this.radius;
    const camDist = Math.hypot(cx - targetCam.x, this.y - targetCam.y, cz - targetCam.z);
    const tgtDist = Math.hypot(this.tx - targetLook.x, this.ty - targetLook.y, this.tz - targetLook.z);
    const maxVel = Math.max(
      Math.abs(this.vTheta.v * Math.max(1, this.radius)),
      Math.abs(this.vRadius.v),
      Math.abs(this.vY.v),
      Math.abs(this.vTx.v),
      Math.abs(this.vTy.v),
      Math.abs(this.vTz.v)
    );
    return camDist < posEps && tgtDist < posEps && maxVel < velEps;
  }
}

class PushnotOrbit {
  constructor() {
    window.app = this;
    this.MODE_STEPS = MODE_STEPS;
    this.DEFAULT_DIRECTOR_RIGS = DEFAULT_DIRECTOR_RIGS;
    this.container = document.getElementById('canvas-container');

    this.loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
    this.loader.setDRACOLoader(draco);

    this.cameraUnlocked = false;
    this.worldStepTime = performance.now();

    this.mode = 'setup'; // 'setup' | 'push' | 'world' | 'leo'
    this.currentOS = 'ios'; // 'ios' | 'android'
    this.prevNormalMode = 'setup';
    this.t = 0.0;
    this.targetT = 0.0;
    this.playing = false;
    this.autoOrbit = false;
    this.cinematicFollow = false;
    this.orbitAngle = 0.35;
    this.flipRoll = 0;
    this.flipTarget = 0;
    this.flipRollVel = { v: 0 };
    this.lastFrame = performance.now();
    this.tops = { phone: 28, server: 34, post: 32, store: 28 };

    this.initScene();
    this.cameraRig = new RoboticCameraRig(this.camera, this.controls.target);
    this.initLights();
    this.initOrbitRing();
    this.initMovers();
    this.initLeoStage();
    this.loadModels();
    this.initUI();
    this.initDirectorMode();
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
    this.camera.position.set(24.0, 30.0, 52.0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.localClippingEnabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Unified Studio IBL Environment Map for cohesive metallic & satin reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0.0, 14.0, -46.0);
    this.controls.minDistance = 15;
    this.controls.maxDistance = 450;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.addEventListener('start', () => {
      if (this.autoOrbit) this.setAutoOrbit(false);
      this.cinematicFollow = false;
      this.focusCamPos = null;
      this.focusTargetPos = null;
      if (this.cameraRig) this.cameraRig.disengage();
    });
    this.controls.addEventListener('change', () => {
      if (this.directorMode) this.updateDirectorHUD();
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

    // Subtle Cinema Circular Track Dolly Rails at outer perimeter
    const trackRailMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.28,
      transparent: true,
      opacity: 0.50
    });
    const trackInner = new THREE.Mesh(new THREE.TorusGeometry(88, 0.16, 8, 160), trackRailMat);
    trackInner.rotation.x = Math.PI / 2;
    trackInner.position.y = 0.12;
    const trackOuter = new THREE.Mesh(new THREE.TorusGeometry(92, 0.16, 8, 160), trackRailMat);
    trackOuter.rotation.x = Math.PI / 2;
    trackOuter.position.y = 0.12;
    this.worldGroup.add(trackInner, trackOuter);

    // Arcs emerging cleanly between Apple and Google signs
    const pPhone  = POS.phone.clone().setY(15);
    const pPost   = POS.post.clone().setY(10.5); // centered right between Apple and Google signs
    const pServer = POS.server.clone().setY(15);

    this.arcStoreToPhone  = new THREE.QuadraticBezierCurve3(pPost,   new THREE.Vector3(D + 4, 18, -6), pPhone);
    this.arcPhoneToPost   = new THREE.QuadraticBezierCurve3(pPhone,  new THREE.Vector3(10, 19, -6),    pPost);
    this.arcPostToPhone   = new THREE.QuadraticBezierCurve3(pPost,   new THREE.Vector3(D + 4, 18, -6), pPhone);
    this.arcPhoneToServer = new THREE.QuadraticBezierCurve3(pPhone,  new THREE.Vector3(0, 14, R + 8),  pServer);
    this.arcServerToPost  = new THREE.QuadraticBezierCurve3(pServer, new THREE.Vector3(-D - 4, 18, -6), pPost);
    this.arcPushWorldToPost = new THREE.QuadraticBezierCurve3(
      POS.ufo.clone().setY(72.5),
      new THREE.Vector3(-D * 0.5, 46, -D * 0.3),
      pPost.clone().setY(20)
    );

    this.setupCurves = [this.arcStoreToPhone, this.arcPhoneToPost, this.arcPhoneToServer];
    this.pushCurves  = [this.arcPushWorldToPost, this.arcPostToPhone];

    this.setupLines = [
      this.addArc(this.arcStoreToPhone,  0x38bdf8, 0.5,  this.normalGroup),
      this.addArc(this.arcPhoneToPost,   0xfbbf24, 0.45, this.normalGroup),
      this.addArc(this.arcPhoneToServer, 0xfbbf24, 0.45, this.normalGroup)
    ];
    this.pushLines = [
      this.addArc(this.arcPushWorldToPost, 0x34d399, 0.55, this.normalGroup),
      this.addArc(this.arcPostToPhone,     0x34d399, 0.55, this.normalGroup)
    ];

    // Multi-Stream World Outbound Stimulus Lines from Planet Earth -> Datacentre -> Post Office -> Phone
    this.initWorldStimStreams();

    // Setup lines use clean moving dotted lines (zero arrows/cones!)
    this.flowCones = [];

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
    const mat = new THREE.LineDashedMaterial({ color, dashSize: 1.5, gapSize: 1.5, transparent: true, opacity });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    parent.add(line);
    return line;
  }

  /* ---- 3D App Brand Logo Tile (Facebook, Instagram, X, Uber, Amazon, Candy Crush) ---- */
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
      // Candy Crush candy badge
      const grad = ctx.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0, '#f59e0b');
      grad.addColorStop(1, '#ec4899');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#ffffff';
      ctx.font = '135px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🍬', 128, 136);
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
      { id: 'pin-stim-0', brand: 'candycrush', color: 0xf59e0b, offset: 0.00,  spread: new THREE.Vector3(-8.0,  4.0, -6.0), mid1: new THREE.Vector3(-4.5,  3.0,  1.5), mid2: new THREE.Vector3( 0.0,  4.0, -3.5) },
      { id: 'pin-stim-1', brand: 'facebook',  color: 0x1877f2, offset: 0.166, spread: new THREE.Vector3( 8.0,  3.5, -5.0), mid1: new THREE.Vector3( 4.5,  2.0, -1.5), mid2: new THREE.Vector3( 0.0,  2.2,  3.5) },
      { id: 'pin-stim-2', brand: 'instagram', color: 0xec4899, offset: 0.333, spread: new THREE.Vector3(-7.0,  0.5,  7.0), mid1: new THREE.Vector3(-3.2,  0.0,  3.2), mid2: new THREE.Vector3( 0.0,  0.4, -2.2) },
      { id: 'pin-stim-3', brand: 'x',         color: 0xe2e8f0, offset: 0.500, spread: new THREE.Vector3( 7.0, -0.5,  7.0), mid1: new THREE.Vector3( 3.2, -1.2, -2.5), mid2: new THREE.Vector3( 0.0, -1.4,  2.5) },
      { id: 'pin-stim-4', brand: 'uber',      color: 0x34d399, offset: 0.666, spread: new THREE.Vector3(-6.0, -4.0, -4.5), mid1: new THREE.Vector3(-2.5, -2.8, -3.0), mid2: new THREE.Vector3( 0.0, -2.8, -1.5) },
      { id: 'pin-stim-5', brand: 'amazon',    color: 0xff9900, offset: 0.833, spread: new THREE.Vector3( 6.0, -4.5,  3.5), mid1: new THREE.Vector3( 2.5, -3.5,  2.8), mid2: new THREE.Vector3( 0.0, -4.0,  1.8) }
    ];

    const coneGeo = new THREE.ConeGeometry(0.75, 2.2, 8);
    coneGeo.rotateX(Math.PI / 2);

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

      // Train of 14 glowing data pulse particles flowing continuously along this curve
      const pulseCount = 14;
      const pGeo = new THREE.BufferGeometry();
      const pPos = new Float32Array(pulseCount * 3);
      pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      const pMat = new THREE.PointsMaterial({
        color: s.color,
        size: 1.4,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending
      });
      const pulses = new THREE.Points(pGeo, pMat);
      this.worldStimGroup.add(pulses);

      return { ...s, curve, line, orb, pulses, pulseCount, currentPos: pEarth.clone() };
    });
  }

  /* ---- 6 vibrant glossy 3D candies representing Candy Crush Saga ---- */
  createCandyCrushCluster(scale = 1) {
    const group = new THREE.Group();
    const specs = [
      // 1. Red Jelly Bean (smooth elongated capsule)
      { color: 0xef4444, emissive: 0xb91c1c, geo: new THREE.SphereGeometry(1.2, 24, 24), scale: [1.4, 0.88, 0.88], pos: [-2.8,  0.4,  0.6], rot: [0.2, 0.4,  0.15] },
      // 2. Yellow Lemon Drop (teardrop / rounded cone)
      { color: 0xfacc15, emissive: 0xca8a04, geo: new THREE.ConeGeometry(1.3, 2.4, 24),           scale: [1.0, 1.0, 1.0],   pos: [-1.4, -0.6, -1.1], rot: [0.1, 0.8, -0.25] },
      // 3. Green Chiclet (rounded square wrapped candy)
      { color: 0x22c55e, emissive: 0x15803d, geo: new THREE.BoxGeometry(1.8, 1.8, 0.85),          scale: [1.0, 1.0, 1.0],   pos: [ 0.0,  0.9,  0.0], rot: [0.1, 0.2,  0.0]  },
      // 4. Orange Lozenge (flat cylinder lozenge)
      { color: 0xf97316, emissive: 0xc2410c, geo: new THREE.CylinderGeometry(1.2, 1.2, 0.7, 24), scale: [1.0, 1.0, 1.0],   pos: [ 1.6, -0.5,  1.0], rot: [-0.2, 0.5, -0.15] },
      // 5. Purple Grape Candy (faceted jewel-cut candy)
      { color: 0xa855f7, emissive: 0x7e22ce, geo: new THREE.DodecahedronGeometry(1.3, 0),        scale: [1.0, 1.0, 1.0],   pos: [ 2.7,  0.5, -0.7], rot: [0.3, -0.4,  0.2]  },
      // 6. Blue Orb (glossy sphere lollipop candy)
      { color: 0x06b6d4, emissive: 0x0e7490, geo: new THREE.SphereGeometry(1.15, 24, 24),        scale: [1.0, 1.0, 1.0],   pos: [ 0.2, -1.2,  0.8], rot: [0.0, 0.0,  0.0]  }
    ];

    for (const s of specs) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: s.color, emissive: s.emissive, emissiveIntensity: 0.7,
        roughness: 0.08, metalness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.04, transmission: 0.12
      });
      const mesh = new THREE.Mesh(s.geo, mat);
      if (s.scale) mesh.scale.set(...s.scale);
      mesh.position.set(...s.pos);
      mesh.rotation.set(...s.rot);
      mesh.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(s.geo),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })
      ));
      group.add(mesh);
    }

    // Floating sugar crystal sparkle motes around the candies
    const motePts = [];
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.4 + Math.random() * 2.2;
      motePts.push(Math.cos(a) * r, (Math.random() - 0.5) * 4.2, Math.sin(a) * r);
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.Float32BufferAttribute(motePts, 3));
    group.add(new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.55, transparent: true, opacity: 0.85 })));

    // Warm golden-pink candy radiance
    group.add(new THREE.PointLight(0xf59e0b, 2.5, 24));
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

  /* ---- Single Sleek Cryptographic App Push Token Key (Clean & Minimalist) ---- */
  createSingleTokenKey(scale = 1) {
    const group = new THREE.Group();

    // 1. Sleek, solid cryptographic gold physical key
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.35,
      metalness: 0.92,
      roughness: 0.18
    });

    // Bow (circular ring head)
    const bow = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.42, 16, 32), goldMat);
    bow.position.set(0, 3.2, 0);

    // Inner glowing cyan cyber core disc
    const coreGeo = new THREE.CylinderGeometry(1.15, 1.15, 0.22, 24);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0284c7,
      emissiveIntensity: 0.85,
      metalness: 0.8,
      roughness: 0.2
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.rotation.x = Math.PI / 2;
    core.position.set(0, 3.2, 0);

    // Key shaft
    const shaftGeo = new THREE.BoxGeometry(0.72, 3.6, 0.42);
    const shaft = new THREE.Mesh(shaftGeo, goldMat);
    shaft.position.set(0, 1.0, 0);

    // Key bit teeth
    const bitGeo1 = new THREE.BoxGeometry(0.9, 0.6, 0.38);
    const bit1 = new THREE.Mesh(bitGeo1, goldMat);
    bit1.position.set(0.65, 0.2, 0);

    const bitGeo2 = new THREE.BoxGeometry(1.2, 0.6, 0.38);
    const bit2 = new THREE.Mesh(bitGeo2, goldMat);
    bit2.position.set(0.8, -0.6, 0);

    // Sleek cryptographic token hash plaque floating below the key
    const cvs = document.createElement('canvas');
    cvs.width = 384; cvs.height = 96;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 384, 96);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 380, 92);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔑 PUSH TOKEN #7A9F', 192, 48);

    const plaqueTex = new THREE.CanvasTexture(cvs);
    const plaqueMat = new THREE.MeshBasicMaterial({ map: plaqueTex, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), plaqueMat);
    plaque.position.set(0, -1.8, 0);

    const glow = new THREE.PointLight(0xf59e0b, 2.2, 20);
    glow.position.set(0, 1.5, 1.5);

    group.add(bow, core, shaft, bit1, bit2, plaque, glow);
    group.scale.setScalar(scale);
    return group;
  }

  // Backward compatibility alias for single token key
  createUniqueTokenTrio(scale = 1) {
    return this.createSingleTokenKey(scale);
  }

  /* ---- Industrial CNC Fiber Laser Key Fabrication Rig ---- */
  createLaserCutterForge() {
    const group = new THREE.Group();

    // 1. Heavy cast industrial CNC bed frame
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x111622, roughness: 0.65, metalness: 0.8
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 11), frameMat);
    frame.position.y = -0.6;
    group.add(frame);

    // Aluminum slat grid (underneath plate where sparks fall)
    const slatMat = new THREE.MeshStandardMaterial({
      color: 0x334155, roughness: 0.4, metalness: 0.9
    });
    const slatGeo = new THREE.BoxGeometry(14.8, 0.35, 0.12);
    for (let z = -4.5; z <= 4.5; z += 0.65) {
      const slat = new THREE.Mesh(slatGeo, slatMat);
      slat.position.set(0, -0.1, z);
      group.add(slat);
    }

    // Precision fixture clamps holding down sheet corners
    const clampMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, roughness: 0.35, metalness: 0.85
    });
    const clampGeo = new THREE.BoxGeometry(1.0, 0.3, 0.6);
    [[-6.2, 0.12, -3.8], [6.2, 0.12, -3.8], [-6.2, 0.12, 3.8], [6.2, 0.12, 3.8]].forEach(([x, y, z]) => {
      const cl = new THREE.Mesh(clampGeo, clampMat);
      cl.position.set(x, y, z);
      group.add(cl);
    });

    // The Raw Gold Sheet Blank sitting on the slats (0.22 unit thick)
    const sheetMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, roughness: 0.32, metalness: 0.88, envMapIntensity: 1.2
    });
    const rawSheet = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.22, 7.8), sheetMat);
    rawSheet.position.y = 0.0;
    group.add(rawSheet);

    // 2. High Bridge Rails across X and Z
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, roughness: 0.5, metalness: 0.85
    });
    const bridgeBeam = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.45, 0.6), railMat);
    bridgeBeam.position.set(0, 5.2, 0);
    group.add(bridgeBeam);

    // Optical Cutting Head Assembly
    const headAssembly = new THREE.Group();
    group.add(headAssembly);

    // Optical Head housing (machined gunmetal cylinder + cyan status ring)
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, roughness: 0.3, metalness: 0.95
    });
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 1.6, 24), headMat);
    housing.position.y = 1.8;
    headAssembly.add(housing);

    const statusRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.57, 0.57, 0.18, 24),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    statusRing.position.y = 1.95;
    headAssembly.add(statusRing);

    // Precision copper conical cutting nozzle
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0xb45309, roughness: 0.2, metalness: 0.95
    });
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 24), nozzleMat);
    nozzle.rotation.x = Math.PI; // point down
    nozzle.position.y = 0.75;
    headAssembly.add(nozzle);

    // Cutting Laser Beam (Vertical needle of intense cyan-white light from nozzle to plate)
    const beamGeo = new THREE.CylinderGeometry(0.03, 0.06, 0.75, 12);
    beamGeo.translate(0, -0.375, 0);
    const laserBeamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.95
    });
    const laserBeam = new THREE.Mesh(beamGeo, laserBeamMat);
    laserBeam.position.y = 0.75;
    headAssembly.add(laserBeam);

    // Beam Outer Glow Shroud
    const haloGeo = new THREE.CylinderGeometry(0.1, 0.28, 0.75, 12);
    haloGeo.translate(0, -0.375, 0);
    const beamHaloMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending
    });
    const beamHalo = new THREE.Mesh(haloGeo, beamHaloMat);
    beamHalo.position.y = 0.75;
    headAssembly.add(beamHalo);

    // Blinding focal cutting spot light
    const focalSpotLight = new THREE.PointLight(0x00f0ff, 8.0, 14);
    focalSpotLight.position.set(0, 0.1, 0);
    headAssembly.add(focalSpotLight);

    // Amber melt under-glow light
    const meltLight = new THREE.PointLight(0xff6600, 6.0, 8);
    meltLight.position.set(0, 0.08, 0);
    headAssembly.add(meltLight);

    // Molten puddle disc on sheet surface
    const puddleGeo = new THREE.CircleGeometry(0.35, 16);
    puddleGeo.rotateX(-Math.PI / 2);
    const moltenPuddle = new THREE.Mesh(
      puddleGeo,
      new THREE.MeshBasicMaterial({ color: 0xffedd5, transparent: true, opacity: 0.92 })
    );
    moltenPuddle.position.y = 0.14;
    group.add(moltenPuddle);

    // 3. Mathematical Key Contour Path (closed Catmull-Rom loop)
    const pts = [];
    const bowCenter = { x: -3.2, z: 0.0 };
    const bowRadius = 1.8;
    const bowArcStart = 0.42;
    const bowArcEnd = Math.PI * 2 - 0.42;
    for (let i = 0; i <= 30; i++) {
      const a = bowArcStart + (i / 30) * (bowArcEnd - bowArcStart);
      pts.push(new THREE.Vector3(
        bowCenter.x + Math.cos(a) * bowRadius,
        0.14,
        bowCenter.z + Math.sin(a) * bowRadius
      ));
    }
    pts.push(new THREE.Vector3(-1.4, 0.14, -0.5));
    pts.push(new THREE.Vector3(-0.9, 0.14, -0.5));
    pts.push(new THREE.Vector3(-0.3, 0.14, -0.5));
    pts.push(new THREE.Vector3(-0.15, 0.14, -1.05));
    pts.push(new THREE.Vector3( 0.35, 0.14, -1.05));
    pts.push(new THREE.Vector3( 0.5,  0.14, -0.5));
    pts.push(new THREE.Vector3( 0.9,  0.14, -0.5));
    pts.push(new THREE.Vector3( 1.05, 0.14, -1.35));
    pts.push(new THREE.Vector3( 1.55, 0.14, -1.35));
    pts.push(new THREE.Vector3( 1.7,  0.14, -0.5));
    pts.push(new THREE.Vector3( 2.1,  0.14, -0.5));
    pts.push(new THREE.Vector3( 2.25, 0.14, -0.95));
    pts.push(new THREE.Vector3( 2.75, 0.14, -0.95));
    pts.push(new THREE.Vector3( 2.9,  0.14, -0.5));
    pts.push(new THREE.Vector3( 3.4,  0.14, -0.5));
    pts.push(new THREE.Vector3( 3.8,  0.14, -0.25));
    pts.push(new THREE.Vector3( 3.95, 0.14,  0.0));
    pts.push(new THREE.Vector3( 3.8,  0.14,  0.42));
    pts.push(new THREE.Vector3(-0.9,  0.14,  0.42));
    pts.push(new THREE.Vector3(-1.4,  0.14,  0.5));
    pts.push(new THREE.Vector3(
      bowCenter.x + Math.cos(bowArcStart) * bowRadius,
      0.14,
      bowCenter.z + Math.sin(bowArcStart) * bowRadius
    ));

    const cutCurve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.15);

    // 4. Dynamic Kerf Seam Line with vertex coloring
    const maxKerfPts = 300;
    const kerfPositions = new Float32Array(maxKerfPts * 3);
    const kerfColors = new Float32Array(maxKerfPts * 3);
    const kerfGeo = new THREE.BufferGeometry();
    kerfGeo.setAttribute('position', new THREE.BufferAttribute(kerfPositions, 3));
    kerfGeo.setAttribute('color', new THREE.BufferAttribute(kerfColors, 3));
    const kerfLine = new THREE.Line(
      kerfGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2 })
    );
    group.add(kerfLine);

    // 5. Physics Sparks Particle System
    const sparkCount = 60;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkCol = new Float32Array(sparkCount * 3);
    const sparksData = [];
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3 + 1] = -100;
      sparkCol[i * 3]     = 1.0;
      sparkCol[i * 3 + 1] = 0.85;
      sparkCol[i * 3 + 2] = 0.3;
      sparksData.push({
        pos: new THREE.Vector3(0, -100, 0),
        vel: new THREE.Vector3(),
        life: 1.0,
        maxLife: 0.25
      });
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
    const sparkPoints = new THREE.Points(
      sparkGeo,
      new THREE.PointsMaterial({
        size: 0.35, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending
      })
    );
    group.add(sparkPoints);

    // Dynamic Handles
    this.laserCutterData = {
      bridgeBeam,
      headAssembly,
      laserBeam,
      beamHalo,
      focalSpotLight,
      meltLight,
      moltenPuddle,
      cutCurve,
      maxKerfPts,
      kerfLine,
      sparkCount,
      sparkPoints,
      sparksData,
      lastTime: performance.now()
    };

    return group;
  }

  createKeyMaterializer() {
    return this.createLaserCutterForge();
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

  /* ---- Iconic 3D Paper Shopping Bag (Apple / Google App Store Package) ---- */
  createShoppingBag(scale = 1.0) {
    const group = new THREE.Group();
    group.userData.stationKey = 'post';

    // 1. Sleek paper bag body (crisp Apple/Google boutique paper bag)
    const bagW = 4.0, bagH = 4.8, bagD = 2.4;
    const bagGeo = new THREE.BoxGeometry(bagW, bagH, bagD);
    const bagMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.32,
      metalness: 0.06
    });
    const bagBody = new THREE.Mesh(bagGeo, bagMat);
    bagBody.position.y = bagH / 2;
    bagBody.castShadow = true;
    bagBody.receiveShadow = true;
    group.add(bagBody);

    // Subtle edge crease outlines for folded paper boutique bag look
    const edgeGeo = new THREE.EdgesGeometry(bagGeo);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.45
    });
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    edges.position.y = bagH / 2;
    group.add(edges);

    // 2. Top folded collar rim
    const collarGeo = new THREE.BoxGeometry(bagW + 0.16, 0.42, bagD + 0.16);
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.28,
      metalness: 0.08
    });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.position.y = bagH - 0.21;
    group.add(collar);

    // 3. Top interior cavity (dark recessed opening so bag looks open)
    const cavityGeo = new THREE.PlaneGeometry(bagW - 0.2, bagD - 0.2);
    const cavityMat = new THREE.MeshBasicMaterial({ color: 0x0f172a, side: THREE.DoubleSide });
    const cavity = new THREE.Mesh(cavityGeo, cavityMat);
    cavity.rotation.x = Math.PI / 2;
    cavity.position.y = bagH - 0.05;
    group.add(cavity);

    // 4. Two elegant arched braided cord handles on front and back
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Vibrant tech cyan-blue cord
      roughness: 0.45,
      metalness: 0.15
    });
    const handleGeo = new THREE.TorusGeometry(0.95, 0.12, 10, 32, Math.PI);

    // Front handle
    const handleFront = new THREE.Mesh(handleGeo, handleMat);
    handleFront.position.set(0, bagH - 0.1, bagD / 2 + 0.06);
    group.add(handleFront);

    // Back handle
    const handleBack = new THREE.Mesh(handleGeo, handleMat);
    handleBack.position.set(0, bagH - 0.1, -bagD / 2 - 0.06);
    group.add(handleBack);

    // Metal eyelet grommets where handles enter the bag
    const eyeletGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 16);
    const eyeletMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.85, roughness: 0.2 });
    eyeletGeo.rotateX(Math.PI / 2);
    const eyeletOffsets = [
      [-0.95, bagH - 0.1, bagD / 2 + 0.08],
      [ 0.95, bagH - 0.1, bagD / 2 + 0.08],
      [-0.95, bagH - 0.1, -bagD / 2 - 0.08],
      [ 0.95, bagH - 0.1, -bagD / 2 - 0.08]
    ];
    for (const [ex, ey, ez] of eyeletOffsets) {
      const eyelet = new THREE.Mesh(eyeletGeo, eyeletMat);
      eyelet.position.set(ex, ey, ez);
      group.add(eyelet);
    }

    // 5. Sleek embossed Store Emblem badge on the front face
    const badgeCvs = document.createElement('canvas');
    badgeCvs.width = 256;
    badgeCvs.height = 256;
    const bctx = badgeCvs.getContext('2d');
    bctx.fillStyle = '#ffffff';
    bctx.beginPath();
    bctx.arc(128, 128, 116, 0, Math.PI * 2);
    bctx.fill();
    bctx.fillStyle = '#0284c7';
    bctx.font = '76px sans-serif';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText('🛍️', 128, 128);

    const badgeTex = new THREE.CanvasTexture(badgeCvs);
    badgeTex.colorSpace = THREE.SRGBColorSpace;
    const badgeGeo = new THREE.PlaneGeometry(1.6, 1.6);
    const badgeMat = new THREE.MeshBasicMaterial({
      map: badgeTex,
      transparent: true,
      side: THREE.DoubleSide
    });
    const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
    badgeMesh.position.set(0, bagH * 0.52, bagD / 2 + 0.03);
    group.add(badgeMesh);

    // Subtle internal point light radiating from inside the bag
    const bagLight = new THREE.PointLight(0x38bdf8, 1.8, 22);
    bagLight.position.set(0, bagH, 0);
    group.add(bagLight);

    group.scale.setScalar(scale);
    group.visible = false;
    return group;
  }

  initMovers() {
    // 0. 3D Shopping Bag at Apple & Google station (changes into Candy Crush 3D candies)
    this.shoppingBag = this.createShoppingBag(1.0);
    this.normalGroup.add(this.shoppingBag);

    // 1. Candy Crush app travelling App Stores -> Phone
    this.appOrb = this.createCandyCrushCluster(1.2);
    this.normalGroup.add(this.appOrb);

    // 2. Installed Candy Crush hovering above the Phone
    this.installedApp = this.createCandyCrushCluster(0.85);
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

  /* ---- Dynamic Phone Screen Canvas (Interactive iOS vs Android + Candy Crush) ---- */
  updatePhoneScreenCanvas(state = 'awake', notifProgress = 0, customNotif = null) {
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
        // iOS Home Screen / Active State with Candy Crush App
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

        // Candy Crush highlighted app icon
        const bjX = 86, bjY = 220;
        const bGrad = ctx.createLinearGradient(bjX, bjY, bjX + 88, bjY + 88);
        bGrad.addColorStop(0, '#f59e0b');
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
        ctx.fillText('🍬', bjX + 44, bjY + 62);
        ctx.font = 'bold 15px -apple-system, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Candy Crush', bjX + 44, bjY + 114);

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
          ctx.strokeStyle = customNotif?.color || 'rgba(245, 158, 11, 0.75)';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.textAlign = 'left';
          ctx.fillStyle = customNotif?.color || '#f59e0b';
          ctx.font = 'bold 17px -apple-system, sans-serif';
          ctx.fillText(customNotif ? `${customNotif.emoji} ${customNotif.name.toUpperCase()} · now` : '🍬 CANDY CRUSH · now', 56, bannerY + 36);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px -apple-system, sans-serif';
          ctx.fillText(customNotif ? customNotif.title : 'Lives Full! Play Now 🍬', 56, bannerY + 68);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '16px -apple-system, sans-serif';
          ctx.fillText(customNotif ? customNotif.body : 'Your 5 lives have refilled. Tap to crush candies!', 56, bannerY + 98);
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
        // Android Material You Home Screen with Candy Crush Saga
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

        // Candy Crush circular adaptive icon
        const bjX = 86, bjY = 220;
        const bGrad = ctx.createLinearGradient(bjX, bjY, bjX + 84, bjY + 84);
        bGrad.addColorStop(0, '#f59e0b');
        bGrad.addColorStop(1, '#ec4899');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(bjX + 44, bjY + 44, 44, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.font = '48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🍬', bjX + 44, bjY + 60);
        ctx.font = 'bold 15px Roboto, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Candy Crush', bjX + 44, bjY + 114);

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
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('G', 76, 934);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '18px Roboto, sans-serif';
        ctx.fillText('Search apps & web…', 116, 933);

        // If push notification is triggered / arrived:
        if (notifProgress > 0) {
          const bannerY = 110 + (1 - Math.pow(1 - notifProgress, 3)) * 20;
          ctx.fillStyle = '#261b0f';
          ctx.beginPath();
          ctx.roundRect(32, bannerY, 448, 126, 24);
          ctx.fill();
          ctx.strokeStyle = customNotif?.color || '#f59e0b';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.textAlign = 'left';
          ctx.fillStyle = customNotif?.color || '#f59e0b';
          ctx.font = 'bold 17px Roboto, sans-serif';
          ctx.fillText(customNotif ? `${customNotif.emoji} ${customNotif.name} · FCM` : '🍬 Candy Crush Saga · Firebase FCM', 56, bannerY + 36);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px Roboto, sans-serif';
          ctx.fillText(customNotif ? customNotif.title : 'Lives Full! Play Now 🍬', 56, bannerY + 68);

          ctx.fillStyle = '#fcd34d';
          ctx.font = '16px Roboto, sans-serif';
          ctx.fillText(customNotif ? customNotif.body : 'Your 5 lives have refilled. Tap to crush candies!', 56, bannerY + 98);
        }
        ctx.textAlign = 'left';
      }
    }

    if (this.phoneTex) this.phoneTex.needsUpdate = true;
  }

  /* ---- Interactive Camera Snap & Rule-of-Thirds Composition on GLB Click ---- */
  snapFocusToNode(key) {
    let stationPos = null;
    let camPos = null;

    if (key === 'phone') {
      // Phone is at POS.phone (D, 0, D), rotated -45 deg. Screen faces into room.
      stationPos = new THREE.Vector3(POS.phone.x, 12.0, POS.phone.z);
      camPos = new THREE.Vector3(POS.phone.x + 20, 13.5, POS.phone.z + 20);
    } else if (key === 'server') {
      // Datacentre server rack is at POS.server (-D, 0, D), rotated +45 deg.
      stationPos = new THREE.Vector3(POS.server.x, 12.5, POS.server.z);
      camPos = new THREE.Vector3(POS.server.x + 22, 14.5, POS.server.z + 22);
    } else if (key === 'post' || key === 'store') {
      // Apple and Google platform is at POS.post (0, 0, -R).
      stationPos = new THREE.Vector3(POS.post.x, 12.0, POS.post.z);
      camPos = new THREE.Vector3(POS.post.x, 15.0, POS.post.z + 32);
    } else if (key === 'world' || key === 'ufo') {
      // Planet Earth hovering above at POS.ufo (-D, 50, D).
      stationPos = new THREE.Vector3(POS.ufo.x, POS.ufo.y, POS.ufo.z);
      camPos = new THREE.Vector3(POS.ufo.x + 22, POS.ufo.y + 4, POS.ufo.z + 36);
    } else if (key === 'bandit') {
      // Eye-level Rule-of-Thirds framing on suspect at laptop
      stationPos = new THREE.Vector3(this.leoPos.bandit.x, 18.0, this.leoPos.bandit.z);
      camPos = new THREE.Vector3(this.leoPos.bandit.x + 18.0, 24.0, this.leoPos.bandit.z + 12.0);
    } else if (key === 'swat' || key === 'police' || key === 'osint') {
      // RCMP "E" Division Headquarters centerpiece at Green Timbers Front Entrance Threshold
      stationPos = new THREE.Vector3(this.leoPos.swat.x, 7.5, this.leoPos.swat.z + 8.5);
      camPos = new THREE.Vector3(this.leoPos.swat.x + 22, 18.0, this.leoPos.swat.z + 32);
    } else if (key === 'proton') {
      // Swiss Server & waving Swiss flag facing outward (-X, -Z). Eye-level view of illuminated front & waving flag from outside!
      stationPos = new THREE.Vector3(this.leoPos.proton.x, 18.0, this.leoPos.proton.z);
      camPos = new THREE.Vector3(this.leoPos.proton.x - 30.0, 22.0, this.leoPos.proton.z - 30.0);
    } else if (key === 'facebook' || key === 'bot') {
      // App Servers in LEO mode
      stationPos = new THREE.Vector3(this.leoPos.bot.x, 13.0, this.leoPos.bot.z);
      camPos = new THREE.Vector3(this.leoPos.bot.x - 22, 15.0, this.leoPos.bot.z + 22);
    } else if (key === 'ag') {
      // Apple & Google HQ in LEO mode
      stationPos = new THREE.Vector3(this.leoPos.ag.x, 20.0, this.leoPos.ag.z);
      camPos = new THREE.Vector3(this.leoPos.ag.x + 22, 22.0, this.leoPos.ag.z + 28);
    }

    if (!stationPos || !camPos) return;

    // Rule of Thirds camera composition:
    // Offset camera look target horizontally so target station sits along x = 1/3 or 2/3 line in the viewport
    const isLeftSide = stationPos.x < 0;
    const viewDir = stationPos.clone().sub(camPos);
    const dist = viewDir.length();
    const forward = viewDir.clone().normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
    const camUp = new THREE.Vector3().crossVectors(right, forward).normalize();

    const tanHalfFov = Math.tan((42 * Math.PI) / 360);
    const halfH = dist * tanHalfFov;
    const aspect = (this.camera && this.camera.aspect) || (window.innerWidth / window.innerHeight);
    const halfW = halfH * aspect;

    // Shift look-target horizontally & vertically so station projects along 1/3 or 2/3 Rule-of-Thirds guidelines
    const sign = isLeftSide ? 1 : -1;
    const offsetX = sign * (halfW * 0.333);
    const offsetY = -halfH * 0.22;

    const target = stationPos.clone()
      .addScaledVector(right, offsetX)
      .addScaledVector(camUp, offsetY);

    this.focusedNode = key;
    this.setPlaying(false); // Pause auto-playback so camera stays cleanly locked on clicked station!
    this.cinematicFollow = false;
    this.setAutoOrbit(false);

    // Transform local coordinates into WORLD SPACE (vital in LEO mode where worldPivot flips 180 deg around Z!)
    const activeGroup = this.mode === 'leo' ? this.leoGroup : this.normalGroup;
    activeGroup.updateMatrixWorld(true);
    const worldTarget = target.clone().applyMatrix4(activeGroup.matrixWorld);
    const worldCam = camPos.clone().applyMatrix4(activeGroup.matrixWorld);

    this.focusTargetPos = worldTarget;
    this.focusCamPos = worldCam;

    // Shallow depth-of-field focal spotlight (keep hacker dark until ID'ed at t >= 0.94!)
    const isBanditDark = (key === 'bandit' && (!this.t || this.t < 0.94));
    if (!this.focusSpot) {
      this.focusSpot = new THREE.SpotLight(0xffffff, 4.5, 95, Math.PI / 4, 0.4, 1.2);
      this.scene.add(this.focusSpot);
      this.scene.add(this.focusSpot.target);
    }
    if (isBanditDark) {
      this.focusSpot.visible = false;
    } else {
      this.focusSpot.visible = true;
      this.focusSpot.target.position.copy(worldTarget);
      this.focusSpot.position.copy(worldTarget).add(new THREE.Vector3(0, 32, 18));
    }
  }

  resetFocus() {
    this.focusedNode = null;
    this.focusTargetPos = null;
    this.focusCamPos = null;
    if (this.focusSpot) this.focusSpot.visible = false;
  }

  toggleCameraLock() {
    this.setCameraUnlocked(!this.cameraUnlocked);
  }

  setCameraUnlocked(unlocked) {
    this.cameraUnlocked = !!unlocked;
    if (this.cameraUnlocked) {
      // Disengage all camera snaps and automatic dolly/pan tracking immediately
      this.cinematicFollow = false;
      this.focusCamPos = null;
      this.focusTargetPos = null;
      this.setAutoOrbit(false);
      if (this.cameraRig) this.cameraRig.disengage();
      if (this.focusSpot) this.focusSpot.visible = false;
    } else {
      this.cinematicFollow = true;
      if (this.cameraRig) this.cameraRig.engage(this.camera, this.controls.target);
    }
    const btn = document.getElementById('btn-cam-lock');
    if (btn) {
      btn.classList.toggle('unlocked', this.cameraUnlocked);
      btn.classList.toggle('locked', !this.cameraUnlocked);
      btn.innerHTML = this.cameraUnlocked ? '🔓 Free Cam' : '🔒 Snap';
      btn.title = this.cameraUnlocked
        ? 'Camera Unlocked (C) · Click anywhere to step forward without camera snap'
        : 'Camera Snap ON (C) · Snaps camera to active step or clicked node';
    }
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

    // 2. High-res dynamic canvas texture on front face of the payload (1024x512, zero mipmap blur)
    this.payloadCvs = document.createElement('canvas');
    this.payloadCvs.width = 1024;
    this.payloadCvs.height = 512;
    this.payloadTex = new THREE.CanvasTexture(this.payloadCvs);
    this.payloadTex.colorSpace = THREE.SRGBColorSpace;
    this.payloadTex.minFilter = THREE.LinearFilter;
    this.payloadTex.magFilter = THREE.LinearFilter;
    this.payloadTex.generateMipmaps = false;
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

    // 3. Single sleek Golden Device Token Key docked cleanly beside the payload card
    this.pushOrbKey = this.createTokenKey(0.72);
    this.pushOrbKey.position.set(-cardW * 0.5 - 2.8, 0, 0);
    this.pushOrbKey.rotation.z = Math.PI * 0.5;
    group.add(this.pushOrbKey);

    group.add(new THREE.PointLight(0x34d399, 3.0, 28));
    return group;
  }

  updatePayloadCanvas() {
    if (!this.payloadCvs) return;
    const ctx = this.payloadCvs.getContext('2d');
    ctx.clearRect(0, 0, 1024, 512);

    const isIos = this.currentOS === 'ios';

    // Sleek frosted glass dark card with vibrant cyan/emerald border
    const bg = ctx.createLinearGradient(0, 0, 1024, 512);
    bg.addColorStop(0, '#07101e');
    bg.addColorStop(0.5, '#0b1f2e');
    bg.addColorStop(1, '#050c18');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(24, 24, 976, 464, 40);
    ctx.fill();

    ctx.strokeStyle = isIos ? 'rgba(56, 189, 248, 0.9)' : 'rgba(52, 211, 153, 0.9)';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Large glowing Golden Bell Icon on left
    ctx.save();
    ctx.font = '160px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 32;
    ctx.fillText('🔔', 170, 256);
    ctx.restore();

    // Subtle vertical separator
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(290, 60); ctx.lineTo(290, 452);
    ctx.stroke();

    // Two clean lines: Zero truncation, generous margins on all sides!
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px "Space Grotesk", sans-serif';
    ctx.fillText('Push Notification', 335, 205);

    ctx.fillStyle = isIos ? '#f59e0b' : '#34d399';
    ctx.font = '700 36px "Space Grotesk", sans-serif';
    ctx.fillText('from Candy Crush 🍬', 335, 285);

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
    this.dcGroup.userData.stationKey = 'server';
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
      mainTower.userData.stationKey = 'server';
      mainTower.traverse(c => { if (c.isMesh) c.userData.stationKey = 'server'; });
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
        this.leoDcMirror.userData.stationKey = 'facebook';
        this.leoDcMirror.traverse(c => { if (c.isMesh) c.userData.stationKey = 'facebook'; });
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

  /* ---- Dedicated Illuminated Switzerland Server Station with Blinking LEDs and Waving Swiss Flag ON TOP ---- */
  createSwissServerStation() {
    const group = new THREE.Group();

    // 1. Plinth base
    const floorY = 0.8;
    const padW = 12.0;
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(padW, floorY, padW),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.25 })
    );
    pad.position.set(0, floorY / 2, 0);
    pad.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(pad.geometry),
      new THREE.LineBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.75 })
    ));
    group.add(pad);

    // 2. Server Tower Chassis
    const TOWER_H = 22.0;
    const TOWER_W = 8.6;
    const TOWER_D = 8.6;
    const bodyGeo = new THREE.BoxGeometry(TOWER_W, TOWER_H, TOWER_D);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x111827, metalness: 0.82, roughness: 0.32
    });
    const towerBody = new THREE.Mesh(bodyGeo, bodyMat);
    towerBody.position.set(0, floorY + TOWER_H / 2, 0);
    towerBody.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(bodyGeo),
      new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.55 })
    ));
    group.add(towerBody);

    // Front Glass Door
    const frontFaceZ = TOWER_D / 2 + 0.16;
    const doorGeo = new THREE.BoxGeometry(TOWER_W * 0.88, TOWER_H * 0.92, 0.14);
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x180f24, transparent: true, opacity: 0.82, roughness: 0.12, metalness: 0.85
    });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, floorY + TOWER_H / 2, frontFaceZ);
    group.add(door);

    // Illuminated Header Banner: "🇨🇭 PROTON · SWITZERLAND"
    const headCvs = document.createElement('canvas');
    headCvs.width = 1024; headCvs.height = 256;
    const hCtx = headCvs.getContext('2d');
    hCtx.fillStyle = '#4c1d95'; hCtx.fillRect(0, 0, 1024, 256);
    hCtx.fillStyle = '#ffffff'; hCtx.font = '900 64px sans-serif';
    hCtx.textAlign = 'center'; hCtx.textBaseline = 'middle';
    hCtx.fillText('🇨🇭 PROTON · SWITZERLAND', 512, 128);
    const headTex = new THREE.CanvasTexture(headCvs);
    headTex.minFilter = THREE.LinearFilter;
    headTex.generateMipmaps = false;
    const headPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(TOWER_W * 0.84, 2.2),
      new THREE.MeshBasicMaterial({ map: headTex })
    );
    headPlaque.position.set(0, floorY + TOWER_H - 1.5, frontFaceZ + 0.1);
    group.add(headPlaque);

    // Animated vertical laser-telemetry scan bar
    const scanBar = new THREE.Mesh(
      new THREE.BoxGeometry(TOWER_W * 0.72, 0.28, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.92 })
    );
    scanBar.position.set(0, floorY + TOWER_H * 0.5, frontFaceZ + 0.08);
    group.add(scanBar);
    this.swissScanBar = scanBar;

    // Blinking Server Blade LEDs on front bezel
    this.swissLeds = [];
    const ledGeo = new THREE.BoxGeometry(0.32, 0.22, 0.12);
    const palette = [0x8b5cf6, 0xd946ef, 0xef4444, 0x06b6d4, 0xf43f5e];
    const ledX = TOWER_W * 0.32;
    for (let row = 0; row < 10; row++) {
      const hex = palette[row % palette.length];
      const mat = new THREE.MeshBasicMaterial({ color: hex });
      const led = new THREE.Mesh(ledGeo, mat);
      led.position.set(
        ledX,
        floorY + 2.5 + row * ((TOWER_H - 5.5) / 9),
        frontFaceZ + 0.08
      );
      group.add(led);
      this.swissLeds.push({
        mesh: led,
        mat,
        speed: 4 + ((row * 2) % 7),
        phase: row * 1.3
      });
    }

    // 3. Waving 3D Swiss Flag Mounted Firmly ON TOP of the Server Rack!
    const roofY = floorY + TOWER_H;
    const poleBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.9, 0.8, 16),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 })
    );
    poleBase.position.set(-2.8, roofY + 0.4, 0);
    group.add(poleBase);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.36, 18, 16),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.18 })
    );
    pole.position.set(-2.8, roofY + 9.0, 0);
    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.95, roughness: 0.15 })
    );
    finial.position.set(-2.8, roofY + 18.2, 0);
    group.add(pole, finial);

    // High-res Swiss Flag (crisp red square + white cross)
    const fCvs = document.createElement('canvas');
    fCvs.width = 1024; fCvs.height = 1024;
    const fCtx = fCvs.getContext('2d');
    fCtx.fillStyle = '#dc2626';
    fCtx.fillRect(0, 0, 1024, 1024);
    fCtx.fillStyle = '#ffffff';
    fCtx.fillRect(416, 192, 192, 640);
    fCtx.fillRect(192, 416, 640, 192);
    const fTex = new THREE.CanvasTexture(fCvs);
    fTex.colorSpace = THREE.SRGBColorSpace;
    fTex.minFilter = THREE.LinearFilter;
    fTex.magFilter = THREE.LinearFilter;
    fTex.generateMipmaps = false;

    const flagGeo = new THREE.PlaneGeometry(12, 12, 24, 16);
    const flagMat = new THREE.MeshStandardMaterial({
      map: fTex, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.05
    });
    this.swissFlagMesh = new THREE.Mesh(flagGeo, flagMat);
    this.swissFlagMesh.position.set(3.2, roofY + 11.5, 0);
    this.swissFlagBase = Float32Array.from(flagGeo.attributes.position.array);
    group.add(this.swissFlagMesh);

    // Glowing illumination
    this.swissServerLight = new THREE.PointLight(0xa855f7, 2.8, 38);
    this.swissServerLight.position.set(0, floorY + TOWER_H * 0.5, frontFaceZ + 6);
    group.add(this.swissServerLight);

    group.userData.stationKey = 'proton';
    group.traverse(c => { if (c.isMesh) c.userData.stationKey = 'proton'; });

    return group;
  }

  create3DPhotoIdCard(scale = 1) {
    // High-res Canadian Law Enforcement Hardware-Matched Photo ID Record
    const cvs = document.createElement('canvas');
    cvs.width = 512; cvs.height = 320;
    const ctx = cvs.getContext('2d');

    // Card base gradient
    const bg = ctx.createLinearGradient(0, 0, 512, 320);
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(0.5, '#1e293b');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 320);

    // Top header band (Royal Canadian Mounted Police / Gov of Canada Identity Record)
    const hGrad = ctx.createLinearGradient(0, 0, 512, 0);
    hGrad.addColorStop(0, '#1e3a8a');
    hGrad.addColorStop(0.6, '#0284c7');
    hGrad.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, 512, 56);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(0, 52, 512, 4);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Space Grotesk", sans-serif';
    ctx.fillText('🇨🇦 CANADA · SUBSCRIBER IDENTITY RECORD', 16, 35);

    // Portrait frame background
    const px = 20, py = 72, pw = 130, ph = 165;
    ctx.fillStyle = '#060a14';
    ctx.fillRect(px, py, pw, ph);

    // Draw authentic Hacker Mugshot
    ctx.save();
    const cx = px + pw / 2;
    // Dark hoodie drape over shoulders
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(cx, py + 180, 60, Math.PI, 0);
    ctx.fill();

    // Dark hoodie hood arch around head
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(cx, py + 72, 40, 52, 0, 0, Math.PI * 2);
    ctx.fill();

    // Suspect face within hood
    ctx.fillStyle = '#d4a373';
    ctx.beginPath();
    ctx.ellipse(cx, py + 76, 26, 34, 0, 0, Math.PI * 2);
    ctx.fill();

    // Messy dark hair bangs protruding from hood
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.moveTo(cx - 24, py + 56);
    ctx.lineTo(cx - 10, py + 68);
    ctx.lineTo(cx + 2, py + 58);
    ctx.lineTo(cx + 14, py + 69);
    ctx.lineTo(cx + 24, py + 58);
    ctx.lineTo(cx + 20, py + 50);
    ctx.lineTo(cx - 20, py + 50);
    ctx.closePath();
    ctx.fill();

    // Natural facial features matching hacker model (clean dark silhouette / mugshot)
    ctx.fillStyle = '#1e293b';
    // Brow & Eyes
    ctx.fillRect(cx - 18, py + 72, 10, 4);
    ctx.fillRect(cx + 8, py + 72, 10, 4);
    // Nose bridge
    ctx.fillRect(cx - 2, py + 74, 4, 12);
    // Mouth
    ctx.fillRect(cx - 10, py + 92, 20, 3);
    ctx.restore();

    // Portrait frame cyan border
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(px, py, pw, ph);

    // Subscriber details
    ctx.textAlign = 'left';
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.fillText('HARDWARE MATCH CONFIRMED (100%)', 168, 88);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px "Space Grotesk", sans-serif';
    ctx.fillText('MALONE, CONNOR J.', 168, 118);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillText('DOB:   1996-08-14 (AGE 30)', 168, 142);
    ctx.fillText('ALIAS: badguy@proton.me', 168, 164);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.fillText('ADDR:  1042 ROBSON ST, VANCOUVER BC', 168, 188);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillText('DEVICE: iPhone 15 Pro & Pixel 8', 168, 210);
    ctx.fillText('TOKENS: APNs #7A9F-FB01 / FCM #3E1B', 168, 230);

    // Verification barcode at bottom
    ctx.fillStyle = '#ffffff';
    for (let x = 20; x < 492; x += 5) {
      const w = ((x * 17) % 4) + 1;
      ctx.fillRect(x, 260, w, 38);
    }
    ctx.fillStyle = '#64748b';
    ctx.font = '11px monospace';
    ctx.fillText('RCMP FORENSIC TOKEN VERIFICATION · PRODUCTION ORDER APNs/FCM-2026', 20, 310);

    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.85, roughness: 0.2 });
    const faceMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.22, metalness: 0.15, clearcoat: 1.0 });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 6.0, 0.3),
      [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, faceMat]
    );

    const group = new THREE.Group();
    group.name = 'idCard';
    group.add(mesh);

    // 3D Miniature Headshot Bust anchor for Hacker's Head from hack.glb
    const headBustWrap = new THREE.Group();
    headBustWrap.name = 'headBustWrap';
    headBustWrap.position.set(-3.20, 0.10, 0.18);
    group.add(headBustWrap);

    group.scale.setScalar(scale);
    return group;
  }

  /* ---- 3D Sleek Titanium Credit Card (Object 1 of 3 for Suspect ID Reveal) ---- */
  create3DCreditCard(scale = 1) {
    const group = new THREE.Group();
    group.name = 'creditCard';

    const cvs = document.createElement('canvas');
    cvs.width = 512; cvs.height = 320;
    const ctx = cvs.getContext('2d');

    // Deep matte obsidian / navy titanium card base
    const bg = ctx.createLinearGradient(0, 0, 512, 320);
    bg.addColorStop(0, '#0a0f1d');
    bg.addColorStop(0.5, '#151f33');
    bg.addColorStop(1, '#0a0f1d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 320);

    // Subtle holographic wave pattern
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.lineWidth = 1.5;
    for (let y = 30; y < 320; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(170, y - 15, 340, y + 15, 512, y);
      ctx.stroke();
    }

    // Top gold/cyan accent band
    const bGrad = ctx.createLinearGradient(0, 0, 512, 0);
    bGrad.addColorStop(0, '#f59e0b');
    bGrad.addColorStop(0.5, '#38bdf8');
    bGrad.addColorStop(1, '#ec4899');
    ctx.fillStyle = bGrad;
    ctx.fillRect(0, 0, 512, 6);

    // Bank Title at top
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🇨🇦 ROYAL CANADIAN BANK', 24, 38);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText('TITANIUM INFINITE PREFERRED', 24, 54);

    // Gold Metallic EMV Contact Chip
    const cx = 58, cy = 96, cw = 72, ch = 54;
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.roundRect(cx, cy, cw, ch, 8);
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Chip contact grid lines
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 27); ctx.lineTo(cx + cw, cy + 27);
    ctx.moveTo(cx + 24, cy); ctx.lineTo(cx + 24, cy + ch);
    ctx.moveTo(cx + 48, cy); ctx.lineTo(cx + 48, cy + ch);
    ctx.stroke();

    // Contactless NFC Wave Symbol
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    for (let r = 10; r <= 22; r += 6) {
      ctx.beginPath();
      ctx.arc(cx + cw + 24, cy + 27, r, -Math.PI * 0.35, Math.PI * 0.35);
      ctx.stroke();
    }

    // Embossed Card Number (Matching registered subscriber tokens!)
    ctx.textAlign = 'left';
    ctx.font = '900 22px "JetBrains Mono", monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 4;
    ctx.fillText('4520  ••••  ••••  4092', 40, 206);
    ctx.shadowBlur = 0;

    // Valid Thru & Security Hash
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('GOOD THRU: 08/28', 40, 234);
    ctx.fillText('CARD ID: #7A9F-MC', 240, 234);

    // Cardholder Name (Matching suspect and ID card!)
    ctx.font = '900 18px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CONNOR J. MALONE', 40, 268);

    // Visa / Mastercard Holographic Logo in bottom-right corner
    ctx.beginPath();
    ctx.arc(430, 260, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(458, 260, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
    ctx.fill();

    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;

    // Physical Card Mesh
    const cardGeo = new THREE.BoxGeometry(6.4, 4.0, 0.12);
    const cardMat = new THREE.MeshStandardMaterial({
      map: tex,
      metalness: 0.35,
      roughness: 0.28
    });
    const cardMesh = new THREE.Mesh(cardGeo, cardMat);
    group.add(cardMesh);
    group.scale.setScalar(scale);
    return group;
  }

  /* ---- 3D House Address Plaque for Front Yard ---- */
  createHouseAddressPlaque() {
    const group = new THREE.Group();
    group.name = 'houseAddressPlaque';

    const cvs = document.createElement('canvas');
    cvs.width = 512; cvs.height = 160;
    const ctx = cvs.getContext('2d');

    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 144, 20);
    ctx.fill();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ef4444';
    ctx.font = '32px sans-serif';
    ctx.fillText('📍', 24, 72);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px "Space Grotesk", sans-serif';
    ctx.fillText('1042 ROBSON ST', 76, 68);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.fillText('VANCOUVER, BC · RESIDENCE CONFIRMED', 76, 102);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText('LEGAL EVIDENCE MATCH · 100% HARDWARE BIND', 76, 126);

    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 1.1, 0.10),
      new THREE.MeshStandardMaterial({ map: tex, metalness: 0.2, roughness: 0.3 })
    );
    board.position.y = 0.55;

    const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 12), postMat);
    postL.position.set(-1.4, 0.275, 0);
    const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 12), postMat);
    postR.position.set(1.4, 0.275, 0);

    group.add(board, postL, postR);
    return group;
  }

  /* ---- Combined Subscriber Identity Bundle (3 Objects: Credit Card + Photo ID + Architectural Home) ---- */
  createSubscriberBundle(scale = 1) {
    const group = new THREE.Group();
    group.name = 'subscriberBundle';

    // Object 1: Sleek 3D Credit Card (Left, RBC Royal Canadian Bank)
    const creditCard = this.create3DCreditCard(0.92);
    creditCard.position.set(-9.2, 2.4, 0.4);
    creditCard.rotation.set(0, 0.10, 0);
    group.add(creditCard);

    // Object 2: 3D Photo ID Card with Hacker's Mugshot Still & 3D Head (Middle)
    const idCard = this.create3DPhotoIdCard(0.92);
    idCard.position.set(0.0, 2.6, 0.0);
    idCard.rotation.set(0, 0.0, 0);
    group.add(idCard);

    // Object 3: Real Architectural Residential Home from Downloads (Right)
    const homeWrap = new THREE.Group();
    homeWrap.name = 'homeWrap';
    if (this.homeSweetHomeScene) {
      homeWrap.add(this.homeSweetHomeScene.clone(true));
    }
    homeWrap.position.set(10.2, 0, 0);
    // REMOVE ROTATE: front yard with tree faces forward toward user, level with ground!
    homeWrap.rotation.set(0, 0, 0);
    group.add(homeWrap);

    // Front yard address plaque standing on front-right curb of driveway
    // (Walkway, front door, lawn, and white-blossomed tree are 100% visible and unobstructed!)
    const addrPlaque = this.createHouseAddressPlaque();
    addrPlaque.position.set(14.2, 0, 4.6);
    addrPlaque.rotation.set(0, -0.18, 0);
    group.add(addrPlaque);

    // Dedicated high-intensity architectural lighting rig on the home
    // (Crisp, warm, bright: illuminates roof shingles, walls, lawn, and tree!)
    const homeKey = new THREE.DirectionalLight(0xfffaea, 4.5);
    homeKey.position.set(13.5, 14.0, 12.0);
    homeKey.target.position.set(10.2, 2.0, 0);

    const homeFill = new THREE.PointLight(0x38bdf8, 3.2, 40);
    homeFill.position.set(6.0, 8.0, 8.0);

    const homeSun = new THREE.DirectionalLight(0xffeedd, 3.2);
    homeSun.position.set(10.2, 18.0, 4.0);

    const homeRim = new THREE.DirectionalLight(0x60a5fa, 2.2);
    homeRim.position.set(10.2, 10.0, -8.0);

    group.add(homeKey, homeKey.target, homeFill, homeSun, homeRim);
    group.scale.setScalar(scale);
    return group;
  }

  /* ---- 3D Swiss Rejection Shield & Speech Bubble from Proton Server ---- */
  createSwissRejectionShieldAndBubble() {
    const group = new THREE.Group();

    // 1. Faceted Heraldic Swiss Shield
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(-3.2, 3.8);
    shieldShape.lineTo(3.2, 3.8);
    shieldShape.lineTo(3.2, 0.4);
    shieldShape.bezierCurveTo(3.2, -2.4, 1.8, -4.2, 0, -5.2);
    shieldShape.bezierCurveTo(-1.8, -4.2, -3.2, -2.4, -3.2, 0.4);
    shieldShape.closePath();

    const extrudeSettings = { depth: 0.8, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.3, bevelThickness: 0.3 };
    const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, extrudeSettings);
    shieldGeo.center();

    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x991b1b,
      emissiveIntensity: 0.5,
      metalness: 0.5,
      roughness: 0.25
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.position.set(-7.5, 3.2, 0);

    // Embossed White Swiss Cross on front of shield
    const crossMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.1
    });
    const crossBar1 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.2, 0.45), crossMat);
    const crossBar2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.6, 0.45), crossMat);
    crossBar1.position.z = 0.65;
    crossBar2.position.z = 0.65;
    shieldMesh.add(crossBar1, crossBar2);
    group.add(shieldMesh);

    // 2. High-res 3D Speech Bubble with Proton Rejection Notice
    const bubbleCvs = document.createElement('canvas');
    bubbleCvs.width = 1024;
    bubbleCvs.height = 420;
    const ctx = bubbleCvs.getContext('2d');

    // Speech bubble background (rounded box + triangle tail)
    ctx.fillStyle = '#080d1a';
    ctx.beginPath();
    ctx.roundRect(16, 16, 992, 340, 36);
    ctx.fill();

    // Tail pointing down toward server
    ctx.beginPath();
    ctx.moveTo(180, 356);
    ctx.lineTo(140, 412);
    ctx.lineTo(240, 356);
    ctx.closePath();
    ctx.fill();

    // Border with radiant red/violet glow
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(16, 16, 992, 340, 36);
    ctx.moveTo(180, 356);
    ctx.lineTo(140, 412);
    ctx.lineTo(240, 356);
    ctx.stroke();

    // Clean, high-impact rejection notices: short bold lines with no legal paragraphs
    ctx.textAlign = 'center';

    // 1. Swiss Host Header
    ctx.fillStyle = '#f87171';
    ctx.font = '900 42px "Space Grotesk", sans-serif';
    ctx.fillText('🇨🇭 PROTON AG', 512, 102);

    // 2. Bold Rejection Notice
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 62px "Space Grotesk", sans-serif';
    ctx.fillText('REQUEST DENIED', 512, 195);

    // 3. Clear Jurisdiction Rule
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 36px "Space Grotesk", sans-serif';
    ctx.fillText('SWISS JURISDICTION ONLY', 512, 280);

    const bubbleTex = new THREE.CanvasTexture(bubbleCvs);
    bubbleTex.colorSpace = THREE.SRGBColorSpace;
    bubbleTex.minFilter = THREE.LinearFilter;
    bubbleTex.magFilter = THREE.LinearFilter;

    const bubbleGeo = new THREE.PlaneGeometry(16.5, 6.8);
    const bubbleMat = new THREE.MeshBasicMaterial({
      map: bubbleTex,
      transparent: true,
      side: THREE.DoubleSide
    });
    const bubbleMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
    bubbleMesh.position.set(4.5, 2.8, 0);
    group.add(bubbleMesh);

    group.add(new THREE.PointLight(0xef4444, 3.5, 32));
    group.position.set(0, 15.5, 4.8);
    group.userData.stationKey = 'proton';
    group.traverse(c => { c.userData.stationKey = 'proton'; });
    return group;
  }

  /* ---- 3D Hacker Laptop Screen: ProtonMail Encrypted Threat Email ---- */
  createHackerEmailScreenTexture() {
    const cvs = document.createElement('canvas');
    cvs.width = 2048;
    cvs.height = 2048;
    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
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
    ctx.save();
    ctx.scale(2, 2);
    const W = 1024, H = 1024;

    // Dark sleek cyberpunk desktop background
    ctx.fillStyle = '#080711';
    ctx.fillRect(0, 0, W, H);

    // ProtonMail window centered on screen with generous inset so bezels never clip text
    const winX = 140;
    const winY = 70;
    const winW = 760;
    const winH = 860;

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
    ctx.fillRect(winX, winY, winW, 76);

    // Window Control Dots (macOS/Linux style)
    const dots = ['#ef4444', '#f59e0b', '#10b981'];
    dots.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(winX + 40 + i * 32, winY + 38, 10, 0, Math.PI * 2);
      ctx.fill();
    });

    // Proton Mail Header Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 34px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🇨🇭 Proton Mail', winX + 160, winY + 38);

    // Helper for progressive text typing
    const clip = (str, startP, endP) => {
      const p = clamp01((progress - startP) / (endP - startP));
      return str.slice(0, Math.ceil(str.length * p));
    };

    // Metadata field rows (TO, FROM, SUBJECT) - generously indented away from left monitor bezel
    const drawField = (y, label, val, color) => {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 32px "JetBrains Mono", monospace';
      ctx.fillText(label, winX + 45, winY + y);

      ctx.fillStyle = color;
      ctx.font = '900 36px "JetBrains Mono", monospace';
      ctx.fillText(val, winX + 240, winY + y);

      // Separator line
      ctx.strokeStyle = 'rgba(109, 74, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(winX + 35, winY + y + 24);
      ctx.lineTo(winX + winW - 35, winY + y + 24);
      ctx.stroke();
    };

    drawField(140, 'TO:',      clip('911@POJ.CA', 0.0, 0.25),        '#38bdf8');
    drawField(215, 'FROM:',    clip('BADGUY@PROTON.ME', 0.20, 0.45),  '#c4b5fd');
    drawField(290, 'SUBJECT:', clip('BOMB THREAT: IMMEDIATE ACTION', 0.45, 0.65), '#fb7185');

    // Message Body Area
    const bodyY = 350;
    const bodyH = winH - bodyY - 40;
    ctx.fillStyle = '#0a0915';
    ctx.fillRect(winX + 30, winY + bodyY, winW - 60, bodyH);
    ctx.strokeStyle = 'rgba(109, 74, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(winX + 30, winY + bodyY, winW - 60, bodyH);

    // Large Flashing BOMB and below THREAT text
    if (progress >= 0.40) {
      const now = performance.now();
      const isFlash = Math.floor(now * 0.005) % 2 === 0;

      ctx.save();
      ctx.textAlign = 'center';

      // Flashing alert banner border
      ctx.strokeStyle = isFlash ? '#ff0038' : '#f59e0b';
      ctx.lineWidth = 8;
      ctx.strokeRect(winX + 45, winY + bodyY + 25, winW - 90, bodyH - 50);

      // Warning glow
      ctx.shadowColor = isFlash ? '#ff0038' : '#ffffff';
      ctx.shadowBlur = isFlash ? 40 : 18;
      ctx.fillStyle = isFlash ? '#ff0038' : '#ffffff';

      // Line 1: BOMB (HUGE & BOLD)
      ctx.font = '900 135px "Space Grotesk", "JetBrains Mono", sans-serif';
      ctx.fillText('BOMB', winX + winW * 0.5, winY + bodyY + 185);

      // Line 2: THREAT (HUGE & BOLD)
      ctx.fillText('THREAT', winX + winW * 0.5, winY + bodyY + 345);

      ctx.restore();
    }

    // Clean Sent tag in bottom right (zero Swiss Zero-Access clutter)
    if (progress >= 0.85) {
      ctx.fillStyle = '#6d4aff';
      ctx.fillRect(winX + winW - 190, winY + bodyY + bodyH - 60, 140, 38);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 20px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SENT ✉', winX + winW - 120, winY + bodyY + bodyH - 35);
      ctx.textAlign = 'left';
    }

    ctx.restore();
    this.hackerScreenTex.needsUpdate = true;
  }

  updateHackerSeizedScreen() {
    if (!this.hackerScreenCvs) return;
    const ctx = this.hackerScreenCvs.getContext('2d');
    ctx.save();
    ctx.scale(2, 2);
    const W = 1024, H = 1024;

    // Seizure crimson & midnight black flashing border
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, W, H);

    const winX = 100, winY = 60, winW = 824, winH = 900;
    ctx.fillStyle = '#0a1020';
    ctx.fillRect(winX, winY, winW, winH);

    // Flashing red border
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 8;
    ctx.strokeRect(winX, winY, winW, winH);

    const grad = ctx.createLinearGradient(winX, winY, winX + winW, winY);
    grad.addColorStop(0, '#dc2626');
    grad.addColorStop(0.5, '#1e3a8a');
    grad.addColorStop(1, '#dc2626');
    ctx.fillStyle = grad;
    ctx.fillRect(winX, winY, winW, 90);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 34px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚨 POLICE SEIZURE // RCMP CYBER DIVISION', winX + winW / 2, winY + 45);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = '900 36px "Space Grotesk", sans-serif';
    ctx.fillText('TARGET UNMASKED', winX + 50, winY + 160);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 46px "Space Grotesk", sans-serif';
    ctx.fillText('CONNOR J. MALONE', winX + 50, winY + 225);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 28px "JetBrains Mono", monospace';
    ctx.fillText('ALIAS: badguy@proton.me', winX + 50, winY + 285);

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(winX + 40, winY + 315);
    ctx.lineTo(winX + winW - 40, winY + 315);
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 30px "Space Grotesk", sans-serif';
    ctx.fillText('📍 RESIDENTIAL ADDRESS:', winX + 50, winY + 365);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 34px "Space Grotesk", sans-serif';
    ctx.fillText('1042 ROBSON ST, VANCOUVER BC', winX + 50, winY + 415);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 28px "JetBrains Mono", monospace';
    ctx.fillText('CONFIRMED PUSH HARDWARE TOKENS:', winX + 50, winY + 490);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '26px "JetBrains Mono", monospace';
    ctx.fillText('• APNs: #7A9F-FB01 (iPhone 15 Pro)', winX + 50, winY + 540);
    ctx.fillText('• FCM:  #3E1B-IG02 (Google Pixel 8)', winX + 50, winY + 585);
    ctx.fillText('• 𝕏:    #9C4D-X03 (Hardware Hash Match)', winX + 50, winY + 630);

    // Big red WARRANT EXECUTED stamp
    ctx.save();
    ctx.translate(winX + winW / 2, winY + 770);
    ctx.rotate(-0.1);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 6;
    ctx.strokeRect(-260, -45, 520, 90);
    ctx.fillStyle = '#ef4444';
    ctx.font = '900 42px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WARRANT EXECUTED // SEIZED', 0, 12);
    ctx.restore();

    ctx.restore();
    if (this.hackerScreenTex) this.hackerScreenTex.needsUpdate = true;
  }

  /* ---- 3D Official Bomb Threat Message Packet with Flashing Danger Beacon ---- */
  createBombThreatMessagePacket() {
    const group = new THREE.Group();

    // High-resolution canvas texture for bomb threat dispatch card (640x400)
    const cvs = document.createElement('canvas');
    cvs.width = 640;
    cvs.height = 400;
    const ctx = cvs.getContext('2d');

    // Deep dark alert background
    ctx.fillStyle = '#120508';
    ctx.fillRect(0, 0, 640, 400);

    // Hazard striped border
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, 620, 380);

    // Flashing Crimson Header
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(20, 20, 600, 70);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px "Space Grotesk", sans-serif';
    ctx.fillText('💣 INCOMING EMERGENCY DISPATCH', 320, 66);

    // Message Body Header
    ctx.fillStyle = '#f87171';
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.fillText('FROM: badguy@proton.me  →  TO: 911@poj.ca', 320, 130);

    // BOMB THREAT (Huge bold warning)
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 58px "Space Grotesk", "JetBrains Mono", sans-serif';
    ctx.fillText('BOMB THREAT', 320, 210);

    ctx.fillStyle = '#fca5a5';
    ctx.font = '700 24px "JetBrains Mono", monospace';
    ctx.fillText('VANCOUVER / SURREY CORRIDOR · ACTIVE ALERT', 320, 260);

    // Footer
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(20, 310, 600, 65);
    ctx.fillStyle = '#fee2e2';
    ctx.font = '800 22px "JetBrains Mono", monospace';
    ctx.fillText('PRIORITY 1 TRANSMISSION · TRACE REQUIRED', 320, 350);

    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.25,
      metalness: 0.35,
      side: THREE.DoubleSide
    });

    const card = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 5.3), mat);
    card.castShadow = true;
    group.add(card);

    // Flashing red emergency beacon light atop the threat packet
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 0.6, 16),
      new THREE.MeshStandardMaterial({ color: 0xff0033, emissive: 0xff0033, emissiveIntensity: 2.5, roughness: 0.1 })
    );
    beacon.position.set(0, 2.9, 0);
    group.add(beacon);

    const pointLight = new THREE.PointLight(0xff1133, 5.0, 35, 1.2);
    pointLight.position.set(0, 3.2, 0);
    group.add(pointLight);

    group.userData = { beacon, pointLight };
    return group;
  }

  /* ---- 3D Official EXIGENT DEMAND Warrant Paper with Rotating Emergency Siren Beacon ---- */
  createExigentDemandWithSiren() {
    const group = new THREE.Group();

    // 1. High-resolution canvas texture for official legal paper (512x720)
    const cvs = document.createElement('canvas');
    cvs.width = 512;
    cvs.height = 720;
    const ctx = cvs.getContext('2d');

    // Clean legal parchment
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 720);

    // Official navy and gold double border
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 8;
    ctx.strokeRect(16, 16, 480, 688);
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 26, 460, 668);

    // Official RCMP Coat of Arms Crest at top of letter
    const crestImg = new Image();
    crestImg.onload = () => {
      ctx.drawImage(crestImg, 256 - 38, 36, 76, 76);
      tex.needsUpdate = true;
    };
    crestImg.src = 'textures/rcmp_crest.webp';

    // Header: Canadian Justice / Police Crest header
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 18px "Space Grotesk", sans-serif';
    ctx.fillText('🇨🇦 ROYAL CANADIAN MOUNTED POLICE · GRC', 256, 126);

    ctx.fillStyle = '#475569';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillText('CRIMINAL CODE OF CANADA · S. 487.014(1)', 256, 146);

    // Bold Urgent Header Box
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(40, 162, 432, 54, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 26px "Space Grotesk", sans-serif';
    ctx.fillText('EXIGENT DEMAND', 256, 198);

    // Official legal document metadata
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.fillText('CASE REF: #RCMP-2026-X99', 52, 246);
    ctx.fillText('TARGET:   PROTON AG (SWITZERLAND)', 52, 274);
    ctx.fillText('OFFENCE:  IMMINENT LIFE SAFETY THREAT', 52, 302);
    ctx.fillText('MANDATE:  IMMEDIATE LOG PRESERVATION', 52, 330);

    // Horizontal divider
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(52, 350); ctx.lineTo(460, 350);
    ctx.stroke();

    // Body lines of legal demand
    ctx.fillStyle = '#334155';
    ctx.font = '13px "Space Grotesk", sans-serif';
    ctx.fillText('PURSUANT TO SECTION 487.014(1) OF THE CRIMINAL CODE,', 52, 380);
    ctx.fillText('YOU ARE HEREBY COMMANDED TO DISCLOSE IDENTIFYING', 52, 404);
    ctx.fillText('IP ACCESS RECORDS, ROUTING DATA, AND SUBSCRIBER', 52, 428);
    ctx.fillText('CREDENTIALS ASSOCIATED WITH THE ATTACHED THREAT.', 52, 452);

    // Official Red Stamp in bottom-right corner: EXIGENT / IMMEDIATE
    ctx.save();
    ctx.translate(360, 560);
    ctx.rotate(-0.16);
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.85)';
    ctx.lineWidth = 4;
    ctx.strokeRect(-80, -35, 160, 70);
    ctx.fillStyle = 'rgba(220, 38, 38, 0.85)';
    ctx.font = '900 20px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIGENT', 0, -6);
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillText('IMMEDIATE ACTION', 0, 18);
    ctx.restore();

    // Barcode / verification hash at bottom
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SHA256: 8F7E41C09A52... [LEO VERIFIED]', 256, 672);

    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    // 2. Paper Mesh (5.2 width x 7.2 height) — anchored so bottom edge is at Y = 0!
    const paperH = 7.2;
    const paperGeo = new THREE.PlaneGeometry(5.2, paperH);
    const paperMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    const paperMesh = new THREE.Mesh(paperGeo, paperMat);
    paperMesh.position.y = paperH * 0.5;
    group.add(paperMesh);

    // Thin dark backing card to give paper physical thickness & edge
    const backingGeo = new THREE.BoxGeometry(5.24, paperH + 0.04, 0.1);
    const backingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.3, roughness: 0.6 });
    const backing = new THREE.Mesh(backingGeo, backingMat);
    backing.position.set(0, paperH * 0.5, -0.06);
    group.add(backing);

    // 3. Emergency Siren Beacon mounted on top of the paper
    const sirenGroup = new THREE.Group();
    sirenGroup.position.set(0, paperH + 0.8, 0);

    const baseGeo = new THREE.CylinderGeometry(0.9, 1.1, 0.5, 16);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
    sirenGroup.add(new THREE.Mesh(baseGeo, baseMat));

    const rotor = new THREE.Group();
    rotor.position.y = 0.5;

    const redMat = new THREE.MeshPhysicalMaterial({
      color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.9,
      transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.1
    });
    const blueMat = new THREE.MeshPhysicalMaterial({
      color: 0x3b82f6, emissive: 0x2563eb, emissiveIntensity: 0.9,
      transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.1
    });

    const redDome = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.85, 16, 1, false, 0, Math.PI), redMat);
    const blueDome = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.85, 16, 1, false, Math.PI, Math.PI), blueMat);
    rotor.add(redDome, blueDome);

    const redLight = new THREE.PointLight(0xef4444, 4.0, 24);
    redLight.position.set(0, 0, 0.6);
    const blueLight = new THREE.PointLight(0x3b82f6, 4.0, 24);
    blueLight.position.set(0, 0, -0.6);
    rotor.add(redLight, blueLight);

    sirenGroup.add(rotor);
    group.add(sirenGroup);

    group.userData.rotor = rotor;
    group.userData.redLight = redLight;
    group.userData.blueLight = blueLight;

    return group;
  }

  initLeoStage() {
    // Underside Law Enforcement Reverse-Trace Stage (swings upright when worldPivot flips 180°!)
    const L = {
      bandit:      new THREE.Vector3( D, 0,  D), // front-right: Suspect (badguy@proton.me)
      swat:        new THREE.Vector3( 0, 0,  0), // center:      Canadian Police / RCMP Green Timbers HQ (larger centerpiece)
      proton:      new THREE.Vector3(-D, 0, -D), // back-left:   Switzerland Illuminated Server Station (waving flag on top!)
      ag:          new THREE.Vector3( D, 0, -D), // back-right:  Apple & Google Skyscraper HQ
      bot:         new THREE.Vector3(-D, 0,  D)  // front-left:  Single Animated App Server Tower
    };
    this.leoPos = L;
    this.leoTops = { bandit: 26, swat: 32, bot: 26, proton: 26, ag: 26 };

    // Dedicated Illuminated Switzerland Server Station with blinking blade LEDs and waving Swiss flag ON TOP
    this.protonGroup = this.createSwissServerStation();
    this.protonGroup.position.set(L.proton.x, 0, L.proton.z);
    // Face outward (-X, -Z) toward the outside carousel camera so front glass, flashing LEDs, and Swiss deny logo are directly visible
    this.protonGroup.rotation.y = -Math.PI * 0.75;
    this.protonGroup.userData.stationKey = 'proton';
    this.protonGroup.traverse(c => { c.userData.stationKey = 'proton'; });
    this.leoGroup.add(this.protonGroup);

    // 3D Swiss Shield Icon + Speech Bubble from Proton Server ("PROTON DOES NOT PROVIDE USER DATA TO NON-SWISS AUTHORITIES")
    this.rejectShieldBubble = this.createSwissRejectionShieldAndBubble();
    this.rejectShieldBubble.visible = false;
    this.protonGroup.add(this.rejectShieldBubble);

    // Apple & Google Subscriber Vault (cloned Skyscraper HQ mounts here once logos finish loading,
    // topped with the glowing Subscriber Identity Record!)
    this.leoAgGroup = new THREE.Group();
    this.leoAgGroup.position.set(L.ag.x, 0, L.ag.z);
    this.leoGroup.add(this.leoAgGroup);

    // 3D Photo ID + Tiny 3D Home resting right above Apple & Google logos (only revealed when queried in Step 6!)
    this.leoAgSubscriberMesh = this.createSubscriberBundle(0.85);
    this.leoAgSubscriberMesh.position.set(0, 16.0, 0);
    this.leoAgSubscriberMesh.visible = false;
    this.leoAgGroup.add(this.leoAgSubscriberMesh);

    // 3D Official Bomb Threat Message Packet transmitted from Hacker to RCMP HQ
    this.threatPacket = this.createBombThreatMessagePacket();
    this.threatPacket.visible = false;
    this.leoGroup.add(this.threatPacket);

    // Official EXIGENT DEMAND Legal Warrant Document with Rotating Emergency Siren
    this.exigentDemand = this.createExigentDemandWithSiren();
    this.exigentDemand.visible = false;
    this.leoGroup.add(this.exigentDemand);
    this.leoTops.ag = 20;

    // LEO investigative arcs radiating from the central RCMP Green Timbers HQ
    // Courtyard entrance anchor for ground-level threats and returned warrants
    const pSwatFront   = L.swat.clone().add(new THREE.Vector3(0, 14.5, 12.0));
    // Rooftop / command deck anchor for outbound cyber warrants and subpoenas
    const pSwatRoof    = L.swat.clone().add(new THREE.Vector3(0, 16.0, 2.0));
    // Front entrance of outward-facing Swiss server
    const pProton      = L.proton.clone().add(new THREE.Vector3(-3.4, 14.0, -3.4));
    const pBot         = L.bot.clone().add(new THREE.Vector3(0, 9.5, 2.5));
    const pAg          = L.ag.clone().add(new THREE.Vector3(0, 14.0, 0));
    const pHacker      = L.bandit.clone().add(new THREE.Vector3(0, 9.5, 0));

    // Natural, elegant mortar trajectory arcs (height 32-35, control Y = 48-50)
    // 1. Inbound bomb threat from hacker desk to RCMP front entrance
    this.arcLeoThreat  = new THREE.QuadraticBezierCurve3(
      pHacker,
      new THREE.Vector3((pHacker.x + pSwatFront.x) * 0.5, 50.0, (pHacker.z + pSwatFront.z) * 0.5),
      pSwatFront
    );
    // 2. Outbound emergency order from RCMP command to Swiss Proton server
    this.arcLeoProton  = new THREE.QuadraticBezierCurve3(
      pSwatRoof,
      new THREE.Vector3((pSwatRoof.x + pProton.x) * 0.5, 50.0, (pSwatRoof.z + pProton.z) * 0.5),
      pProton
    );
    // 3. Outbound order from RCMP to App Servers (outbound lane offset +1.2)
    this.arcLeoToMeta  = new THREE.QuadraticBezierCurve3(
      pSwatRoof,
      new THREE.Vector3((pSwatRoof.x + pBot.x) * 0.5 + 1.2, 48.0, (pSwatRoof.z + pBot.z) * 0.5 + 1.2),
      pBot
    );
    // 4. Inbound push tokens from App Servers to RCMP front entrance (inbound lane offset -1.2)
    this.arcLeoTokens  = new THREE.QuadraticBezierCurve3(
      pBot,
      new THREE.Vector3((pBot.x + pSwatFront.x) * 0.5 - 1.2, 48.0, (pBot.z + pSwatFront.z) * 0.5 - 1.2),
      pSwatFront
    );
    // 5. Outbound production order from RCMP to Apple & Google HQ (outbound lane offset +1.2)
    this.arcLeoToAg    = new THREE.QuadraticBezierCurve3(
      pSwatRoof,
      new THREE.Vector3((pSwatRoof.x + pAg.x) * 0.5 + 1.2, 50.0, (pSwatRoof.z + pAg.z) * 0.5 + 1.2),
      pAg
    );
    // 6. Inbound subscriber ID from Apple & Google to RCMP command (inbound lane offset -1.2)
    this.arcLeoFromAg  = new THREE.QuadraticBezierCurve3(
      pAg,
      new THREE.Vector3((pAg.x + pSwatRoof.x) * 0.5 - 1.2, 50.0, (pAg.z + pSwatRoof.z) * 0.5 - 1.2),
      pSwatRoof
    );

    this.leoLineThreat = this.addArc(this.arcLeoThreat, 0xf43f5e, 0.55, this.leoGroup);
    this.leoLineProton = this.addArc(this.arcLeoProton, 0xf43f5e, 0.55, this.leoGroup);
    this.leoLineToMeta = this.addArc(this.arcLeoToMeta, 0xfbbf24, 0.55, this.leoGroup);
    this.leoLineTokens = this.addArc(this.arcLeoTokens, 0xfbbf24, 0.55, this.leoGroup);
    this.leoLineToAg   = this.addArc(this.arcLeoToAg,   0x38bdf8, 0.55, this.leoGroup);
    this.leoLineFromAg = this.addArc(this.arcLeoFromAg, 0x34d399, 0.55, this.leoGroup);

    this.leoLines = [
      this.leoLineThreat,
      this.leoLineProton,
      this.leoLineToMeta,
      this.leoLineTokens,
      this.leoLineToAg,
      this.leoLineFromAg
    ];

    // Trio of 3 unique branded token keys (Meta blue, IG pink, X silver)
    this.leoUniqueKeysGroup = this.createUniqueTokenTrio(1.2);
    this.leoUniqueKeysGroup.visible = false;
    this.leoGroup.add(this.leoUniqueKeysGroup);

    // Combined 3D Photo ID + Tiny 3D Home (Subscriber Record)
    this.leoSubscriberBundle = this.createSubscriberBundle(1.25);
    this.leoSubscriberBundle.visible = false;
    this.leoGroup.add(this.leoSubscriberBundle);

    this.leoGroup.visible = false;
  }

  /* ---- Attach 3D Miniature Relief Bust of Hacker Head on ID Card ---- */
  attachHacker3DBust(hacker) {
    try {
      const bust = new THREE.Group();
      const hx = 108.0, hy = 258.0, hz = 83.0;
      // Neck clipping plane: strictly cuts off all body/torso/legs/shoes below Y = 236 in model space!
      const neckPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -236.0);

      hacker.traverse(c => {
        if (!c.isMesh) return;
        const mName = c.material ? (c.material.name || '') : '';
        const cName = c.name || '';
        // Skip screen, glasses, clothes, torso, pants, shoes
        if (mName.includes('blinn4') || cName.includes('blinn4')) return;
        if (mName.includes('Eyewear') || cName.includes('Eyewear')) return;
        if (mName.includes('Topmat') || mName.includes('Bottommat') || mName.includes('Material') || mName.includes('Ch01_body')) return;
        if (mName.includes('Bodymat') || mName.includes('Hairmat')) {
          const mClone = c.clone(true);
          if (mClone.material) {
            mClone.material = mClone.material.clone();
            mClone.material.roughness = 0.42;
            mClone.material.metalness = 0.05;
            mClone.material.clippingPlanes = [neckPlane];
            mClone.material.clipShadows = true;
            if (c.userData && c.userData.origColor) {
              mClone.material.color.copy(c.userData.origColor);
            }
          }
          bust.add(mClone);
        }
      });

      // Center around hacker head (hx, hy, hz)
      bust.position.set(-hx, -hy, -hz);

      const bustRoot = new THREE.Group();
      bustRoot.add(bust);
      // Scale down to fit neatly in portrait frame (target height ≈ 2.2 units)
      const scaleBust = 2.2 / 45.0;
      bustRoot.scale.setScalar(scaleBust);
      // Face in hack.glb faces -X: rotate by +PI/2 around Y so face points directly forward (+Z) toward user!
      bustRoot.rotation.y = Math.PI * 0.5;

      const attach = (bundle) => {
        if (!bundle) return;
        const hw = bundle.getObjectByName('headBustWrap');
        if (hw) {
          hw.clear();
          hw.add(bustRoot.clone(true));
        }
      };
      attach(this.leoSubscriberBundle);
      attach(this.leoAgSubscriberMesh);
    } catch (e) {
      console.warn('attachHacker3DBust fallback:', e);
    }
  }

  loadModels() {
    const status = document.getElementById('load-status');
    let left = 8; // single server tower + phone + apple + google + earth + bandit + swat + home
    const done = () => { if (--left <= 0) status.style.display = 'none'; };

    // 1. Datacentre Cluster (front-left)
    this.initDatacentreCluster(done);

    // 2. Interactive Smartphone (front-right) with dynamic iOS / Android screen
    this.phoneCvs = document.createElement('canvas');
    this.phoneCvs.width = 512;
    this.phoneCvs.height = 1024;
    this.phoneTex = new THREE.CanvasTexture(this.phoneCvs);
    this.phoneTex.colorSpace = THREE.SRGBColorSpace;
    this.phoneTex.minFilter = THREE.LinearFilter;
    this.phoneTex.magFilter = THREE.LinearFilter;
    this.phoneTex.generateMipmaps = false;
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

      this.hackerBodyMeshes = [];
      this.hackerGlassesMesh = null;

      hacker.traverse(c => {
        if (!c.isMesh) return;
        c.userData.stationKey = 'bandit';
        const mName = c.material ? (c.material.name || '') : '';
        const cName = c.name || '';
        if (mName.includes('blinn4') || cName.includes('blinn4')) {
          c.material = screenMat;
          this.hackerScreenMesh = c;
        } else if (mName.includes('Eyewear') || cName.includes('Eyewear')) {
          // Authentic model eyewear:
          // 1. Base frame mesh: inner rims, frame borders, bridge, temples, and back surfaces rendered in matte black
          c.visible = true;
          const frameMat = new THREE.MeshStandardMaterial({
            color: 0x050508,
            emissive: 0x000000,
            roughness: 0.85,
            metalness: 0.15,
            side: THREE.DoubleSide
          });
          c.material = frameMat;

          // 2. Front reflective lens overlay: outer front lens surfaces rendered with FrontSide culling!
          // When viewed from behind/overhead, FrontSide culls it completely, revealing only the black inner frames!
          if (c.geometry) {
            c.geometry.computeVertexNormals();
            const pos = c.geometry.attributes.position;
            const norm = c.geometry.attributes.normal;
            const idx = c.geometry.index;

            const lensIndices = [];
            const frameIndices = [];

            if (idx) {
              const arr = idx.array;
              for (let i = 0; i < arr.length; i += 3) {
                const a = arr[i], b = arr[i + 1], cIdx = arr[i + 2];
                const avgX = (pos.getX(a) + pos.getX(b) + pos.getX(cIdx)) / 3;
                const avgNx = norm ? (norm.getX(a) + norm.getX(b) + norm.getX(cIdx)) / 3 : -1;
                // Face faces -X in hack.glb. Front lenses are at X in [87.6, 92.5] with normals facing -X
                if (avgX <= 92.5 && avgNx < -0.15) {
                  lensIndices.push(a, b, cIdx);
                } else {
                  frameIndices.push(a, b, cIdx);
                }
              }
            }

            if (lensIndices.length > 0) {
              const lensGeom = c.geometry.clone();
              lensGeom.setIndex(lensIndices);
              const lensMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                emissive: 0xffffff,
                emissiveIntensity: 1.8,
                roughness: 0.12,
                metalness: 0.85,
                side: THREE.FrontSide,
                polygonOffset: true,
                polygonOffsetFactor: -1,
                polygonOffsetUnits: -1
              });
              const lensMesh = new THREE.Mesh(lensGeom, lensMat);
              lensMesh.name = 'hackerGlassesLens';
              lensMesh.position.x -= 0.05; // slight forward nudge along -X (face forward direction)
              c.add(lensMesh);
              this.hackerGlassesMesh = lensMesh;
            } else {
              this.hackerGlassesMesh = c;
            }
          }
        } else if (mName.includes('Topmat') || mName.includes('Hairmat') || mName.includes('Bodymat') || mName.includes('Bottommat')) {
          // Cloaked in menacing deep dark shadow until ID'ed
          if (c.material) {
            c.material = c.material.clone();
            c.material.roughness = 0.85;
            c.material.metalness = 0.1;
            c.userData.origColor = c.material.color.clone();
            c.material.color.setHex(0x1a1a1f);
          }
          this.hackerBodyMeshes.push(c);
        } else {
          // Hands and keyboard: keep responsive to screen glow & keyboard light!
          if (c.material) {
            c.material = c.material.clone();
            c.material.roughness = 0.35;
          }
        }
      });

      // Focused keyboard and hands light (showing only hands & keyboard in the dark!)
      this.hackerKeyboardLight = new THREE.PointLight(0x6366f1, 3.2, 12);
      this.hackerKeyboardLight.position.set(0, 8.5, 3.2);
      hacker.add(this.hackerKeyboardLight);

      // Screen glow illuminating hands and reflection
      this.hackerScreenGlow = new THREE.PointLight(0x8b5cf6, 2.0, 14);
      this.hackerScreenGlow.position.set(0, 11, 4.0);
      hacker.add(this.hackerScreenGlow);

      // Bright Police interrogation spotlight overhead (OFF until suspect is ID'ed!)
      this.hackerSpotlight = new THREE.SpotLight(0xfff5ea, 0, 85, Math.PI / 4.2, 0.3, 1.2);
      this.hackerSpotlight.position.set(this.leoPos.bandit.x, 36, this.leoPos.bandit.z);
      this.hackerSpotlight.target.position.set(this.leoPos.bandit.x, 10, this.leoPos.bandit.z);
      this.leoGroup.add(this.hackerSpotlight);
      this.leoGroup.add(this.hackerSpotlight.target);

      this.leoTops.bandit = this.ground(hacker, 28, this.leoPos.bandit);
      this.leoGroup.add(hacker);
      this.attachHacker3DBust(hacker);
      done();
    }, undefined, done);

    this.loader.load('models/leo/RCMP_Green_Timbers_Entrance_Revision.glb', (gltf) => {
      const m = gltf.scene;
      m.userData.stationKey = 'swat';

      // Cut out large surrounding property (outer terrain, municipal streets, trees, parking lots, distant annexes)
      // Keep strictly the RCMP Headquarters building footprint and entrance (zero grass, zero terrain)
      const excludeKeywords = [
        'adjacent',
        'parking',
        'terrain',
        'woodland',
        'street',
        'road',
        'trail',
        'tree',
        'vegetation',
        'laboratory',
        'workshop',
        'support building',
        'pond',
        'paving',
        'grass',
        'lawn',
        'flagpole',
        'median',
        'marking',
        'timbers way',
        'floor',
        'forest',
        'meadow',
        'sedum',
        'asphalt',
        'footway'
      ];

      const toRemove = [];
      m.traverse(c => {
        if (!c.isMesh) return;
        const names = [
          c.name || '',
          (c.parent ? c.parent.name : '') || '',
          (c.material ? c.material.name : '') || ''
        ].map(s => s.toLowerCase());

        const isExcluded = excludeKeywords.some(k => names.some(n => n.includes(k)));
        if (isExcluded) {
          toRemove.push(c);
        } else {
          c.userData.stationKey = 'swat';
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      toRemove.forEach(c => {
        c.visible = false;
        if (c.parent) c.parent.remove(c);
        if (c.geometry) c.geometry.dispose();
      });

      // Imposing, menacing law enforcement finish: dark tactical monolith with bright entrance accents
      m.traverse(c => {
        if (!c.isMesh) return;
        c.castShadow = true;
        c.receiveShadow = true;
        if (c.material) {
          c.material.envMapIntensity = 0.0;
          const matName = (c.material.name || '').toLowerCase();
          const meshName = (c.name || '').toLowerCase();
          const isEntrance = meshName.includes('crest') || meshName.includes('canopy') || meshName.includes('bison') ||
                             meshName.includes('sign') || matName.includes('bison') || matName.includes('canopy') ||
                             matName.includes('sign') || matName.includes('crest');
          if (isEntrance) {
            // Entrance and bison logo pop brightly under the dramatic spotlight!
            if (c.material.color) c.material.color.setHex(0xffffff);
            c.material.roughness = 0.25;
            c.material.metalness = 0.50;
          } else {
            // Menacing dark tactical slate/charcoal exterior across roof and shells
            if (c.material.color) {
              c.material.color.setHex(0x18202e);
            }
            c.material.roughness = 0.88;
            c.material.metalness = 0.12;
          }
          c.material.needsUpdate = true;
        }
      });

      // Ground and angle the RCMP Green Timbers Headquarters building footprint at center (0, 0, 0)
      // Scaled up to 76.0 for a commanding, larger centerpiece in LEO mode!
      m.rotation.y = Math.PI * 0.22;
      this.leoTops.swat = this.ground(m, 76.0, this.leoPos.swat);
      this.leoGroup.add(m);

      // Dedicated Dramatic Lighting Rig for RCMP Green Timbers Node
      this.rcmpDaylightGroup = new THREE.Group();
      this.rcmpDaylightGroup.userData.stationKey = 'swat';

      // Bright dramatic spotlight directly lighting the entrance canopy and RCMP crest
      const spotLight = new THREE.SpotLight(0xfffae0, 110.0, 240, Math.PI / 3.8, 0.4, 1.1);
      spotLight.position.set(this.leoPos.swat.x + 8.0, 58.0, this.leoPos.swat.z + 28.0);
      spotLight.target.position.set(this.leoPos.swat.x, 5.5, this.leoPos.swat.z + 6.0);
      spotLight.castShadow = true;
      this.rcmpDaylightGroup.add(spotLight);
      this.rcmpDaylightGroup.add(spotLight.target);

      // Warm entrance illumination pool highlighting canopy and silver RCMP crest
      const entranceLight = new THREE.PointLight(0xfffaea, 22.0, 52, 1.2);
      entranceLight.position.set(this.leoPos.swat.x, 9.5, this.leoPos.swat.z + 8.5);
      this.rcmpDaylightGroup.add(entranceLight);

      // Bright ground light pool in front of the entrance doors
      const poolGeo = new THREE.CircleGeometry(8.5, 32);
      const poolMat = new THREE.MeshBasicMaterial({
        color: 0xfff5dd,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending
      });
      const poolMesh = new THREE.Mesh(poolGeo, poolMat);
      poolMesh.rotation.x = -Math.PI / 2;
      poolMesh.position.set(this.leoPos.swat.x, 0.08, this.leoPos.swat.z + 8.5);
      this.rcmpDaylightGroup.add(poolMesh);

      // Building footprint stands directly on ground plane with zero plinth / zero base slab
      this.leoGroup.add(this.rcmpDaylightGroup);
      done();
    }, undefined, done);

    // 7. Residential Home GLB from Downloads (models/home_sweet_home.glb)
    this.loader.load('models/home_sweet_home.glb', (gltf) => {
      const house = gltf.scene;
      house.userData.stationKey = 'bandit';
      house.traverse((c) => {
        if (c.isMesh) {
          c.userData.stationKey = 'bandit';
          if (c.material) {
            c.material = c.material.clone();
            c.material.roughness = 0.48;
            c.material.metalness = 0.08;
            c.material.envMapIntensity = 1.35;
            c.material.needsUpdate = true;
          }
        }
      });
      // Center and ground house at y = 0
      const box = new THREE.Box3().setFromObject(house);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const targetSize = 9.0;
      const s = targetSize / (maxDim || 1);
      house.scale.setScalar(s);
      house.position.set(-center.x * s, -box.min.y * s, -center.z * s);

      const houseRoot = new THREE.Group();
      houseRoot.add(house);
      this.homeSweetHomeScene = houseRoot;

      const attachHouse = (bundle) => {
        if (!bundle) return;
        const hw = bundle.getObjectByName('homeWrap');
        if (hw) {
          hw.clear();
          hw.add(houseRoot.clone(true));
        }
      };
      attachHouse(this.leoSubscriberBundle);
      attachHouse(this.leoAgSubscriberMesh);
      done();
    }, undefined, done);
  }

  initAppleGoogleSkyscraper(done) {
    // Push Service / App Stores Station — Apple & Google Signs ONLY
    this.storeGroup = new THREE.Group();
    this.storeGroup.position.set(POS.post.x, 0, POS.post.z);
    this.storeGroup.userData.stationKey = 'post';
    this.normalGroup.add(this.storeGroup);

    // Sleek dark architectural cyber-plinth at ground level
    const plinthGeo = new THREE.CylinderGeometry(14, 15.5, 1.2, 48);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x0a0f1d,
      roughness: 0.35,
      metalness: 0.8
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.userData.stationKey = 'post';
    plinth.position.y = 0.6;
    this.storeGroup.add(plinth);

    // Glowing cyan cyber rim ring around plinth
    const ringGeo = new THREE.TorusGeometry(14.8, 0.18, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.userData.stationKey = 'post';
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = 1.22;
    this.storeGroup.add(ring);

    // Front-facing logo mount group for Apple and Google signs
    this.frontLogosGroup = new THREE.Group();
    this.frontLogosGroup.userData.stationKey = 'post';
    this.frontLogosGroup.position.set(0, 10.5, 0);
    this.storeGroup.add(this.frontLogosGroup);

    // Illumination for the signs
    const signLight = new THREE.PointLight(0xffffff, 2.8, 60);
    signLight.position.set(0, 14, 12);
    this.storeGroup.add(signLight);

    const cyanGlow = new THREE.PointLight(0x38bdf8, 2.0, 35);
    cyanGlow.position.set(-7.5, 8, 4);
    this.storeGroup.add(cyanGlow);

    const amberGlow = new THREE.PointLight(0xf59e0b, 2.0, 35);
    amberGlow.position.set(7.5, 8, 4);
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
        this.leoAgBag.userData.stationKey = 'ag';
        this.leoAgBag.traverse(c => { if (c.isMesh) c.userData.stationKey = 'ag'; });
        this.leoAgGroup.add(this.leoAgBag);
      }
      done();
    };

    // Mount Apple Logo (left) and Google Logo (right) - Identical scale and matching finish
    const mountLogo = (path, xOffset, isApple) => {
      this.loader.load(path, (gltf) => {
        const logo = gltf.scene;
        logo.traverse((ch) => {
          if (ch.isMesh) {
            ch.userData.stationKey = 'post';
            if (ch.material) {
              ch.material.metalness = 0.52;
              ch.material.roughness = 0.24;
              ch.material.envMapIntensity = 1.35;
              ch.castShadow = true;
            }
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

    mountLogo('models/apple_logo.glb', -7.5, true);
    mountLogo('models/google_logo.glb',  7.5, false);
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
      this.worldStepTime = performance.now();
    }
    if (!this.cameraUnlocked) {
      this.cinematicFollow = true;
    }

    const isPush  = mode === 'push';
    const isWorld = mode === 'world';
    const isLeo   = mode === 'leo';
    this.flipTarget = isLeo ? Math.PI : 0;

    const color = isLeo ? 0xf43f5e : (isWorld ? 0x38bdf8 : (isPush ? 0x34d399 : 0xfbbf24));
    if (this.ringMat) this.ringMat.color.setHex(color);
    if (this.beadMat) this.beadMat.color.setHex(color);
    this.setupLines.forEach((l) => (l.visible = mode === 'setup'));
    this.pushLines.forEach((l) => (l.visible = isPush));
    if (this.flowCones) this.flowCones.forEach((fc) => (fc.mesh.visible = false));
    this.leoLines.forEach((l) => (l.visible = false));
    if (this.worldStimGroup) this.worldStimGroup.visible = isWorld;

    document.body.classList.toggle('leo-mode', isLeo);
    const btnLeoMode = document.getElementById('mode-leo');
    if (btnLeoMode) btnLeoMode.classList.toggle('active', isLeo);
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
      : (isWorld ? 'ALL WORLD STIMS' : (isPush ? 'CANDY CRUSH PUSH' : 'INSTALL & SETUP'));
    document.getElementById('pol-route').textContent = isLeo
      ? 'Threat → Proton (Denied) → RCMP OSINT Laptop → Meta/X Tokens → Apple/Google HQ'
      : (isWorld
        ? 'Planet Earth (Candy Crush / FB / IG / X / Uber / Amazon) → Datacentre → Apple/Google HQ → Phone'
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
    btn.textContent = auto ? '❚❚' : '▶';
    btn.classList.toggle('manual', !auto);
  }

  stepCycle(dir) {
    // Step cleanly to the next or previous narrative beat
    if (this.playing) this.setPlaying(false);
    this.resetFocus();
    if (!this.cameraUnlocked) {
      this.cinematicFollow = true;
    } else {
      this.cinematicFollow = false;
      this.focusCamPos = null;
      this.focusTargetPos = null;
    }
    const stops = MODE_STEPS[this.mode];
    const eps = 0.005;
    if (dir > 0) {
      const next = stops.find((s) => s > this.targetT + eps);
      this.targetT = next !== undefined ? next : stops[0];
    } else {
      const prev = [...stops].reverse().find((s) => s < this.targetT - eps);
      this.targetT = prev !== undefined ? prev : stops[stops.length - 1];
    }
    if (this.mode === 'world') {
      this.worldStepTime = performance.now();
    }
  }

  /* ---- Director's Camera Rig Editor Mode (Live Coordinates, Step Lock & Export) ---- */
  initDirectorMode() {
    this.directorMode = false;
    this.directorRigs = Object.assign({}, DEFAULT_DIRECTOR_RIGS);
    try {
      // Purge legacy fallback keys so default eye-level carousel coordinates load cleanly
      localStorage.removeItem('pushnot_director_rigs_v14');
      localStorage.removeItem('pushnot_director_rigs_v13');
      localStorage.removeItem('pushnot_director_rigs_v12');
      localStorage.removeItem('pushnot_director_rigs_v11');
      localStorage.removeItem('pushnot_director_rigs_v10');
      localStorage.removeItem('pushnot_director_rigs_v9');
      localStorage.removeItem('pushnot_director_rigs_v8');
      localStorage.removeItem('pushnot_director_rigs_v7');
      localStorage.removeItem('pushnot_director_rigs_v6');
      localStorage.removeItem('pushnot_director_rigs_v5');
      localStorage.removeItem('pushnot_director_rigs_v4');
      localStorage.removeItem('pushnot_director_rigs_v3');
      localStorage.removeItem('pushnot_director_rigs');
      const saved = JSON.parse(localStorage.getItem('pushnot_director_rigs_v15') || '{}');
      for (const k of Object.keys(saved)) {
        if (k.startsWith('leo_') && saved[k].cam && saved[k].cam.y < 45.0) continue;
        this.directorRigs[k] = saved[k];
      }
    } catch (e) {}

    const panel = document.getElementById('director-panel');
    const btnToggle = document.getElementById('btn-director');
    const btnClose = document.getElementById('dp-btn-close');
    const btnLock = document.getElementById('dp-btn-lock');
    const btnReset = document.getElementById('dp-btn-reset');
    const btnCopy = document.getElementById('dp-btn-copy');
    const btnClear = document.getElementById('dp-btn-clear');
    const toast = document.getElementById('dp-toast');

    const showToast = (msg) => {
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 2600);
    };

    const togglePanel = (force) => {
      this.directorMode = force !== undefined ? force : !this.directorMode;
      if (panel) panel.classList.toggle('hidden', !this.directorMode);
      if (btnToggle) btnToggle.classList.toggle('active', this.directorMode);
      if (this.directorMode) this.updateDirectorHUD();
    };

    if (btnToggle) btnToggle.onclick = () => togglePanel();
    if (btnClose) btnClose.onclick = () => togglePanel(false);

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'd' || e.key === 'D') {
        togglePanel();
      }
    });

    if (btnLock) {
      btnLock.onclick = () => {
        const stepIdx = this.getCurrentStepIndex();
        const key = `${this.mode}_step_${stepIdx}`;
        const cx = +this.camera.position.x.toFixed(2);
        const cy = +this.camera.position.y.toFixed(2);
        const cz = +this.camera.position.z.toFixed(2);
        this.directorRigs[key] = {
          angle: +Math.atan2(cx, cz).toFixed(3),
          radius: +Math.hypot(cx, cz).toFixed(2),
          cam: { x: cx, y: cy, z: cz },
          target: {
            x: +this.controls.target.x.toFixed(2),
            y: +this.controls.target.y.toFixed(2),
            z: +this.controls.target.z.toFixed(2)
          }
        };
        try {
          localStorage.setItem('pushnot_director_rigs_v15', JSON.stringify(this.directorRigs));
        } catch (e) {}
        showToast(`Locked ${key}!`);
        this.updateDirectorHUD();
      };
    }

    if (btnReset) {
      btnReset.onclick = () => {
        const stepIdx = this.getCurrentStepIndex();
        const key = `${this.mode}_step_${stepIdx}`;
        if (DEFAULT_DIRECTOR_RIGS[key]) {
          this.directorRigs[key] = Object.assign({}, DEFAULT_DIRECTOR_RIGS[key]);
        } else {
          delete this.directorRigs[key];
        }
        try {
          localStorage.setItem('pushnot_director_rigs_v15', JSON.stringify(this.directorRigs));
        } catch (e) {}
        showToast(`Reset ${key} to locked preset!`);
        this.updateDirectorHUD();
      };
    }

    if (btnCopy) {
      btnCopy.onclick = () => {
        const json = JSON.stringify(this.directorRigs, null, 2);
        navigator.clipboard.writeText(json).then(() => {
          showToast('Copied JSON to clipboard!');
        }).catch(() => {
          showToast('Clipboard access denied');
        });
      };
    }

    if (btnClear) {
      btnClear.onclick = () => {
        if (confirm('Clear custom overrides and restore locked director presets?')) {
          this.directorRigs = Object.assign({}, DEFAULT_DIRECTOR_RIGS);
          localStorage.removeItem('pushnot_director_rigs_v15');
          localStorage.removeItem('pushnot_director_rigs_v14');
          localStorage.removeItem('pushnot_director_rigs_v13');
          localStorage.removeItem('pushnot_director_rigs_v12');
          localStorage.removeItem('pushnot_director_rigs_v11');
          localStorage.removeItem('pushnot_director_rigs_v10');
          localStorage.removeItem('pushnot_director_rigs_v9');
          localStorage.removeItem('pushnot_director_rigs_v8');
          localStorage.removeItem('pushnot_director_rigs_v7');
          localStorage.removeItem('pushnot_director_rigs_v6');
          localStorage.removeItem('pushnot_director_rigs_v5');
          localStorage.removeItem('pushnot_director_rigs_v4');
          localStorage.removeItem('pushnot_director_rigs_v3');
          localStorage.removeItem('pushnot_director_rigs');
          showToast('Restored locked director presets!');
          this.updateDirectorHUD();
        }
      };
    }
  }

  getCurrentStepIndex() {
    const stops = MODE_STEPS[this.mode] || [0];
    let idx = 0;
    for (let i = 0; i < stops.length; i++) {
      if (this.t >= stops[i] - 0.02) idx = i;
    }
    return idx;
  }

  updateDirectorHUD() {
    if (!this.directorMode) return;
    const modeEl = document.getElementById('dp-mode');
    const stepEl = document.getElementById('dp-step');
    const camEl = document.getElementById('dp-campos');
    const tgtEl = document.getElementById('dp-target');
    const statEl = document.getElementById('dp-status');

    const stepIdx = this.getCurrentStepIndex();
    const totalSteps = (MODE_STEPS[this.mode] || []).length;
    const key = `${this.mode}_step_${stepIdx}`;
    const hasCustom = !!(this.directorRigs && this.directorRigs[key]);

    if (modeEl) modeEl.textContent = this.mode.toUpperCase();
    if (stepEl) stepEl.textContent = `${stepIdx + 1} / ${totalSteps} (t: ${this.t.toFixed(2)})`;
    if (camEl) camEl.textContent = `${this.camera.position.x.toFixed(1)}, ${this.camera.position.y.toFixed(1)}, ${this.camera.position.z.toFixed(1)}`;
    if (tgtEl) tgtEl.textContent = `${this.controls.target.x.toFixed(1)}, ${this.controls.target.y.toFixed(1)}, ${this.controls.target.z.toFixed(1)}`;

    if (statEl) {
      if (hasCustom) {
        statEl.textContent = 'LOCKED RIG';
        statEl.className = 'dp-tag-locked';
      } else {
        statEl.textContent = 'DEFAULT';
        statEl.className = 'dp-tag-default';
      }
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
    const btnLeoDock = document.getElementById('mode-leo');
    if (btnLeoDock) btnLeoDock.addEventListener('click', () => this.setMode(this.mode === 'leo' ? this.prevNormalMode : 'leo'));
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
    const btnCamLock = document.getElementById('btn-cam-lock');
    if (btnCamLock) btnCamLock.addEventListener('click', () => this.toggleCameraLock());
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

      if (this.cameraUnlocked) {
        // UNLOCKED CAMERA MODE:
        // Clicking again and again will just step forward without the camera snap!
        this.stepCycle(1);
        return;
      }

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
            activeGroup.updateMatrixWorld(true);
            const wBandit = this.leoPos.bandit.clone().applyMatrix4(activeGroup.matrixWorld);
            const wSwat   = this.leoPos.swat.clone().applyMatrix4(activeGroup.matrixWorld);
            const wProton = this.leoPos.proton.clone().applyMatrix4(activeGroup.matrixWorld);
            const wBot    = this.leoPos.bot.clone().applyMatrix4(activeGroup.matrixWorld);
            const wAg     = this.leoPos.ag.clone().applyMatrix4(activeGroup.matrixWorld);
            const d1 = hp.distanceTo(wBandit);
            const d2 = hp.distanceTo(wSwat);
            const d3 = hp.distanceTo(wProton);
            const d4 = hp.distanceTo(wBot);
            const d5 = hp.distanceTo(wAg);
            const minD = Math.min(d1, d2, d3, d4, d5);
            if (minD < 24) {
              if (minD === d1) nodeKey = 'bandit';
              else if (minD === d2) nodeKey = 'swat';
              else if (minD === d3) nodeKey = 'proton';
              else if (minD === d4) nodeKey = 'facebook';
              else nodeKey = 'ag';
            }
          } else {
            const d1 = hp.distanceTo(POS.phone);
            const d2 = hp.distanceTo(POS.server);
            const d3 = hp.distanceTo(POS.post);
            const d4 = hp.distanceTo(POS.ufo);
            const minD = Math.min(d1, d2, d3, d4);
            if (minD < 24) {
              if (minD === d1) nodeKey = 'phone';
              else if (minD === d2) nodeKey = 'server';
              else if (minD === d3) nodeKey = 'post';
              else nodeKey = 'world';
            }
          }
        }

        if (nodeKey) {
          this.snapFocusToNode(nodeKey);
        } else {
          this.resetFocus();
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
      if (this.cameraRig) this.cameraRig.disengage();
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
      else if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'u') this.toggleCameraLock();
      else if (e.key === 'ArrowRight') this.stepCycle(1);
      else if (e.key === 'ArrowLeft')  this.stepCycle(-1);
    });

    this.setPlaying(false);
    this.setAutoOrbit(false);
  }

  /* ---------------- render state from (mode, t) ---------------- */
  updateState(dt = 0.016) {
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
    if (this.threatPacket) this.threatPacket.visible = false;
    if (this.exigentDemand) this.exigentDemand.visible = false;
    if (this.leoUniqueKeysGroup) this.leoUniqueKeysGroup.visible = false;
    if (this.leoSubscriberBundle) this.leoSubscriberBundle.visible = false;
    if (this.rejectShieldBubble) this.rejectShieldBubble.visible = false;
    if (this.phoneEmojiBadge) this.phoneEmojiBadge.visible = false;
    if (this.shoppingBag) this.shoppingBag.visible = false;

    const isLeo = this.mode === 'leo';
    const L = this.leoPos;

    // Show 3D Emoji State above the Phone (`😴 App Sleeping` vs. `😃 App Awake!`)
    // NO push or wake-up in Setup/Install step — strictly in later steps (Push & World)!
    if (!isLeo) {
      if (this.mode === 'setup') {
        this.setPhoneEmojiState(null);
      } else if (this.mode === 'push') {
        this.setPhoneEmojiState(t < 0.90 ? 'sleep' : 'awake');
      }
    }

    // Candy Crush candies stay visibly installed on the phone ONLY in Mode 1 (after install) & Mode 2 (Candy Crush push) — hidden during Mode 3 multi-app push stream!
    this.installedApp.visible = !isLeo && (this.mode === 'push' || (this.mode === 'setup' && t >= 0.30));
    // Fingerprint stays persistently stored on the server once registered!
    this.storedKey.visible = !isLeo && (this.mode === 'push' || this.mode === 'world' || t >= 0.92);

    let moverPos = null;
    let moverParent = this.normalGroup;
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
    let showLeoTokens = false;
    let showLeoId     = false;

    if (this.mode === 'setup') {
      // Normal phone screen during install/setup (zero wake-up or sleeping badges here)
      this.updatePhoneScreenCanvas('home', 0);

      if (t < 0.08) {
        // Step 0: 3D Paper Shopping Bag hovering above Apple & Google
        if (this.shoppingBag) {
          this.shoppingBag.visible = true;
          this.shoppingBag.position.set(POS.post.x, 24.0 + Math.sin(performance.now() * 0.003) * 0.5, POS.post.z + 8.0);
          this.shoppingBag.rotation.y = performance.now() * 0.0018;
          this.shoppingBag.scale.setScalar(1.2);
        }
        this.appOrb.visible = false;
        moverPos = new THREE.Vector3(POS.post.x, 31.0, POS.post.z + 8.0);
        moverText = 'Candy Crush Saga';
        moverCls = 'cyan';
      } else if (t < 0.18) {
        // Step 1: Shopping bag smoothly morphs / changes into 3D Candy Crush candies!
        const morphU = clamp01((t - 0.08) / 0.05);
        if (this.shoppingBag) {
          if (morphU < 0.95) {
            this.shoppingBag.visible = true;
            this.shoppingBag.scale.setScalar(1.2 * (1.0 - morphU * 0.9));
            this.shoppingBag.position.set(POS.post.x, 24.0, POS.post.z + 8.0);
            this.shoppingBag.rotation.y = performance.now() * 0.0022;
          } else {
            this.shoppingBag.visible = false;
          }
        }
        this.appOrb.visible = true;
        const candyScale = 1.2 * Math.min(1.0, morphU * 1.15);
        this.appOrb.position.set(POS.post.x, 24.0, POS.post.z + 8.0);
        this.appOrb.scale.setScalar(candyScale);
        this.appOrb.rotation.y = performance.now() * 0.0022;
        moverPos = new THREE.Vector3(POS.post.x, 31.0, POS.post.z + 8.0);
        moverText = 'Candy Crush Saga';
        moverCls = 'cyan';
      } else if (t < 0.30) {
        // Step 2: Candy Crush flies along arc from Apple & Google to Phone
        if (this.shoppingBag) this.shoppingBag.visible = false;
        const p = this.arcStoreToPhone.getPoint(seg(t, 0.18, 0.30));
        this.appOrb.visible = true;
        this.appOrb.scale.setScalar(1.2);
        this.appOrb.position.copy(p);
        moverPos = p;
        moverText = 'Candy Crush Saga';
        moverCls = 'cyan';
      } else if (t < 0.38) {
        // Step 3: Installed on Phone
        if (this.shoppingBag) this.shoppingBag.visible = false;
        showInstall = true;
        moverPos = new THREE.Vector3(POS.phone.x, this.tops.phone + 14, POS.phone.z);
        moverText = 'Candy Crush Saga';
        moverCls = 'cyan';
      } else if (t < 0.48) {
        // Step 4: Phone requests token from Apple & Google
        const p = this.arcPhoneToPost.getPoint(seg(t, 0.38, 0.48));
        this.triggerBolt.visible = true;
        this.triggerBolt.position.copy(p);
        moverPos = p;
        moverText = this.currentOS === 'ios' ? '📲 Request APNs Token' : '📲 Request FCM Token';
        moverCls = 'cyan';
      } else if (t < 0.60) {
        // Step 5: High-Precision CNC Fiber Laser Key Fabrication (No HUD clutter, pure laser cut!)
        const mp = seg(t, 0.48, 0.60);
        const forgePos = new THREE.Vector3(POS.post.x, this.tops.post + 6, POS.post.z);
        this.keyForge.visible = true;
        this.keyForge.position.copy(forgePos);

        const LC = this.laserCutterData;
        if (LC) {
          const isCutting = mp < 0.78;
          const cutProgress = Math.min(1.0, mp / 0.75);
          const headTargetPos = LC.cutCurve.getPoint(cutProgress);

          let headY = 0.0;
          if (mp >= 0.78) {
            const liftZ = Math.min(1.0, (mp - 0.78) / 0.22);
            headY = liftZ * 2.8; // Z-axis nozzle retracts
          }

          LC.headAssembly.position.set(headTargetPos.x, headY, headTargetPos.z);
          LC.bridgeBeam.position.z = headTargetPos.z;

          // Vertical laser beam & intense focal spot lights
          if (isCutting) {
            LC.laserBeam.visible = true;
            LC.beamHalo.visible = true;
            LC.focalSpotLight.intensity = 7.0 + Math.random() * 2.0;
            LC.meltLight.intensity = 5.0 + Math.random() * 2.0;
            LC.moltenPuddle.visible = true;
            LC.moltenPuddle.position.set(headTargetPos.x, 0.14, headTargetPos.z);
          } else {
            LC.laserBeam.visible = false;
            LC.beamHalo.visible = false;
            LC.focalSpotLight.intensity = 0;
            LC.meltLight.intensity = 0;
            LC.moltenPuddle.visible = false;
          }

          // Dynamic Kerf Line (white-hot tip cooling to dark cut seam)
          const kerfCount = Math.floor(cutProgress * LC.maxKerfPts);
          const posAttr = LC.kerfLine.geometry.attributes.position;
          const colAttr = LC.kerfLine.geometry.attributes.color;

          for (let i = 0; i < LC.maxKerfPts; i++) {
            if (i <= kerfCount) {
              const u = i / LC.maxKerfPts;
              const pt = LC.cutCurve.getPoint(u);
              posAttr.setXYZ(i, pt.x, 0.14, pt.z);

              const distFromTip = (kerfCount - i) / 20;
              if (distFromTip < 1.0) {
                colAttr.setXYZ(i, 1.0, 0.95 - distFromTip * 0.3, 0.2);
              } else if (distFromTip < 3.0) {
                colAttr.setXYZ(i, 0.95, 0.25, 0.05);
              } else {
                colAttr.setXYZ(i, 0.22, 0.15, 0.05);
              }
            } else {
              posAttr.setXYZ(i, headTargetPos.x, -50, headTargetPos.z);
              colAttr.setXYZ(i, 0, 0, 0);
            }
          }
          posAttr.needsUpdate = true;
          colAttr.needsUpdate = true;

          // Physics sparks cascade downward
          const now = performance.now();
          const dt = Math.min(0.05, (now - LC.lastTime) * 0.001);
          LC.lastTime = now;

          const pArr = LC.sparkPoints.geometry.attributes.position.array;
          for (let i = 0; i < LC.sparkCount; i++) {
            const s = LC.sparksData[i];
            s.life += dt;
            if (s.life >= s.maxLife) {
              if (isCutting) {
                s.life = 0;
                s.maxLife = 0.12 + Math.random() * 0.18;
                s.pos.copy(headTargetPos).add(new THREE.Vector3(
                  (Math.random() - 0.5) * 0.1, 0.14, (Math.random() - 0.5) * 0.1
                ));
                const ang = Math.random() * Math.PI * 2;
                const spd = 3.5 + Math.random() * 6.5;
                s.vel.set(Math.cos(ang) * spd, (Math.random() * 2.5) - 2.0, Math.sin(ang) * spd);
              } else {
                pArr[i * 3 + 1] = -100;
                continue;
              }
            }
            s.vel.y -= 14.0 * dt;
            s.pos.addScaledVector(s.vel, dt);
            if (s.pos.y < -0.8) {
              s.pos.y = -0.8;
              s.vel.y *= -0.25;
            }
            pArr[i * 3]     = s.pos.x;
            pArr[i * 3 + 1] = s.pos.y;
            pArr[i * 3 + 2] = s.pos.z;
          }
          LC.sparkPoints.geometry.attributes.position.needsUpdate = true;

          // Finished 3D Golden Token Key Lift & Presentation Rotation
          if (mp >= 0.78) {
            this.tokenKey.visible = true;
            const keyLiftProg = THREE.MathUtils.smoothstep(mp, 0.78, 0.98);
            this.tokenKey.position.set(forgePos.x - 0.5, forgePos.y + 0.15 + keyLiftProg * 3.2, forgePos.z);
            this.tokenKey.scale.setScalar(1.2);
            this.tokenKey.rotation.y = now * 0.0025;
            this.tokenKey.rotation.x = Math.sin(now * 0.002) * 0.1;
          } else {
            this.tokenKey.visible = false;
          }
        }

        moverPos = forgePos.clone().add(new THREE.Vector3(0, 6.2, 0));
        moverText = 'NEW TOKEN CREATED';
        moverCls = 'cyan';
      } else if (t < 0.70) {
        // Step 6: Token returns to Phone
        const p = this.arcPostToPhone.getPoint(seg(t, 0.60, 0.70));
        this.tokenKey.visible = true;
        this.tokenKey.position.copy(p);
        moverPos = p;
        moverText = this.currentOS === 'ios' ? '🔑 APNs Token → iPhone' : '🔑 FCM Token → Android';
      } else if (t < 0.82) {
        // Step 7: Dedicated beat on Phone showing the Unique Gold Key on the Phone + registration
        const p = this.arcPhoneToServer.getPoint(seg(t, 0.70, 0.82));
        this.tokenKey.visible = true;
        this.tokenKey.position.copy(p);
        moverPos = p;
        moverText = '🔑 Register Token with Server';
      } else if (t < 0.92) {
        // Step 8: Server verifies token
        this.tokenKey.visible = true;
        this.tokenKey.position.set(POS.server.x + 12, 24, POS.server.z + 12);
        moverPos = new THREE.Vector3(POS.server.x, this.tops.server + 10, POS.server.z);
        moverText = '🔒 App Server Verifies & Binds Token to User Socket';
      } else {
        // Step 9: Push token securely stored on Server
        showSaved = true;
        moverPos = new THREE.Vector3(POS.server.x, this.tops.server + 10, POS.server.z);
        moverText = '💾 Push Token Saved in App Database';
      }
    } else if (this.mode === 'push') {
      if (t < 0.90) {
        this.updatePhoneScreenCanvas('sleeping', 0);
      } else {
        this.updatePhoneScreenCanvas('home', seg(t, 0.90, 0.98));
      }

      if (t < 0.28) {
        // Step 1: Clean Push Notification with Bell Icon resting cleanly above Earth GLB
        const cardPos = POS.ufo.clone().setY(72.5);
        this.pushOrb.visible = true;
        this.pushOrb.position.copy(cardPos);
        this.pushOrb.scale.setScalar(1.15 + Math.sin(t * 24) * 0.04);
        moverPos = cardPos.clone().add(new THREE.Vector3(0, 10.5, 0));
        moverText = '🔔 Push Notification from Candy Crush (+ Token Key)';
        moverCls = 'push';
      } else if (t < 0.56) {
        // Step 2: Push Notification + Token Key travels across sky to Google / Apple HQ
        const p = this.arcPushWorldToPost.getPoint(seg(t, 0.28, 0.56));
        this.pushOrb.visible = true;
        this.pushOrb.position.copy(p);
        this.pushOrb.scale.setScalar(1.0);
        moverPos = p;
        moverText = this.currentOS === 'ios' ? ' Candy Crush → Apple APNs (Payload + 🔑 Token)' : '🤖 Candy Crush → Google FCM (Payload + 🔑 Token)';
        moverCls = 'push';
      } else if (t < 0.78) {
        // Step 3: Google takes the Key and matches it with the end user!
        const bp = seg(t, 0.56, 0.78);
        this.pushOrb.visible = true;
        this.pushOrb.position.set(POS.post.x, 26, POS.post.z);
        this.brainGroup.visible = true;
        this.updateBrainAndLedger(bp);
        showLedger = true;
        moverPos = new THREE.Vector3(POS.post.x, 26, POS.post.z);
        moverText = this.currentOS === 'ios'
          ? '🔍 Apple extracts Token Key & matches End-User iPhone Socket'
          : '🔍 Google extracts Token Key & matches End-User Android Socket';
        moverCls = 'push';
      } else if (t < 0.94) {
        // Step 4: Deliver from Google across persistent OS socket to End User Phone
        const p = this.arcPostToPhone.getPoint(seg(t, 0.78, 0.94));
        this.pushOrb.visible = true;
        this.pushOrb.position.copy(p);
        moverPos = p;
        moverText = this.currentOS === 'ios' ? ' Deliver APNs Push → iPhone' : '🤖 Deliver FCM Push → Android';
        moverCls = 'push';
      } else {
        showPush = true;
      }
    } else if (this.mode === 'world') {
      moverParent = this.normalGroup;
      moverCls = 'push';

      // SIMPLE REPEAT FLOW:
      // All 6 global notification streams flow simultaneously and continuously
      const globalCycle = (t * 2.5);

      if (this.worldStimStreams) {
        for (let i = 0; i < this.worldStimStreams.length; i++) {
          const s = this.worldStimStreams[i];
          const streamProgress = (globalCycle + s.offset) % 1.0;

          s.line.material.opacity = 0.75;
          s.line.visible = true;
          s.orb.visible = true;
          s.pulses.visible = true;

          // Position 3D App Brand Logo Tile
          const pt = s.curve.getPoint(streamProgress);
          s.currentPos.copy(pt);
          s.orb.position.copy(pt);
          s.orb.lookAt(this.camera.position);

          // 14 glowing additive pulses streaming along curve behind tile
          if (s.pulses) {
            const posAttr = s.pulses.geometry.attributes.position;
            const arr = posAttr.array;
            for (let k = 0; k < s.pulseCount; k++) {
              const pulseU = (streamProgress - (k * 0.024) + 1.0) % 1.0;
              const pPulse = s.curve.getPoint(pulseU);
              arr[k * 3]     = pPulse.x;
              arr[k * 3 + 1] = pPulse.y;
              arr[k * 3 + 2] = pPulse.z;
            }
            posAttr.needsUpdate = true;
          }
        }
      }

      // Smoothly display arriving notifications on phone screen
      const activeIdx = Math.floor((globalCycle * WORLD_APPS.length) % WORLD_APPS.length);
      const activeApp = WORLD_APPS[activeIdx];
      const leadU = (globalCycle + (activeApp.offset || 0)) % 1.0;
      if (leadU >= 0.70) {
        this.updatePhoneScreenCanvas('home', (leadU - 0.70) / 0.30, activeApp);
      } else {
        this.updatePhoneScreenCanvas('sleeping', 0);
      }

      moverPos = null;
      moverText = '';
    } else {
      // LAW ENFORCEMENT UPSIDE-DOWN REVERSE TRACE:
      moverParent = this.leoGroup;
      if (this.leoAgSubscriberMesh) this.leoAgSubscriberMesh.visible = (t >= 0.70 && t < 0.76);

      // Progressive narrative trajectory line visibility:
      // Active step line highlighted at opacity 0.85; completed prior lines subdued at 0.25; future lines hidden!
      const setLine = (line, active, shown) => {
        if (!line) return;
        line.visible = shown;
        if (line.material) {
          line.material.opacity = active ? 0.85 : 0.25;
        }
      };

      setLine(this.leoLineThreat, (t >= 0.05 && t < 0.18), (t >= 0.05));
      setLine(this.leoLineProton, (t >= 0.18 && t < 0.32), (t >= 0.18));
      setLine(this.leoLineToMeta, (t >= 0.32 && t < 0.48), (t >= 0.32));
      setLine(this.leoLineTokens, (t >= 0.48 && t < 0.62), (t >= 0.48));
      setLine(this.leoLineToAg,   (t >= 0.62 && t < 0.76), (t >= 0.62));
      setLine(this.leoLineFromAg, (t >= 0.76),            (t >= 0.76));

      if (t < 0.18) {
        // Step 1: Bad guy types ProtonMail threat email directly on his laptop screen
        // and sends the Bomb Threat message over arcLeoThreat to central RCMP HQ!
        const tp = seg(t, 0, 0.12);
        this.updateHackerEmailScreen(tp);

        if (t >= 0.06) {
          // Send the bomb threat message over the pathway line to destination (RCMP HQ)!
          const u = seg(t, 0.06, 0.18);
          const p = this.arcLeoThreat.getPoint(u);
          if (this.threatPacket) {
            this.threatPacket.visible = true;
            this.threatPacket.position.copy(p);
            const camDir = this.camera.position.clone().sub(p);
            this.threatPacket.rotation.set(0, Math.atan2(camDir.x, camDir.z), 0);
            this.threatPacket.scale.setScalar(0.95);
          }
          moverPos = p.clone().add(new THREE.Vector3(0, 5.0, 0));
          moverText = '💣 Bomb Threat Transmitted → RCMP "E" Division HQ';
          moverCls = 'red';
        } else {
          if (this.threatPacket) this.threatPacket.visible = false;
          moverPos = null;
          moverText = '';
          moverCls = '';
        }
      } else if (t < 0.32) {
        // Step 2 & 3: RCMP serves Emergency Order to Proton -> Proton Rejects
        const showDemand = t < 0.26;
        showLeoThreat = showDemand;

        if (showDemand) {
          // At Step 2 (t = 0.20), u = 0, document sits directly at front door of RCMP (pSwat)
          const u = seg(t, 0.20, 0.26);
          const p = this.arcLeoProton.getPoint(u);
          if (this.exigentDemand) {
            this.exigentDemand.visible = true;
            this.exigentDemand.position.copy(p);
            // Orient vertically (pitch = 0, roll = 0) facing camera horizontally, so bottom never pitches into the building awning!
            const camDir = this.camera.position.clone().sub(p);
            this.exigentDemand.rotation.set(0, Math.atan2(camDir.x, camDir.z), 0);
            this.exigentDemand.scale.setScalar(0.95);
          }
          moverPos = p.clone().add(new THREE.Vector3(0, 6.0, 0));
          moverText = '🚨 Emergency Order';
          moverCls = 'red';
        } else {
          // Rejection Swiss Shield Icon + Speech Bubble
          if (this.rejectShieldBubble) this.rejectShieldBubble.visible = true;
          showLeoDenied = true;
          moverPos = new THREE.Vector3(L.proton.x, 26.5, L.proton.z);
          moverText = '⛔ Proton: Request Denied';
          moverCls = 'red';
        }
      } else if (t < 0.48) {
        // Step 4: Emergency Order served to App Servers (Meta, Instagram, 𝕏)
        const p = this.arcLeoToMeta.getPoint(seg(t, 0.32, 0.48));
        if (this.exigentDemand) {
          this.exigentDemand.visible = true;
          this.exigentDemand.position.copy(p);
          const camDir = this.camera.position.clone().sub(p);
          this.exigentDemand.rotation.set(0, Math.atan2(camDir.x, camDir.z), 0);
          this.exigentDemand.scale.setScalar(0.95);
        }
        moverPos = p.clone().add(new THREE.Vector3(0, 6.0, 0));
        moverText = '🚨 Order → App Servers';
        moverCls = 'cyan';
      } else if (t < 0.62) {
        // Step 5: App Server discloses unique Push Token Key
        if (this.threatPacket) this.threatPacket.visible = false;
    if (this.exigentDemand) this.exigentDemand.visible = false;
        const p = this.arcLeoTokens.getPoint(seg(t, 0.48, 0.60));
        if (this.leoUniqueKeysGroup) {
          this.leoUniqueKeysGroup.visible = true;
          this.leoUniqueKeysGroup.position.copy(p);
          this.leoUniqueKeysGroup.lookAt(this.camera.position);
        }
        if (t < 0.60) {
          moverPos = p.clone().add(new THREE.Vector3(0, 4.2, 0));
          moverText = '🔑 Push Token Disclosed';
          moverCls = 'gold';
        } else {
          showLeoTokens = true;
          moverPos = null;
        }
      } else if (t < 0.76) {
        // Step 6: Police serve Production Orders with the Push Token to Apple APNs & Google FCM
        const p = this.arcLeoToAg.getPoint(seg(t, 0.62, 0.75));
        if (this.leoUniqueKeysGroup) {
          this.leoUniqueKeysGroup.visible = true;
          this.leoUniqueKeysGroup.position.copy(p);
          this.leoUniqueKeysGroup.lookAt(this.camera.position);
        }
        moverPos = p.clone().add(new THREE.Vector3(0, 4.5, 0));
        moverText = '🇨🇦 Order → Apple & Google';
        moverCls = 'cyan';
      } else if (t < 0.88) {
        // Step 7: Apple & Google return Subscriber Record (Photo ID + Residential Home)
        const p = this.arcLeoFromAg.getPoint(seg(t, 0.76, 0.86));
        if (this.leoSubscriberBundle) {
          this.leoSubscriberBundle.visible = true;
          this.leoSubscriberBundle.position.copy(p);
          // Keep house strictly LEVEL with ground (pitch=0, roll=0)
          this.leoSubscriberBundle.rotation.x = 0;
          this.leoSubscriberBundle.rotation.z = 0;
          const camDir = this.camera.position.clone().sub(p);
          this.leoSubscriberBundle.rotation.y = Math.atan2(camDir.x, camDir.z);
        }
        moverPos = p.clone().add(new THREE.Vector3(0, 6.5, 0));
        moverText = '🪪 Subscriber Record';
        moverCls = 'push';
      } else {
        // Step 8: BAD GUY'S IDENTITY REVEALED // POLICE SEIZURE!
        this.updateHackerSeizedScreen();
        if (this.leoSubscriberBundle) {
          this.leoSubscriberBundle.visible = true;
          // Floating above his computer desk (showing 3 objects: Credit Card + Photo ID + Architectural Home)
          this.leoSubscriberBundle.position.set(L.bandit.x - 1.5, 21.5, L.bandit.z - 1.0);
          // Remove rotate: front yard with tree faces forward toward user, level with ground!
          this.leoSubscriberBundle.rotation.set(0, 0, 0);
        }
        moverPos = new THREE.Vector3(L.bandit.x, 32.0, L.bandit.z);
        moverText = '🚨 Suspect Identified';
        moverCls = 'red';
        showLeoId = true;
      }

      // Suspect illumination:
      // Until ID'ed (t < 0.88): Menacing dark lighting, only hands, keyboard, and glasses shine!
      // Once ID'ed (t >= 0.88): Overhead interrogation spotlight turns ON brightly!
      if (this.hackerSpotlight) {
        if (t >= 0.88) {
          const idProg = clamp01((t - 0.88) / 0.04);
          this.hackerSpotlight.intensity = 6.5 * idProg;
          if (this.hackerGlassesMesh && this.hackerGlassesMesh.material) {
            this.hackerGlassesMesh.material.emissiveIntensity = 2.0 - 1.2 * idProg;
          }
          if (this.hackerBodyMeshes) {
            for (const bm of this.hackerBodyMeshes) {
              if (bm.userData && bm.userData.origColor) {
                bm.material.color.lerpColors(new THREE.Color(0x1a1a1f), bm.userData.origColor, idProg);
              }
            }
          }
        } else {
          this.hackerSpotlight.intensity = 0;
          if (this.hackerGlassesMesh && this.hackerGlassesMesh.material) {
            this.hackerGlassesMesh.material.emissiveIntensity = 2.0;
          }
          if (this.hackerBodyMeshes) {
            for (const bm of this.hackerBodyMeshes) {
              bm.material.color.setHex(0x1a1a1f);
            }
          }
        }
      }
    }

    if (!isLeo && this.hackerSpotlight) {
      this.hackerSpotlight.intensity = 0;
    }

    // Normal mode station labels (3 Unified Ground Nodes + World above Datacentre; hidden when flipped to Law Enforcement)
    const showNorm = !isLeo && this.flipRoll < Math.PI * 0.45;
    this.place('pin-store',  null, false);
    this.place('pin-post',   new THREE.Vector3(POS.post.x,   this.tops.post + 2, POS.post.z), showNorm);
    this.place('pin-phone',  new THREE.Vector3(POS.phone.x,  -1.5, POS.phone.z + 8), showNorm);
    this.place('pin-phone-os', new THREE.Vector3(POS.phone.x, this.tops.phone + 14.5, POS.phone.z), showNorm);
    this.place('pin-server', new THREE.Vector3(POS.server.x, -1.5, POS.server.z + 8), showNorm);
    this.place('pin-ufo',    new THREE.Vector3(POS.ufo.x,    POS.ufo.y + 17.5, POS.ufo.z), showNorm);

    // 3D App Icon Tiles stream in Mode 3 (no 2D HUD pills attached to them, keeping the HUD clean!)
    const showStims = showNorm && this.mode === 'world';
    if (this.worldStimGroup) this.worldStimGroup.visible = showStims;
    if (this.worldStimStreams) {
      for (const s of this.worldStimStreams) {
        this.place(s.id, null, false);
      }
    }

    // Law Enforcement station labels (visible when flipped upside down!)
    const showLeoPins = isLeo && this.flipRoll > Math.PI * 0.55;
    // Hacker node has zero floating HUD labels (sole focus is the 3D computer screen)
    this.place('pin-leo-bandit',      null, false);
    this.place('pin-leo-swat',        new THREE.Vector3(L.swat.x,   -1.5, L.swat.z + 10),  showLeoPins, this.leoGroup);
    this.place('pin-leo-bot',         new THREE.Vector3(L.bot.x,    -1.5, L.bot.z + 8),    showLeoPins, this.leoGroup);
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

    // Law Enforcement contextual callouts disabled to eliminate HUD creep
    this.place('pin-leo-threat', null, false);
    this.place('pin-leo-denied', null, false);
    this.place('pin-leo-tokens', null, false);
    this.place('pin-leo-id',     null, false);

    const mv = document.getElementById('pin-mover');
    mv.className = 'pin-mover' + (moverCls ? ' ' + moverCls : '');
    mv.textContent = moverText;
    this.place('pin-mover', moverPos ? moverPos.clone() : null, !!moverPos, moverParent);
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

  /* ---- Active Node Transit Detection (Origin Node, Destination Node, and Transit Arc) ---- */
  getActiveTransit(mode, t) {
    if (mode === 'setup') {
      if (t >= 0.18 && t <= 0.30) {
        return { origin: POS.post, dest: POS.phone, arc: this.arcStoreToPhone, name: 'storeToPhone' };
      }
      if (t >= 0.38 && t <= 0.48) {
        return { origin: POS.phone, dest: POS.post, arc: this.arcPhoneToPost, name: 'phoneToPost' };
      }
      if (t >= 0.60 && t <= 0.70) {
        return { origin: POS.post, dest: POS.phone, arc: this.arcPostToPhone, name: 'postToPhone' };
      }
      if (t >= 0.70 && t <= 0.82) {
        return { origin: POS.phone, dest: POS.server, arc: this.arcPhoneToServer, name: 'phoneToServer' };
      }
    } else if (mode === 'push') {
      if (t >= 0.28 && t <= 0.56) {
        return { origin: POS.ufo, dest: POS.post, arc: this.arcPushWorldToPost, name: 'worldToPost' };
      }
      if (t >= 0.78 && t <= 0.94) {
        return { origin: POS.post, dest: POS.phone, arc: this.arcPostToPhone, name: 'postToPhone' };
      }
    } else if (mode === 'leo') {
      const L = this.leoPos;
      if (!L) return null;
      if (t >= 0.09 && t <= 0.19) {
        return { origin: L.bandit, dest: L.swat, arc: this.arcLeoThreat, name: 'threatToRcmp' };
      }
      if (t >= 0.19 && t <= 0.28) {
        return { origin: L.swat, dest: L.proton, arc: this.arcLeoProton, name: 'rcmpToProton' };
      }
      if (t >= 0.32 && t <= 0.48) {
        return { origin: L.swat, dest: L.bot, arc: this.arcLeoToMeta, name: 'rcmpToMeta' };
      }
      if (t >= 0.48 && t <= 0.62) {
        return { origin: L.bot, dest: L.swat, arc: this.arcLeoTokens, name: 'metaToRcmp' };
      }
      if (t >= 0.62 && t <= 0.76) {
        return { origin: L.swat, dest: L.ag, arc: this.arcLeoToAg, name: 'rcmpToAg' };
      }
      if (t >= 0.76 && t <= 0.88) {
        return { origin: L.ag, dest: L.swat, arc: this.arcLeoFromAg, name: 'agToRcmp' };
      }
    }
    return null;
  }

  /* ---- Compute 3-Element Transit Framing (Origin Node, Destination Node, and Transit Arc) ---- */
  computeTransitRig(origin, dest, arc, isLeo) {
    if (!origin || !dest) return null;
    const mid = new THREE.Vector3().addVectors(origin, dest).multiplyScalar(0.5);

    // Sample arc peak so origin, destination, and the entire transit trajectory arc are framed simultaneously
    let peakLocalY = Math.max(origin.y, dest.y) + 15.0;
    if (arc && typeof arc.getPoint === 'function') {
      const midPoint = arc.getPoint(0.5);
      if (midPoint && midPoint.y !== undefined) {
        peakLocalY = Math.max(peakLocalY, midPoint.y);
      }
    }

    const chord = new THREE.Vector3().subVectors(dest, origin);
    const span = Math.hypot(chord.x, chord.z);
    let perp = new THREE.Vector3(-chord.z, 0, chord.x);
    if (perp.lengthSq() > 0.0001) {
      perp.normalize();
    } else {
      perp.set(0, 0, 1);
    }
    // Orient camera looking inward toward mid from the outside
    if (perp.dot(new THREE.Vector3(mid.x, 0, mid.z)) < 0) perp.negate();

    // In LEO mode, worldPivot rotation (PI) places underside stage at world Y = 29.0
    const worldYOffset = isLeo ? 29.0 : 0.0;
    const worldMinY = worldYOffset + Math.min(origin.y, dest.y);
    const worldMaxY = worldYOffset + peakLocalY;
    const targetY = (worldMinY + worldMaxY) * 0.5;
    const vertH = Math.max(18.0, worldMaxY - worldYOffset);

    const tanHalfFov = Math.tan((42 * Math.PI) / 360);
    const aspect = (this.camera && this.camera.aspect) || (window.innerWidth / window.innerHeight);
    const reqDistH = (span * 1.35) / (2 * tanHalfFov * aspect);
    const reqDistV = (vertH * 1.35) / (2 * tanHalfFov);
    const camDist = Math.max(reqDistH, reqDistV, isLeo ? 84.0 : 88.0);
    const camY = Math.max(isLeo ? 55.0 : 26.0, targetY + 6.0);

    const target = new THREE.Vector3(mid.x, targetY, mid.z);
    const cam = new THREE.Vector3(
      mid.x + perp.x * camDist,
      camY,
      mid.z + perp.z * camDist
    );

    return {
      angle: Math.atan2(cam.x, cam.z),
      radius: Math.hypot(cam.x, cam.z),
      cam,
      target
    };
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    // Smooth 180° upside-down world flip with EXCLUSIVE visibility (never see the other world!)
    this.flipRoll = smoothDamp(this.flipRoll, this.flipTarget, this.flipRollVel, 0.55, Infinity, dt);
    if (Math.abs(this.flipTarget - this.flipRoll) < 0.0005 && Math.abs(this.flipRollVel.v) < 0.001) {
      this.flipRoll = this.flipTarget;
      this.flipRollVel.v = 0;
    }
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

    // Switzerland illuminated server blade LEDs and telemetry laser scan
    if (this.swissLeds && this.leoGroup.visible) {
      const tSec = now * 0.001;
      for (const l of this.swissLeds) {
        l.mesh.visible = Math.sin(tSec * l.speed + l.phase) > -0.2;
      }
      if (this.swissScanBar) {
        this.swissScanBar.position.y = 2.0 + ((Math.sin(tSec * 2.8) * 0.5 + 0.5) * 18.0);
      }
    }

    if (this.leoAgBag && this.leoGroup.visible) this.leoAgBag.rotation.y += dt * 0.45;
    if (this.leoAgSubscriberMesh && this.leoGroup.visible && this.leoAgSubscriberMesh.visible) {
      this.leoAgSubscriberMesh.rotation.y -= dt * 0.6;
      this.leoAgSubscriberMesh.position.y = 16.0 + Math.sin(now * 0.003) * 0.4;
    }
    if (this.leoUniqueKeysGroup && this.leoUniqueKeysGroup.visible) {
      this.leoUniqueKeysGroup.lookAt(this.camera.position);
    }
    if (this.rejectShieldBubble && this.rejectShieldBubble.visible) {
      const s = 1 + Math.sin(now * 0.008) * 0.05;
      this.rejectShieldBubble.scale.setScalar(s);
      this.rejectShieldBubble.rotation.y = Math.sin(now * 0.003) * 0.08;
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

    if (this.cameraUnlocked) {
      // UNLOCKED CAMERA MODE:
      // Absolutely zero camera snapping or forced follow! Full free camera control.
      this.focusCamPos = null;
      this.focusTargetPos = null;
      this.cinematicFollow = false;
      this.cameraRig.disengage();
    } else if (this.focusTargetPos && this.focusCamPos) {
      // Smooth robotic arm arcing focus into clicked GLB model (no hard 0.3 snap cutoff!)
      this.cameraRig.engage(this.camera, this.controls.target);
      this.cameraRig.stepToCartesian(
        this.focusCamPos,
        this.focusTargetPos,
        0.50,
        dt,
        this.camera,
        this.controls.target
      );
      this.orbitAngle = this.cameraRig.theta;
      if (this.cameraRig.isSettled(this.focusCamPos, this.focusTargetPos, 0.02, 0.02)) {
        this.focusTargetPos = null;
        this.focusCamPos = null;
        this.cameraRig.disengage();
      }
    } else if (this.playing || this.cinematicFollow) {
      this.cameraRig.engage(this.camera, this.controls.target);
      const stops = MODE_STEPS[this.mode] || [0];
      const N = stops.length;
      const getRigForStep = (idx) => {
        const key = `${this.mode}_step_${idx}`;
        const r = (this.directorRigs && this.directorRigs[key]) || DEFAULT_DIRECTOR_RIGS[key];
        if (!r) return null;
        return {
          theta: r.angle !== undefined ? r.angle : Math.atan2(r.cam.x, r.cam.z),
          radius: r.radius !== undefined ? r.radius : Math.hypot(r.cam.x, r.cam.z),
          y: r.cam.y,
          tx: r.target.x,
          ty: r.target.y,
          tz: r.target.z
        };
      };

      let i = 0;
      for (let j = 0; j < N; j++) {
        if (this.t >= stops[j] - 0.001) i = j;
      }

      let targetTheta, targetRadius, targetY, targetLook;
      const rigCurr = getRigForStep(i);

      if (this.playing && N >= 2 && rigCurr) {
        // Continuous cylindrical Catmull-Rom spline across MODE_STEPS (zero per-stop halts & seamless 1 -> 0 wrap)
        const inWrapTail = this.t < stops[0];
        const segI = inWrapTail ? (N - 1) : i;
        const nextI = (segI + 1) % N;
        const prevI = (segI - 1 + N) % N;
        const next2I = (segI + 2) % N;
        const t0 = stops[segI];
        const t1 = nextI === 0 ? (1.0 + stops[0]) : stops[nextI];
        const tAdj = inWrapTail ? (this.t + 1.0) : this.t;
        const u = t1 > t0 ? clamp01((tAdj - t0) / (t1 - t0)) : 0;

        const r1 = getRigForStep(segI) || rigCurr;
        const r0 = getRigForStep(prevI) || r1;
        const r2 = getRigForStep(nextI) || r1;
        const r3 = getRigForStep(next2I) || r2;

        targetTheta = catmullRomAngle(r0.theta, r1.theta, r2.theta, r3.theta, u);
        targetRadius = Math.max(15, catmullRom(r0.radius, r1.radius, r2.radius, r3.radius, u));
        targetY = catmullRom(r0.y, r1.y, r2.y, r3.y, u);
        targetLook = new THREE.Vector3(
          catmullRom(r0.tx, r1.tx, r2.tx, r3.tx, u),
          catmullRom(r0.ty, r1.ty, r2.ty, r3.ty, u),
          catmullRom(r0.tz, r1.tz, r2.tz, r3.tz, u)
        );
      } else if (rigCurr) {
        const nextI = Math.min(N - 1, i + 1);
        const rigNext = getRigForStep(nextI) || rigCurr;
        if (i !== nextI) {
          const u = seg(this.t, stops[i], stops[nextI]);
          const diff = shortestAngleDiff(rigCurr.theta, rigNext.theta);
          targetTheta = rigCurr.theta + diff * u;
          targetRadius = rigCurr.radius + (rigNext.radius - rigCurr.radius) * u;
          targetY = rigCurr.y + (rigNext.y - rigCurr.y) * u;
          targetLook = new THREE.Vector3(
            rigCurr.tx + (rigNext.tx - rigCurr.tx) * u,
            rigCurr.ty + (rigNext.ty - rigCurr.ty) * u,
            rigCurr.tz + (rigNext.tz - rigCurr.tz) * u
          );
        } else {
          targetTheta = rigCurr.theta;
          targetRadius = rigCurr.radius;
          targetY = rigCurr.y;
          targetLook = new THREE.Vector3(rigCurr.tx, rigCurr.ty, rigCurr.tz);
        }
      } else {
        targetTheta = this.cameraRig.theta;
        targetRadius = this.cameraRig.radius;
        targetY = this.cameraRig.y;
        targetLook = this.controls.target.clone();
      }

      // Check for active node transit movement: automatically frame origin, destination, and transit arc!
      const transit = this.getActiveTransit(this.mode, this.t);
      if (transit && !this.directorMode) {
        const transitRig = this.computeTransitRig(transit.origin, transit.dest, transit.arc, this.mode === 'leo');
        if (transitRig) {
          targetTheta = transitRig.angle;
          targetRadius = transitRig.radius;
          targetY = transitRig.cam.y;
          targetLook = transitRig.target;
        }
      }

      if (this.mode === 'leo') {
        targetY = Math.max(50.0, targetY);
        targetLook.y = Math.max(40.0, targetLook.y);
      }

      const smoothTime = this.playing ? 0.35 : 0.60;
      this.cameraRig.stepToCylindrical(
        targetTheta,
        targetRadius,
        targetY,
        targetLook,
        smoothTime,
        dt,
        this.camera,
        this.controls.target
      );
      this.orbitAngle = this.cameraRig.theta;

      if (!this.playing && Math.abs(this.targetT - this.t) < 0.002) {
        const targetCamVec = new THREE.Vector3(
          Math.sin(targetTheta) * targetRadius,
          targetY,
          Math.cos(targetTheta) * targetRadius
        );
        if (this.cameraRig.isSettled(targetCamVec, targetLook, 0.02, 0.02)) {
          this.cinematicFollow = false;
          this.cameraRig.disengage();
        }
      }
    } else if (this.autoOrbit) {
      this.cameraRig.engage(this.camera, this.controls.target);
      this.orbitAngle += dt * 0.14;
      this.cameraRig.stepToCylindrical(
        this.orbitAngle,
        90.0,
        26.0,
        new THREE.Vector3(0, 18, 0),
        0.60,
        dt,
        this.camera,
        this.controls.target
      );
    } else {
      this.cameraRig.disengage();
    }

    // Animated moving dotted lines streaming smoothly along curves (zero arrows/cones!)
    const dashDelta = dt * 18.0;
    if (this.mode === 'setup' && this.setupLines) {
      for (const line of this.setupLines) {
        if (line && line.material) line.material.dashOffset -= dashDelta;
      }
    } else if (this.mode === 'push' && this.pushLines) {
      for (const line of this.pushLines) {
        if (line && line.material) line.material.dashOffset -= dashDelta;
      }
    } else if (this.mode === 'world' && this.worldStimStreams) {
      for (const s of this.worldStimStreams) {
        if (s.line && s.line.material) s.line.material.dashOffset -= dashDelta;
      }
    } else if (this.mode === 'leo' && this.leoLines) {
      for (const line of this.leoLines) {
        if (line && line.material && line.visible) line.material.dashOffset -= dashDelta;
      }
    }

    // Bomb threat message beacon: flashing emergency red warning light
    if (this.threatPacket && this.threatPacket.visible && this.threatPacket.userData) {
      const uData = this.threatPacket.userData;
      if (uData.pointLight) uData.pointLight.intensity = 4.0 + Math.sin(now * 0.025) * 3.0;
    }

    // Emergency siren beacon: high-speed rotation and dual red/blue emergency strobe flashing
    if (this.exigentDemand && this.exigentDemand.visible && this.exigentDemand.userData) {
      const uData = this.exigentDemand.userData;
      if (uData.rotor) uData.rotor.rotation.y += dt * 16.0;
      if (uData.redLight) uData.redLight.intensity = 3.5 + Math.sin(now * 0.022) * 2.5;
      if (uData.blueLight) uData.blueLight.intensity = 3.5 + Math.cos(now * 0.022) * 2.5;
    }

    // Live real-time flashing on hacker computer screen during Step 1
    if (this.mode === 'leo' && this.t < 0.22 && this.hackerScreenTex) {
      this.updateHackerEmailScreen(seg(this.t, 0, 0.12));
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
      // Always keep the Apple & Google logos facing directly towards the camera during orbit!
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

    if (!this.cameraRig.active) {
      this.controls.update();
    }
    this.updateState(dt);
    this.updateDirectorHUD();
    this.renderer.render(this.scene, this.camera);
  }
}

addEventListener('DOMContentLoaded', () => new PushnotOrbit());
