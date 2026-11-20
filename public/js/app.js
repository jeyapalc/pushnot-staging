import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

class PushnotSpeakerAid {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.gltfLoader = new GLTFLoader();

    // 3D Objects
    this.serverRack = null;
    this.smartphone = null;
    this.apnsNode = null;
    this.fcmNode = null;
    this.dataPacket = null;
    this.dataPacketLight = null;

    // State
    this.currentStage = 0;
    this.scrubberVal = 0.0;
    this.dualTokensVisible = false;
    this.isReinstalledState = false;

    // Stage Definitions
    this.stages = [
      {
        id: 0,
        name: "01: TOKEN MINT",
        caption: "STAGE 1 // DEVICE REQUESTS & PLATFORM MINTS UNIQUE DEVICE TOKEN",
        scrubber: 0.0,
        camPos: new THREE.Vector3(48, 22, 44),
        camTarget: new THREE.Vector3(48, 8, 0),
        dbHighlight: false,
        tokenInvalid: false,
        bannerVisible: false
      },
      {
        id: 1,
        name: "02: SYNC TO DB",
        caption: "STAGE 2 // APP SYNCS OPAQUE TOKEN TO SERVER DATABASE LINKED TO JOHN",
        scrubber: 0.33,
        camPos: new THREE.Vector3(-48, 28, 52),
        camTarget: new THREE.Vector3(-48, 12, 0),
        dbHighlight: true,
        tokenInvalid: false,
        bannerVisible: false
      },
      {
        id: 2,
        name: "03: EVENT TRIGGER",
        caption: "STAGE 3 // PRODUCT EVENT (ORDER SHIPPED) TRIGGERS ACTIVE DESTINATION LOOKUP",
        scrubber: 0.38,
        camPos: new THREE.Vector3(-48, 28, 52),
        camTarget: new THREE.Vector3(-48, 12, 0),
        dbHighlight: true,
        tokenInvalid: false,
        bannerVisible: false
      },
      {
        id: 3,
        name: "04: DISPATCH GATEWAY",
        caption: "STAGE 4 // AUTHENTICATED SEND ROUTED VIA PLATFORM GATEWAYS (APNs / FCM)",
        scrubber: 0.66,
        camPos: new THREE.Vector3(0, 36, 50),
        camTarget: new THREE.Vector3(0, 24, -10),
        dbHighlight: false,
        tokenInvalid: false,
        bannerVisible: false
      },
      {
        id: 4,
        name: "05: DEVICE RECEIPT",
        caption: "STAGE 5 // DEVICE RECEIVES PUSH OVER PERSISTENT CONNECTION & PRESENTS BANNER",
        scrubber: 1.0,
        camPos: new THREE.Vector3(48, 22, 44),
        camTarget: new THREE.Vector3(48, 8, 0),
        dbHighlight: false,
        tokenInvalid: false,
        bannerVisible: true
      },
      {
        id: 5,
        name: "06: REINSTALL / ROTATE",
        caption: "STAGE 6 // REINSTALLATION DETECTED: OLD TOKEN RETIRED (410), NEW TOKEN REGISTERED",
        scrubber: 0.0,
        camPos: new THREE.Vector3(0, 55, 120),
        camTarget: new THREE.Vector3(0, 10, 0),
        dbHighlight: true,
        tokenInvalid: true,
        bannerVisible: false
      }
    ];

    this.initScene();
    this.initLights();
    this.initGridAndCurves();
    this.initDataPacket();
    this.initGateways();
    this.loadHardwareModels();
    this.initUI();
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06080d);
    this.scene.fog = new THREE.FogExp2(0x06080d, 0.005);

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    this.camera.position.set(0, 55, 135);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;

    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambient);

    const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 2.5);
    dirLight1.position.set(60, 120, 80);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffaa00, 1.8);
    dirLight2.position.set(-80, 100, -50);
    this.scene.add(dirLight2);

    const dirLight3 = new THREE.DirectionalLight(0x00ff88, 1.5);
    dirLight3.position.set(0, -40, -80);
    this.scene.add(dirLight3);
  }

  initGridAndCurves() {
    // Tactical floor grid
    this.grid = new THREE.GridHelper(260, 52, 0x00f0ff, 0x111c2a);
    this.grid.position.y = -0.2;
    this.scene.add(this.grid);

    // Multi-segment 3D data pipeline curves
    // Curve A: Phone -> Server (Token Sync)
    this.curvePhoneToServer = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(48, 10, 0),
      new THREE.Vector3(0, 5, 24),
      new THREE.Vector3(-48, 12, 0)
    );

    // Curve B: Server -> Gateway (Authenticated Dispatch)
    this.curveServerToGateway = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-48, 18, 0),
      new THREE.Vector3(-25, 36, -5),
      new THREE.Vector3(0, 24, -10)
    );

    // Curve C: Gateway -> Phone (Delivery to Device)
    this.curveGatewayToPhone = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 24, -10),
      new THREE.Vector3(25, 36, -5),
      new THREE.Vector3(48, 16, 0)
    );

    this.renderPipelineLine(this.curvePhoneToServer, 0xffaa00);
    this.renderPipelineLine(this.curveServerToGateway, 0x00f0ff);
    this.renderPipelineLine(this.curveGatewayToPhone, 0x00ff88);
  }

  renderPipelineLine(curve, color) {
    const points = curve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: color,
      dashSize: 2.5,
      gapSize: 1.2,
      transparent: true,
      opacity: 0.5
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    this.scene.add(line);
  }

  /* ================= 3D HARDWARE ASSETS ================= */
  loadHardwareModels() {
    // 1. Server Rack (Backend)
    this.gltfLoader.load('models/data_center_rack.glb', (gltf) => {
      this.serverRack = gltf.scene;
      this.normalizeScale(this.serverRack, 38);
      this.serverRack.position.set(-48, 0, 0);
      this.serverRack.rotation.y = Math.PI / 4;
      this.scene.add(this.serverRack);
    });

    // 2. Smartphone (Client Device)
    this.gltfLoader.load('models/generic_smartphone_game-ready.glb', (gltf) => {
      this.smartphone = gltf.scene;
      this.normalizeScale(this.smartphone, 32);
      this.smartphone.position.set(48, 3.5, 0);
      this.smartphone.rotation.y = -Math.PI / 5;
      this.smartphone.rotation.x = -0.15;
      this.scene.add(this.smartphone);
    });
  }

  initGateways() {
    this.gatewaysGroup = new THREE.Group();
    this.gatewaysGroup.position.set(0, 24, -10);

    // APNs Hub (Left)
    this.apnsNode = this.createGatewayNode(0x00f0ff, "APNs (Apple)");
    this.apnsNode.position.set(-9, 0, 0);
    this.gatewaysGroup.add(this.apnsNode);

    // FCM Hub (Right)
    this.fcmNode = this.createGatewayNode(0xffaa00, "FCM (Google)");
    this.fcmNode.position.set(9, 0, 0);
    this.gatewaysGroup.add(this.fcmNode);

    this.scene.add(this.gatewaysGroup);
  }

  createGatewayNode(color, label) {
    const group = new THREE.Group();

    const geo = new THREE.IcosahedronGeometry(4.5, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      wireframe: true,
      emissive: color,
      emissiveIntensity: 0.5
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    const innerGeo = new THREE.SphereGeometry(2, 16, 16);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    group.add(inner);

    const ringGeo = new THREE.TorusGeometry(7, 0.25, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: color });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 3;
    group.add(ring);

    return group;
  }

  initDataPacket() {
    this.dataPacketGroup = new THREE.Group();

    const orbGeo = new THREE.SphereGeometry(2.2, 16, 16);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.9
    });
    this.dataPacket = new THREE.Mesh(orbGeo, orbMat);
    this.dataPacketGroup.add(this.dataPacket);

    const ringGeo = new THREE.TorusGeometry(3.6, 0.15, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    this.dataPacketRing = new THREE.Mesh(ringGeo, ringMat);
    this.dataPacketGroup.add(this.dataPacketRing);

    this.dataPacketLight = new THREE.PointLight(0x00f0ff, 3, 30);
    this.dataPacketGroup.add(this.dataPacketLight);

    // Initial position at Phone
    this.dataPacketGroup.position.set(48, 16, 0);
    this.scene.add(this.dataPacketGroup);
  }

  normalizeScale(object, targetSize) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = targetSize / maxDim;
      object.scale.set(scale, scale, scale);
    }
  }

  /* ================= SCRUBBER & STAGE CONTROLS ================= */
  setScrubberPosition(t) {
    this.scrubberVal = Math.max(0, Math.min(1, t));
    document.getElementById('chain-slider').value = Math.round(this.scrubberVal * 100);

    let pos;
    if (this.scrubberVal < 0.33) {
      // Phone -> Server
      const subT = this.scrubberVal / 0.33;
      pos = this.curvePhoneToServer.getPoint(subT);
      this.dataPacket.material.color.setHex(0xffaa00);
      this.dataPacket.material.emissive.setHex(0xff8800);
    } else if (this.scrubberVal < 0.66) {
      // Server -> Gateway
      const subT = (this.scrubberVal - 0.33) / 0.33;
      pos = this.curveServerToGateway.getPoint(subT);
      this.dataPacket.material.color.setHex(0x00f0ff);
      this.dataPacket.material.emissive.setHex(0x00aacc);
    } else {
      // Gateway -> Phone
      const subT = (this.scrubberVal - 0.66) / 0.34;
      pos = this.curveGatewayToPhone.getPoint(subT);
      this.dataPacket.material.color.setHex(0x00ff88);
      this.dataPacket.material.emissive.setHex(0x00cc66);
    }

    if (pos) {
      this.dataPacketGroup.position.copy(pos);
    }
  }

  goToStage(stageIndex) {
    this.currentStage = (stageIndex + this.stages.length) % this.stages.length;
    const stage = this.stages[this.currentStage];

    // Update Stage Buttons UI
    document.querySelectorAll('.btn-stage').forEach((b, i) => {
      b.classList.toggle('active', i === this.currentStage);
    });

    // Caption
    document.getElementById('stage-caption-text').textContent = stage.caption;

    // Scrubber position
    this.setScrubberPosition(stage.scrubber);

    // Camera move
    this.flyCamera(stage.camPos, stage.camTarget);

    // Database Highlight
    const dbRow = document.getElementById('db-row-john');
    if (dbRow) {
      dbRow.className = stage.dbHighlight ? 'db-row-active' : '';
    }

    // Token Card States
    const tokenCardA = document.getElementById('token-card-a');
    if (tokenCardA) {
      if (stage.tokenInvalid) {
        tokenCardA.className = 'holo-token-card token-invalid';
        document.getElementById('tok-a-badge').textContent = '❌ EXPIRED / 410 UNREGISTERED';
        document.getElementById('tok-a-badge').className = 'token-badge token-badge-pink';
        document.getElementById('db-row-status').textContent = 'ROTATED (410)';
      } else {
        tokenCardA.className = 'holo-token-card';
        document.getElementById('tok-a-badge').textContent = '● ACTIVE DEVICE TOKEN';
        document.getElementById('tok-a-badge').className = 'token-badge token-badge-amber';
        document.getElementById('db-row-status').textContent = 'ACTIVE';
      }
    }

    // Banner visibility
    const banner = document.getElementById('holo-alert-banner');
    if (banner) {
      banner.style.display = stage.bannerVisible ? 'flex' : 'none';
    }
  }

  flyCamera(targetCamPos, targetControlsPos) {
    this.camera.position.copy(targetCamPos);
    this.controls.target.copy(targetControlsPos);
    this.controls.update();
  }

  fireFullSendAnimation() {
    let t = 0;
    const interval = setInterval(() => {
      t += 0.015;
      if (t >= 1) {
        this.setScrubberPosition(1.0);
        this.goToStage(4);
        clearInterval(interval);
      } else {
        this.setScrubberPosition(t);
      }
    }, 20);
  }

  toggleDualTokens() {
    this.dualTokensVisible = !this.dualTokensVisible;
    const tokenB = document.getElementById('token-card-b');
    if (tokenB) {
      tokenB.style.display = this.dualTokensVisible ? 'flex' : 'none';
    }
    const btn = document.getElementById('btn-toggle-dual');
    if (btn) {
      btn.textContent = this.dualTokensVisible ? '📱 HIDE 2ND APP TOKEN' : '📱 SHOW 2ND APP TOKEN';
    }
  }

  /* ================= 2D HOLOGRAPHIC OVERLAY PROJECTION ================= */
  updateHolographicOverlays() {
    // 1. Phone Token Card A (Position: 48, 20, 0)
    this.projectToScreen(new THREE.Vector3(48, 16, 4), 'token-card-a');

    // 2. Phone Token Card B (Position: 48, 24, 0)
    if (this.dualTokensVisible) {
      this.projectToScreen(new THREE.Vector3(48, 23, 4), 'token-card-b');
    }

    // 3. Server Database Panel (Position: -48, 22, 0)
    this.projectToScreen(new THREE.Vector3(-48, 20, 0), 'holo-db-panel');

    // 4. Notification Alert Banner (Position: 48, 14, 8)
    this.projectToScreen(new THREE.Vector3(48, 14, 6), 'holo-alert-banner');
  }

  projectToScreen(worldPos, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const screenPos = worldPos.clone().project(this.camera);

    // Behind camera check
    if (screenPos.z > 1) {
      el.style.opacity = '0';
      return;
    }

    const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.opacity = '1';
  }

  initUI() {
    // Scrubber
    const slider = document.getElementById('chain-slider');
    slider?.addEventListener('input', (e) => {
      this.setScrubberPosition(parseFloat(e.target.value) / 100);
    });

    // Stage buttons
    document.querySelectorAll('.btn-stage').forEach((btn, idx) => {
      btn.addEventListener('click', () => this.goToStage(idx));
    });

    // Navigation buttons
    document.getElementById('btn-deck-prev')?.addEventListener('click', () => {
      this.goToStage(this.currentStage - 1);
    });
    document.getElementById('btn-deck-next')?.addEventListener('click', () => {
      this.goToStage(this.currentStage + 1);
    });

    // Action buttons
    document.getElementById('btn-fire-send')?.addEventListener('click', () => {
      this.fireFullSendAnimation();
    });

    document.getElementById('btn-toggle-dual')?.addEventListener('click', () => {
      this.toggleDualTokens();
    });

    document.getElementById('btn-reinstall-token')?.addEventListener('click', () => {
      this.goToStage(5);
    });

    // Camera preset buttons
    document.querySelectorAll('[data-cam]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-cam]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-cam');
        if (mode === 'wide') this.flyCamera(new THREE.Vector3(0, 55, 135), new THREE.Vector3(0, 10, 0));
        if (mode === 'phone') this.flyCamera(new THREE.Vector3(48, 22, 44), new THREE.Vector3(48, 8, 0));
        if (mode === 'server') this.flyCamera(new THREE.Vector3(-48, 28, 52), new THREE.Vector3(-48, 12, 0));
        if (mode === 'gateway') this.flyCamera(new THREE.Vector3(0, 36, 50), new THREE.Vector3(0, 24, -10));
      });
    });

    // Keyboard Hotkeys
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') this.goToStage(this.currentStage + 1);
      if (e.key === 'ArrowLeft') this.goToStage(this.currentStage - 1);
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        this.fireFullSendAnimation();
      }
      if (e.key >= '1' && e.key <= '6') {
        this.goToStage(parseInt(e.key) - 1);
      }
    });

    // Fullscreen
    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    });
  }

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Rotate Gateway Nodes
    if (this.apnsNode) {
      this.apnsNode.rotation.y += 0.015;
      this.apnsNode.rotation.x += 0.008;
    }
    if (this.fcmNode) {
      this.fcmNode.rotation.y -= 0.015;
      this.fcmNode.rotation.z += 0.008;
    }

    // Spin data packet rings
    if (this.dataPacketRing) {
      this.dataPacketRing.rotation.z += 0.04;
      this.dataPacketRing.rotation.x += 0.02;
    }

    this.controls.update();
    this.updateHolographicOverlays();
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new PushnotSpeakerAid();
});
