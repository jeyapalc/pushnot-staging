import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* =====================================================================
   PUSHNOT // Clean 3D Orbit
   Single continuous 0..1 timeline across 4 uncluttered beats:
     0.00–0.20  1. Install App on Phone
     0.20–0.45  2. Cloud creates Token -> Phone
     0.45–0.70  3. Phone registers Token -> Server
     0.70–1.00  4. Server -> Cloud -> Push Notification -> Phone
   ===================================================================== */

const R = 42; // orbit radius
const POS = {
  phone:  new THREE.Vector3( Math.cos(Math.PI / 6) * R, 0,  Math.sin(Math.PI / 6) * R), // front-right
  server: new THREE.Vector3(-Math.cos(Math.PI / 6) * R, 0,  Math.sin(Math.PI / 6) * R), // front-left
  cloud:  new THREE.Vector3(0, 22, -R)                                                   // back-top
};

const STEP_STOPS = [0.08, 0.34, 0.58, 0.88]; // click jumps to middle/peak of each beat
const LOOP_SECONDS = 14;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));

class PushnotOrbit {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.loader = new GLTFLoader();

    this.t = 0.08;
    this.playing = false;
    this.autoOrbit = true;
    this.orbitAngle = 0.25;
    this.lastFrame = performance.now();
    this.tops = { phone: 30, server: 36 };

    this.initScene();
    this.initLights();
    this.initOrbitRing();
    this.initCloud();
    this.initMovers();
    this.loadModels();
    this.initUI();
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05080f, 0.0038);

    this.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 1500);
    this.camera.position.set(28, 48, 118);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 14, 0);
    this.controls.minDistance = 45;
    this.controls.maxDistance = 240;
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
    this.scene.add(new THREE.AmbientLight(0xdbeafe, 1.1));
    const key = new THREE.DirectionalLight(0x38bdf8, 2.2); key.position.set(60, 110, 70); this.scene.add(key);
    const warm = new THREE.DirectionalLight(0xfbbf24, 1.4); warm.position.set(-70, 80, -40); this.scene.add(warm);
    const rim = new THREE.DirectionalLight(0x34d399, 1.2); rim.position.set(0, 40, -90); this.scene.add(rim);
  }

  initOrbitRing() {
    // Ground orbital ring
    const ringGeo = new THREE.TorusGeometry(R, 0.18, 12, 128);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.28 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    this.scene.add(ring);

    // Subtle outer halo ring
    const outer = new THREE.Mesh(
      new THREE.TorusGeometry(R + 10, 0.08, 8, 128),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.1 })
    );
    outer.rotation.x = Math.PI / 2;
    outer.position.y = 0.1;
    this.scene.add(outer);

    // Orbital arcs connecting Phone, Cloud, Server
    const pPhone  = POS.phone.clone().setY(16);
    const pServer = POS.server.clone().setY(18);
    const pCloud  = POS.cloud.clone();

    this.arcCloudToPhone = new THREE.QuadraticBezierCurve3(
      pCloud, new THREE.Vector3(36, 30, -14), pPhone
    );
    this.arcPhoneToServer = new THREE.QuadraticBezierCurve3(
      pPhone, new THREE.Vector3(0, 10, R + 10), pServer
    );
    this.arcServerToCloud = new THREE.QuadraticBezierCurve3(
      pServer, new THREE.Vector3(-36, 30, -14), pCloud
    );

    this.addArc(this.arcCloudToPhone, 0x34d399, 0.35);
    this.addArc(this.arcPhoneToServer, 0xfbbf24, 0.35);
    this.addArc(this.arcServerToCloud, 0x38bdf8, 0.35);

    // Subtle floating starfield
    const pts = [];
    for (let i = 0; i < 240; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = 55 + Math.random() * 140;
      pts.push(Math.cos(a) * rad, -10 + Math.random() * 90, Math.sin(a) * rad);
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
  }

  initCloud() {
    this.cloud = new THREE.Group();
    this.cloud.position.copy(POS.cloud);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(5.5, 2),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.7,
        wireframe: true
      })
    );
    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xe0f2fe })
    );
    const orbit1 = new THREE.Mesh(
      new THREE.TorusGeometry(8.5, 0.18, 10, 64),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 })
    );
    orbit1.rotation.x = Math.PI / 3;
    const orbit2 = new THREE.Mesh(
      new THREE.TorusGeometry(10.5, 0.12, 10, 64),
      new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.45 })
    );
    orbit2.rotation.y = Math.PI / 3;

    this.cloud.add(core, inner, orbit1, orbit2, new THREE.PointLight(0x38bdf8, 3, 45));
    this.cloudOrbit1 = orbit1;
    this.cloudOrbit2 = orbit2;
    this.scene.add(this.cloud);
  }

  initMovers() {
    // Token orb (amber)
    this.tokenOrb = new THREE.Group();
    this.tokenOrb.add(new THREE.Mesh(
      new THREE.OctahedronGeometry(2.2),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.9, metalness: 0.7, roughness: 0.2 })
    ));
    this.tokenOrb.add(new THREE.PointLight(0xfbbf24, 3, 28));
    this.scene.add(this.tokenOrb);

    // Push notification capsule (emerald)
    this.pushOrb = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 2.8, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x059669, emissiveIntensity: 0.85, metalness: 0.5, roughness: 0.25 })
    );
    this.pushOrb.add(box);
    this.pushOrb.add(new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: 0xffffff })));
    this.pushOrb.add(new THREE.PointLight(0x34d399, 3, 30));
    this.scene.add(this.pushOrb);

    // Install pulse ring around phone
    this.installRing = new THREE.Mesh(
      new THREE.TorusGeometry(11, 0.25, 10, 64),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 })
    );
    this.installRing.rotation.x = Math.PI / 2;
    this.installRing.position.set(POS.phone.x, 1, POS.phone.z);
    this.scene.add(this.installRing);
  }

  loadModels() {
    const status = document.getElementById('load-status');
    let left = 2;
    const done = () => { if (--left === 0) status.style.display = 'none'; };

    this.loader.load('models/data_center_rack.glb', (gltf) => {
      const rack = gltf.scene;
      rack.rotation.y = Math.PI / 3;
      this.tops.server = this.ground(rack, 36, POS.server);
      this.scene.add(rack);
      done();
    }, undefined, done);

    this.loader.load('models/generic_smartphone_game-ready.glb', (gltf) => {
      const phone = gltf.scene;
      phone.rotation.y = -Math.PI / 3;
      this.tops.phone = this.ground(phone, 30, POS.phone);
      this.scene.add(phone);
      done();
    }, undefined, done);
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

  /* ---------------- UI ---------------- */
  setAutoOrbit(on) {
    this.autoOrbit = on;
    const b = document.getElementById('btn-orbit');
    b.classList.toggle('on', on);
  }

  activeStepIndex() {
    if (this.t < 0.20) return 0;
    if (this.t < 0.45) return 1;
    if (this.t < 0.70) return 2;
    return 3;
  }

  jumpToStep(idx) {
    const i = (idx + 4) % 4;
    this.playing = false;
    this.t = STEP_STOPS[i];
  }

  initUI() {
    document.querySelectorAll('.step').forEach((btn) => {
      btn.addEventListener('click', () => this.jumpToStep(parseInt(btn.dataset.step, 10)));
    });
    document.getElementById('scrub').addEventListener('input', (e) => {
      this.playing = false;
      this.t = parseInt(e.target.value, 10) / 1000;
    });
    document.getElementById('btn-play').addEventListener('click', () => {
      this.playing = !this.playing;
      if (this.playing && this.t >= 0.99) this.t = 0;
    });
    document.getElementById('btn-prev').addEventListener('click', () => this.jumpToStep(this.activeStepIndex() - 1));
    document.getElementById('btn-next').addEventListener('click', () => this.jumpToStep(this.activeStepIndex() + 1));
    document.getElementById('btn-orbit').addEventListener('click', () => this.setAutoOrbit(!this.autoOrbit));
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    });

    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); this.playing = !this.playing; }
      else if (e.key === 'ArrowRight') this.jumpToStep(this.activeStepIndex() + 1);
      else if (e.key === 'ArrowLeft') this.jumpToStep(this.activeStepIndex() - 1);
      else if (e.key >= '1' && e.key <= '4') this.jumpToStep(parseInt(e.key, 10) - 1);
    });
  }

  /* ---------------- render state from t ---------------- */
  updateState(now) {
    const t = this.t;
    const step = this.activeStepIndex();

    // Update dock UI
    document.getElementById('scrub').value = Math.round(t * 1000);
    document.getElementById('btn-play').textContent = this.playing ? '❚❚' : '▶';
    document.querySelectorAll('.step').forEach((el, i) => el.classList.toggle('active', i === step));

    // 1. Install pulse (0.00 - 0.20)
    const isInstall = t < 0.20;
    this.installRing.visible = isInstall;
    if (isInstall) {
      const pulse = 1 + Math.sin(now * 0.005) * 0.14;
      this.installRing.scale.setScalar(pulse);
    }

    // 2. Token orb: Cloud -> Phone (0.20 - 0.42), then Phone -> Server (0.45 - 0.68)
    let moverPos = null;
    let moverText = '';
    let moverPush = false;

    this.tokenOrb.visible = false;
    this.pushOrb.visible = false;

    if (t >= 0.20 && t < 0.43) {
      const p = this.arcCloudToPhone.getPoint(seg(t, 0.20, 0.42));
      this.tokenOrb.visible = true;
      this.tokenOrb.position.copy(p);
      moverPos = p;
      moverText = '🔑 New Device Token';
    } else if (t >= 0.45 && t < 0.68) {
      const p = this.arcPhoneToServer.getPoint(seg(t, 0.45, 0.67));
      this.tokenOrb.visible = true;
      this.tokenOrb.position.copy(p);
      moverPos = p;
      moverText = '🔑 Register Token';
    } else if (t >= 0.70 && t < 0.96) {
      // Server -> Cloud (0.70 - 0.82), Cloud -> Phone (0.82 - 0.95)
      const p = t < 0.82
        ? this.arcServerToCloud.getPoint(seg(t, 0.70, 0.82))
        : this.arcCloudToPhone.getPoint(seg(t, 0.82, 0.95));
      this.pushOrb.visible = true;
      this.pushOrb.position.copy(p);
      moverPos = p;
      moverText = t < 0.82 ? '✉ Send to Cloud' : '✉ Push to Phone';
      moverPush = true;
    }

    // Project clean station tags
    this.place('pin-phone',  new THREE.Vector3(POS.phone.x,  -1.5, POS.phone.z + 8),  true);
    this.place('pin-server', new THREE.Vector3(POS.server.x, -1.5, POS.server.z + 8), true);
    this.place('pin-cloud',  new THREE.Vector3(POS.cloud.x, POS.cloud.y + 11, POS.cloud.z), true);

    // Project ONLY the single relevant contextual card for the current beat
    const phoneCardPos  = new THREE.Vector3(POS.phone.x,  this.tops.phone + 4,  POS.phone.z);
    const serverCardPos = new THREE.Vector3(POS.server.x, this.tops.server + 4, POS.server.z);

    this.place('pin-install', phoneCardPos,  t < 0.20);
    this.place('pin-token',   phoneCardPos,  t >= 0.40 && t < 0.50);
    this.place('pin-saved',   serverCardPos, t >= 0.65 && t < 0.74);
    this.place('pin-push',    phoneCardPos,  t >= 0.93);

    const mv = document.getElementById('pin-mover');
    mv.textContent = moverText;
    mv.classList.toggle('push', moverPush);
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
    const y = Math.max(76, Math.min(innerHeight - 132, (-p.y * 0.5 + 0.5) * innerHeight));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    if (this.playing) {
      this.t = (this.t + dt / LOOP_SECONDS) % 1;
    }

    if (this.autoOrbit) {
      this.orbitAngle += dt * 0.14;
      const camR = 116;
      this.camera.position.set(
        Math.sin(this.orbitAngle) * camR,
        46 + Math.sin(this.orbitAngle * 0.7) * 6,
        Math.cos(this.orbitAngle) * camR
      );
      this.controls.target.set(0, 14, 0);
    }

    this.cloud.rotation.y += dt * 0.5;
    this.cloudOrbit1.rotation.z += dt * 0.8;
    this.cloudOrbit2.rotation.x += dt * 0.6;
    this.tokenOrb.rotation.y += dt * 2.4;
    this.pushOrb.rotation.y = Math.sin(now * 0.003) * 0.35;
    this.stars.rotation.y += dt * 0.02;

    this.controls.update();
    this.updateState(now);
    this.renderer.render(this.scene, this.camera);
  }
}

addEventListener('DOMContentLoaded', () => new PushnotOrbit());
