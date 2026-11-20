import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/* =====================================================================
   PUSHNOT // 4-Station 3D Orbit with Polarity Switch
   Stations around ring (R = 46):
     App Store (UFO)          : back-right   (+32, 0, -32)
     Phone (Smartphone)       : front-right  (+32, 0, +32)
     App Server (Server Rack) : front-left   (-32, 0, +32)
     Post Office (Post Box)   : back-left    (-32, 0, -32)

   Two Polarity Modes (reverses orbital flow & purpose):
     'setup' (↺): App Store -> Phone -> Post Office -> App Server
     'push'  (↻): App Server -> Post Office -> Phone
   ===================================================================== */

const R = 46;
const D = Math.SQRT1_2 * R; // ~32.5
const POS = {
  store:  new THREE.Vector3( D, 0, -D), // UFO (App Store Gateway)
  phone:  new THREE.Vector3( D, 0,  D), // Smartphone
  server: new THREE.Vector3(-D, 0,  D), // Server Rack
  post:   new THREE.Vector3(-D, 0, -D)  // Edward VII Post Box (APNs/FCM)
};

const MODE_SECONDS = { setup: 11, push: 8 };
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));

class PushnotOrbit {
  constructor() {
    this.container = document.getElementById('canvas-container');

    this.loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
    this.loader.setDRACOLoader(draco);

    this.mode = 'setup'; // 'setup' | 'push'
    this.t = 0.0;
    this.playing = true;
    this.autoOrbit = true;
    this.orbitAngle = 0.35;
    this.lastFrame = performance.now();
    this.tops = { phone: 30, server: 36, post: 32, store: 34 };

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
    this.scene.fog = new THREE.FogExp2(0x05080f, 0.0032);

    this.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 1500);
    this.camera.position.set(42, 56, 128);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 14, 0);
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
    // Main luminous orbit ring (color shifts with polarity)
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.32 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.22, 12, 128), this.ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    this.scene.add(ring);

    // Subtle outer halo
    const outer = new THREE.Mesh(
      new THREE.TorusGeometry(R + 11, 0.08, 8, 128),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.12 })
    );
    outer.rotation.x = Math.PI / 2;
    outer.position.y = 0.1;
    this.scene.add(outer);

    // Polarity flow beads orbiting the ring to show flow direction visually
    this.flowBeads = [];
    this.beadMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const beadGeo = new THREE.ConeGeometry(0.9, 2.6, 8);
    beadGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(beadGeo, this.beadMat);
      this.scene.add(m);
      this.flowBeads.push({ mesh: m, baseAngle: (i / 12) * Math.PI * 2 });
    }

    // Elevated arcs between stations
    const pStore  = POS.store.clone().setY(22);
    const pPhone  = POS.phone.clone().setY(16);
    const pPost   = POS.post.clone().setY(18);
    const pServer = POS.server.clone().setY(18);

    // Setup arcs (Mode 1)
    this.arcStoreToPhone  = new THREE.QuadraticBezierCurve3(pStore,  new THREE.Vector3(R + 10, 28, 0),  pPhone);
    this.arcPostToPhone   = new THREE.QuadraticBezierCurve3(pPost,   new THREE.Vector3(0, 32, 0),       pPhone);
    this.arcPhoneToServer = new THREE.QuadraticBezierCurve3(pPhone,  new THREE.Vector3(0, 12, R + 12),  pServer);

    // Push arcs (Mode 2)
    this.arcServerToPost  = new THREE.QuadraticBezierCurve3(pServer, new THREE.Vector3(-R - 10, 28, 0), pPost);

    this.setupLines = [
      this.addArc(this.arcStoreToPhone,  0x38bdf8, 0.4),
      this.addArc(this.arcPostToPhone,   0xfbbf24, 0.35),
      this.addArc(this.arcPhoneToServer, 0xfbbf24, 0.4)
    ];
    this.pushLines = [
      this.addArc(this.arcServerToPost, 0x34d399, 0.45),
      this.addArc(this.arcPostToPhone,  0x34d399, 0.45)
    ];

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

  initMovers() {
    // App install cube (cyan)
    this.appOrb = new THREE.Group();
    this.appOrb.add(new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 2.8, 2.8),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.2 })
    ));
    this.appOrb.add(new THREE.PointLight(0x38bdf8, 3, 28));
    this.scene.add(this.appOrb);

    // Token octahedron (amber)
    this.tokenOrb = new THREE.Group();
    this.tokenOrb.add(new THREE.Mesh(
      new THREE.OctahedronGeometry(2.3),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.9, metalness: 0.7, roughness: 0.2 })
    ));
    this.tokenOrb.add(new THREE.PointLight(0xfbbf24, 3, 28));
    this.scene.add(this.tokenOrb);

    // Push envelope slab (emerald)
    this.pushOrb = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 2.8, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x059669, emissiveIntensity: 0.85, metalness: 0.5, roughness: 0.25 })
    );
    this.pushOrb.add(box);
    this.pushOrb.add(new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: 0xffffff })));
    this.pushOrb.add(new THREE.PointLight(0x34d399, 3, 30));
    this.scene.add(this.pushOrb);
  }

  loadModels() {
    const status = document.getElementById('load-status');
    let left = 4;
    const done = () => { if (--left <= 0) status.style.display = 'none'; };

    // 1. Server Rack (front-left)
    this.loader.load('models/data_center_rack.glb', (gltf) => {
      const rack = gltf.scene;
      rack.rotation.y = Math.PI * 0.25;
      this.tops.server = this.ground(rack, 34, POS.server);
      this.scene.add(rack);
      done();
    }, undefined, done);

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

    // 4. UFO — App Store Gateway (back-right)
    this.loader.load('models/ufo.glb', (gltf) => {
      this.ufoGroup = new THREE.Group();
      const ufo = gltf.scene;
      this.centerAndScale(ufo, 32);
      this.ufoGroup.add(ufo);

      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(10, 20, 32, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.14, side: THREE.DoubleSide })
      );
      beam.position.y = -11;
      this.ufoGroup.add(beam);

      this.ufoGroup.position.set(POS.store.x, 22, POS.store.z);
      this.tops.store = 33;
      this.scene.add(this.ufoGroup);
      done();
    }, undefined, done);
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

    // Update 3D ring & arcs polarity color/visibility
    const color = isPush ? 0x34d399 : 0xfbbf24;
    this.ringMat.color.setHex(color);
    this.beadMat.color.setHex(color);
    this.setupLines.forEach((l) => (l.visible = !isPush));
    this.pushLines.forEach((l) => (l.visible = isPush));

    // Update HUD polarity chrome
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
      ? 'App Server → Post Office → Phone'
      : 'App Store → Phone → Post Office → App Server';
  }

  setAutoOrbit(on) {
    this.autoOrbit = on;
    document.getElementById('btn-orbit').classList.toggle('on', on);
  }

  initUI() {
    document.getElementById('mode-setup').addEventListener('click', () => this.setMode('setup'));
    document.getElementById('mode-push').addEventListener('click', () => this.setMode('push'));
    document.getElementById('btn-flip').addEventListener('click', () => {
      this.setMode(this.mode === 'setup' ? 'push' : 'setup');
    });

    document.getElementById('scrub').addEventListener('input', (e) => {
      this.playing = false;
      this.t = parseInt(e.target.value, 10) / 1000;
    });
    document.getElementById('btn-play').addEventListener('click', () => {
      this.playing = !this.playing;
    });
    document.getElementById('btn-orbit').addEventListener('click', () => this.setAutoOrbit(!this.autoOrbit));
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    });

    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); this.playing = !this.playing; }
      else if (e.key === 'Tab') { e.preventDefault(); this.setMode(this.mode === 'setup' ? 'push' : 'setup'); }
      else if (e.key === '1') this.setMode('setup');
      else if (e.key === '2') this.setMode('push');
    });
  }

  /* ---------------- render state from (mode, t) ---------------- */
  updateState() {
    const t = this.t;
    document.getElementById('scrub').value = Math.round(t * 1000);
    document.getElementById('btn-play').textContent = this.playing ? '❚❚' : '▶';

    this.appOrb.visible = false;
    this.tokenOrb.visible = false;
    this.pushOrb.visible = false;

    let moverPos = null;
    let moverText = '';
    let moverCls = '';

    let showInstall = false;
    let showToken = false;
    let showSaved = false;
    let showPush = false;

    if (this.mode === 'setup') {
      // 0.00–0.28: App Store -> Phone (Install MyApp)
      // 0.28–0.38: Installed callout
      // 0.38–0.62: Post Office -> Phone (Mint Device Token)
      // 0.62–0.70: Token callout
      // 0.70–0.92: Phone -> App Server (Register Token)
      // 0.92–1.00: Saved callout
      if (t < 0.28) {
        const p = this.arcStoreToPhone.getPoint(seg(t, 0, 0.28));
        this.appOrb.visible = true;
        this.appOrb.position.copy(p);
        moverPos = p;
        moverText = '⬇ Installing MyApp';
        moverCls = 'cyan';
      } else if (t < 0.38) {
        showInstall = true;
      } else if (t < 0.62) {
        const p = this.arcPostToPhone.getPoint(seg(t, 0.38, 0.62));
        this.tokenOrb.visible = true;
        this.tokenOrb.position.copy(p);
        moverPos = p;
        moverText = '🔑 Mint Device Token';
      } else if (t < 0.70) {
        showToken = true;
      } else if (t < 0.92) {
        const p = this.arcPhoneToServer.getPoint(seg(t, 0.70, 0.92));
        this.tokenOrb.visible = true;
        this.tokenOrb.position.copy(p);
        moverPos = p;
        moverText = '🔑 Register to Server';
      } else {
        showSaved = true;
      }
    } else {
      // PUSH DELIVERY MODE (reversed polarity!)
      // 0.00–0.42: App Server -> Post Office (Send Payload + Token)
      // 0.42–0.84: Post Office -> Phone (Deliver Push Notification)
      // 0.84–1.00: Phone displays Order Shipped banner
      if (t < 0.42) {
        const p = this.arcServerToPost.getPoint(seg(t, 0, 0.42));
        this.pushOrb.visible = true;
        this.pushOrb.position.copy(p);
        moverPos = p;
        moverText = '✉ Payload + Token → Post Office';
        moverCls = 'push';
      } else if (t < 0.84) {
        const p = this.arcPostToPhone.getPoint(seg(t, 0.42, 0.84));
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
    this.place('pin-store',  new THREE.Vector3(POS.store.x,  this.tops.store + 2, POS.store.z), true);
    this.place('pin-post',   new THREE.Vector3(POS.post.x,   this.tops.post + 2,  POS.post.z),  true);
    this.place('pin-phone',  new THREE.Vector3(POS.phone.x,  -1.5, POS.phone.z + 8),  true);
    this.place('pin-server', new THREE.Vector3(POS.server.x, -1.5, POS.server.z + 8), true);

    // Contextual callouts (at most 1 visible at any instant)
    const phoneTop  = new THREE.Vector3(POS.phone.x,  this.tops.phone + 4,  POS.phone.z);
    const serverTop = new THREE.Vector3(POS.server.x, this.tops.server + 4, POS.server.z);
    this.place('pin-install', phoneTop,  showInstall);
    this.place('pin-token',   phoneTop,  showToken);
    this.place('pin-saved',   serverTop, showSaved);
    this.place('pin-push',    phoneTop,  showPush);

    const mv = document.getElementById('pin-mover');
    mv.className = 'pin pin-mover' + (moverCls ? ' ' + moverCls : '');
    mv.textContent = moverText;
    this.place('pin-mover', moverPos ? moverPos.clone().add(new THREE.Vector3(0, 4.2, 0)) : null, !!moverPos);
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
      const camR = 132;
      this.camera.position.set(
        Math.sin(this.orbitAngle) * camR,
        54 + Math.sin(this.orbitAngle * 0.7) * 6,
        Math.cos(this.orbitAngle) * camR
      );
      this.controls.target.set(0, 14, 0);
    }

    // Animate directional polarity cones around the orbit ring!
    // setup = clockwise/negative, push = reversed!
    const dir = this.mode === 'setup' ? 1 : -1;
    const phase = now * 0.00055 * dir;
    for (const b of this.flowBeads) {
      const a = b.baseAngle + phase;
      b.mesh.position.set(Math.cos(a) * R, 0.4, Math.sin(a) * R);
      // Tangent heading along the ring in the flow direction
      const nextA = a + 0.05 * dir;
      b.mesh.lookAt(Math.cos(nextA) * R, 0.4, Math.sin(nextA) * R);
    }

    if (this.ufoGroup) {
      this.ufoGroup.rotation.y += dt * 0.65;
      this.ufoGroup.position.y = 22 + Math.sin(now * 0.0025) * 1.6;
    }

    this.appOrb.rotation.y += dt * 2.0;
    this.appOrb.rotation.x += dt * 1.2;
    this.tokenOrb.rotation.y += dt * 2.5;
    this.pushOrb.rotation.y = Math.sin(now * 0.003) * 0.35;
    this.stars.rotation.y += dt * 0.015;

    this.controls.update();
    this.updateState();
    this.renderer.render(this.scene, this.camera);
  }
}

addEventListener('DOMContentLoaded', () => new PushnotOrbit());
