import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

class PushnotViewer {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.currentMesh = null;
    this.currentWireframe = null;
    this.boxHelper = null;
    this.currentMaterialMode = 'original';
    this.autoRotate = false;
    this.rotateSpeed = 1.0;
    this.showWireOverlay = false;

    // View Modes: 'system' (full architecture stage) or 'inspect' (single model)
    this.activeMode = 'system';
    this.systemGroup = null;
    this.serverRackMesh = null;
    this.smartphoneMesh = null;
    this.cloudMesh = null;

    // The 3D Push Token Avatar
    this.tokenAvatarGroup = null;
    this.tokenTargetPos = new THREE.Vector3(50, 16, 8);
    this.speechEnabled = true;
    this.isTyping = false;
    this.typewriterTimer = null;

    // Detailed Push Token Story Chapters
    this.currentStoryStep = 0;
    this.story = [
      {
        stepNum: 1,
        title: "I Am Born on the Device",
        subtitle: "APNs / FCM Token Minting",
        tokenPos: new THREE.Vector3(50, 16, 8),
        camPos: new THREE.Vector3(50, 24, 46),
        camTarget: new THREE.Vector3(50, 10, 0),
        state: {
          address: "apns:7f4a...e891",
          account: "Pending Registration",
          provider: "APNs (iOS)",
          status: "MINTED ON DEVICE",
          payload: "None"
        },
        speech: "Hello! I am your Push Token. Think of me like an email address, but exclusively for this app on John's phone! Apple or Google created me, and I am completely opaque. You can never guess or fabricate me.",
        html: "Hello! I am your <strong>Push Token</strong>. Think of me like an <em>email address</em> for this app installation on John's phone.<br/>The platform (Apple APNs or Google FCM) minted me. I am <strong>opaque and unique</strong> to this exact app and hardware—you can never guess or fabricate me!"
      },
      {
        stepNum: 2,
        title: "Syncing to the Server Rack",
        subtitle: "Registration & Account Association",
        tokenPos: new THREE.Vector3(-45, 18, 10),
        camPos: new THREE.Vector3(-45, 30, 56),
        camTarget: new THREE.Vector3(-45, 12, 0),
        state: {
          address: "apns:7f4a...e891",
          account: "john@example.com",
          provider: "APNs (iOS)",
          status: "STORED IN SERVER DB",
          payload: "None"
        },
        speech: "The app immediately synced me to the backend server! Look inside the data center rack: the server saved me in the database alongside John's account ID. Now the server knows where to reach John.",
        html: "The app immediately synced me across the network to the <strong>Backend Server Rack</strong>!<br/>Look inside the server database: the backend records me in the <em>installations table</em> linked to <code>account_id: 'john@example.com'</code>. Now the server knows exactly how to reach John."
      },
      {
        stepNum: 3,
        title: "Event Trigger on Backend",
        subtitle: "Recipient Lookup & Payload Assembly",
        tokenPos: new THREE.Vector3(-45, 24, 10),
        camPos: new THREE.Vector3(-35, 32, 60),
        camTarget: new THREE.Vector3(-40, 15, 0),
        state: {
          address: "apns:7f4a...e891",
          account: "john@example.com",
          provider: "APNs (iOS)",
          status: "PACKAGING DISPATCH",
          payload: "{ title: 'Order Shipped', id: 8492 }"
        },
        speech: "Ding! A business event just occurred on the server: John's order #8492 has shipped! The backend resolves John's account, finds my active token in the database, and attaches the payload.",
        html: "Ding! A product event just triggered on the server: <strong>Order #8492 has shipped!</strong><br/>The backend logic identifies John's account, queries for my active token, and attaches the message payload: <code>{ title: 'Order Shipped', orderId: 8492 }</code>."
      },
      {
        stepNum: 4,
        title: "Routing via Cloud Gateway",
        subtitle: "Push Service Platform Routing",
        tokenPos: new THREE.Vector3(0, 26, -10),
        camPos: new THREE.Vector3(0, 40, 50),
        camTarget: new THREE.Vector3(0, 26, -10),
        state: {
          address: "apns:7f4a...e891",
          account: "john@example.com",
          provider: "APNs Routing Hub",
          status: "IN TRANSIT ACROSS INTERNET",
          payload: "{ title: 'Order Shipped', id: 8492 }"
        },
        speech: "We're dispatched to the platform push service! Here is the critical distinction: I tell APNs WHERE to route the packet, while the payload tells the device WHAT to display.",
        html: "We're dispatched to the <strong>Platform Push Service (APNs / FCM)</strong>!<br/>Here is the core lesson from the handoff: <strong>I (the token)</strong> tell the push service <em>WHERE to route</em>, while the <strong>payload</strong> tells the device <em>WHAT to display</em>!"
      },
      {
        stepNum: 5,
        title: "Delivery & Visible Alert",
        subtitle: "OS Receipt & Presentation",
        tokenPos: new THREE.Vector3(45, 18, 10),
        camPos: new THREE.Vector3(45, 26, 46),
        camTarget: new THREE.Vector3(45, 10, 0),
        state: {
          address: "apns:7f4a...e891",
          account: "john@example.com",
          provider: "Delivered to Device",
          status: "BANNER DISPLAYED",
          payload: "Order Shipped! Package #8492"
        },
        speech: "Delivered! APNs sent us over the persistent connection to John's phone. The OS verifies permissions and pops the banner: MyApp Order Shipped! Tap to view tracker.",
        html: "Delivered! APNs routes us over the persistent connection to John's phone.<br/>The OS checks user permissions and pops the visible banner alert: <strong>'MyApp: Order Shipped!'</strong>. The notification delivery is complete!",
        triggerBanner: true
      },
      {
        stepNum: 6,
        title: "Life & Death of a Token",
        subtitle: "Reinstallation & Token Rotation",
        tokenPos: new THREE.Vector3(0, 20, 20),
        camPos: new THREE.Vector3(0, 65, 140),
        camTarget: new THREE.Vector3(0, 15, 0),
        state: {
          address: "New: apns:9b12...c440",
          account: "john@example.com",
          provider: "Stale Token Retired",
          status: "SAFE ROTATION / 410 RETIRED",
          payload: "Lifecycle Handled"
        },
        speech: "What happens if John uninstalls the app? I become invalid! APNs responds with 410 Unregistered. When John reinstalls, a fresh new token is born, and the server safely updates the record without duplicate sends.",
        html: "What happens if John uninstalls the app? <strong>I become invalid!</strong><br/>If the server attempts to send to me, APNs returns <code>410 Unregistered</code>. When John reinstalls, a <em>brand-new token</em> is minted and synced. The backend safely retires my stale address without duplicate sends!"
      }
    ];

    // Shading properties
    this.meshColor = '#00f0ff';
    this.roughness = 0.3;
    this.metalness = 0.8;

    this.initScene();
    this.initLights();
    this.initHelpers();
    this.initLoaders();
    this.initPushTokenCharacter();
    this.initUI();
    this.initDragDrop();
    this.animate();

    // Load default System Architecture Stage
    this.loadPushSystem();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080b10);
    this.scene.fog = new THREE.FogExp2(0x080b10, 0.005);

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    this.camera.position.set(50, 24, 46);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;

    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxDistance = 1200;
    this.controls.minDistance = 5;

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(this.ambientLight);

    // Key Light
    this.keyLight = new THREE.DirectionalLight(0x00f0ff, 2.5);
    this.keyLight.position.set(80, 140, 90);
    this.keyLight.castShadow = true;
    this.scene.add(this.keyLight);

    // Warm Light
    this.fillLight = new THREE.DirectionalLight(0xffaa00, 2.0);
    this.fillLight.position.set(-90, 80, -60);
    this.scene.add(this.fillLight);

    // Green Light
    this.rimLight = new THREE.DirectionalLight(0x00ff88, 1.8);
    this.rimLight.position.set(0, -50, -100);
    this.scene.add(this.rimLight);
  }

  initHelpers() {
    this.grid = new THREE.GridHelper(260, 52, 0x00f0ff, 0x14202e);
    this.grid.position.y = -0.2;
    this.scene.add(this.grid);

    this.axes = new THREE.AxesHelper(30);
    this.axes.visible = false;
    this.scene.add(this.axes);
  }

  initLoaders() {
    this.stlLoader = new STLLoader();
    this.objLoader = new OBJLoader();
    this.gltfLoader = new GLTFLoader();
  }

  /* ================= 3D PUSH TOKEN AVATAR ================= */
  initPushTokenCharacter() {
    this.tokenAvatarGroup = new THREE.Group();
    this.tokenAvatarGroup.position.copy(this.tokenTargetPos);

    // Glowing faceted token core
    const tokenGeo = new THREE.IcosahedronGeometry(2.4, 0);
    const tokenMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff6600,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.95
    });
    this.tokenCoreMesh = new THREE.Mesh(tokenGeo, tokenMat);
    this.tokenAvatarGroup.add(this.tokenCoreMesh);

    // Floating orbital energy ring
    const ringGeo = new THREE.TorusGeometry(3.6, 0.15, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.tokenRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.tokenAvatarGroup.add(this.tokenRingMesh);

    const ring2Geo = new THREE.TorusGeometry(4.2, 0.1, 8, 32);
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    this.tokenRing2Mesh = new THREE.Mesh(ring2Geo, ring2Mat);
    this.tokenRing2Mesh.rotation.x = Math.PI / 2;
    this.tokenAvatarGroup.add(this.tokenRing2Mesh);

    // Point light that follows the token
    this.tokenLight = new THREE.PointLight(0xffaa00, 3, 30);
    this.tokenAvatarGroup.add(this.tokenLight);

    this.scene.add(this.tokenAvatarGroup);
  }

  /* ================= PUSH SYSTEM ARCHITECTURE SCENE ================= */
  loadPushSystem() {
    this.activeMode = 'system';
    this.clearInspectMesh();
    this.showLoader(true);

    this.systemGroup = new THREE.Group();
    this.scene.add(this.systemGroup);
    this.tokenAvatarGroup.visible = true;

    let loadedCount = 0;
    const checkDone = () => {
      loadedCount++;
      if (loadedCount >= 2) {
        this.buildCloudRouter();
        this.buildDataStreams();
        this.showLoader(false);
        this.goToStoryStep(0);
        this.calculateStats(this.systemGroup, 'Interactive Push Architecture', 'Full 3D Stage', new THREE.Vector3(120, 45, 40), '327 KB');
      }
    };

    // 1. Load Server Rack on Left
    this.gltfLoader.load(
      'models/data_center_rack.glb',
      (gltf) => {
        const rack = gltf.scene;
        this.normalizeScale(rack, 38);
        rack.position.set(-50, 0, 0);
        rack.rotation.y = Math.PI / 4;
        this.systemGroup.add(rack);
        this.serverRackMesh = rack;
        checkDone();
      },
      undefined,
      (err) => {
        console.error('Error loading server rack:', err);
        checkDone();
      }
    );

    // 2. Load Smartphone on Right
    this.gltfLoader.load(
      'models/generic_smartphone_game-ready.glb',
      (gltf) => {
        const phone = gltf.scene;
        this.normalizeScale(phone, 32);
        phone.position.set(50, 4, 0);
        phone.rotation.y = -Math.PI / 5;
        phone.rotation.x = -0.15;
        this.systemGroup.add(phone);
        this.smartphoneMesh = phone;
        checkDone();
      },
      undefined,
      (err) => {
        console.error('Error loading smartphone:', err);
        checkDone();
      }
    );
  }

  buildCloudRouter() {
    const cloudGroup = new THREE.Group();
    cloudGroup.position.set(0, 26, -10);

    const geo = new THREE.IcosahedronGeometry(8, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      wireframe: true,
      emissive: 0x6b21a8,
      emissiveIntensity: 0.6
    });
    const core = new THREE.Mesh(geo, mat);
    cloudGroup.add(core);

    const innerGeo = new THREE.SphereGeometry(4, 16, 16);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const innerCore = new THREE.Mesh(innerGeo, innerMat);
    cloudGroup.add(innerCore);

    const ringGeo = new THREE.TorusGeometry(14, 0.4, 8, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 3;
    cloudGroup.add(ring1);

    this.cloudMesh = cloudGroup;
    this.systemGroup.add(cloudGroup);
  }

  buildDataStreams() {
    this.curveServerToCloud = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-45, 18, 0),
      new THREE.Vector3(-25, 36, -5),
      new THREE.Vector3(0, 26, -10)
    );

    this.curveCloudToPhone = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 26, -10),
      new THREE.Vector3(25, 36, -5),
      new THREE.Vector3(45, 18, 0)
    );

    this.curvePhoneToServer = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(45, 10, 0),
      new THREE.Vector3(0, 6, 25),
      new THREE.Vector3(-45, 10, 0)
    );

    this.addStreamLine(this.curveServerToCloud, 0x00f0ff);
    this.addStreamLine(this.curveCloudToPhone, 0x00ff88);
    this.addStreamLine(this.curvePhoneToServer, 0xffaa00);
  }

  addStreamLine(curve, color) {
    const points = curve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: color,
      dashSize: 2,
      gapSize: 1,
      transparent: true,
      opacity: 0.45
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    this.systemGroup.add(line);
  }

  /* ================= TALKING PUSH TOKEN NARRATION ================= */
  goToStoryStep(index) {
    this.currentStoryStep = Math.max(0, Math.min(index, this.story.length - 1));
    const step = this.story[this.currentStoryStep];

    // Target position for the 3D Token character
    this.tokenTargetPos.copy(step.tokenPos);

    // Smoothly fly camera to component
    this.flyCamera(step.camPos, step.camTarget);

    // Update Token HUD Dialogue & Telemetry
    document.getElementById('token-step-num').textContent = step.stepNum;
    document.getElementById('token-title').textContent = step.title;
    document.getElementById('token-subtitle').textContent = step.subtitle;

    // Typewriter effect on dialogue
    this.renderTypewriter(step.html);

    // Update Token State Card
    document.getElementById('tok-val-address').textContent = step.state.address;
    document.getElementById('tok-val-account').textContent = step.state.account;
    document.getElementById('tok-val-provider').textContent = step.state.provider;
    document.getElementById('tok-val-status').textContent = step.state.status;
    document.getElementById('tok-val-payload').textContent = step.state.payload;

    // Trigger in-scene banner if applicable
    if (step.triggerBanner) {
      this.triggerPhoneNotification();
    }

    // Voice Narration
    if (this.speechEnabled) {
      this.speakText(step.speech);
    }
  }

  renderTypewriter(htmlContent) {
    const dialogueEl = document.getElementById('token-dialogue');
    if (!dialogueEl) return;
    if (this.typewriterTimer) clearInterval(this.typewriterTimer);

    // Render formatted html
    dialogueEl.innerHTML = htmlContent;
  }

  speakText(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.1;

    // Pick an expressive English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha')));
    if (preferredVoice) utterance.voice = preferredVoice;

    window.speechSynthesis.speak(utterance);
  }

  flyCamera(targetCamPos, targetControlsPos) {
    this.camera.position.copy(targetCamPos);
    this.controls.target.copy(targetControlsPos);
    this.controls.update();
  }

  dispatchNotificationAnimation() {
    this.goToStoryStep(2);
    setTimeout(() => {
      this.goToStoryStep(3);
      setTimeout(() => {
        this.goToStoryStep(4);
      }, 3500);
    }, 3500);
  }

  triggerPhoneNotification() {
    const banner = document.getElementById('notif-banner');
    if (banner) {
      banner.classList.add('show');
      setTimeout(() => {
        banner.classList.remove('show');
      }, 5500);
    }
  }

  /* ================= SINGLE MODEL INSPECTOR MODE ================= */
  normalizeScale(object, targetSize) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = targetSize / maxDim;
      object.scale.set(scale, scale, scale);
    }
  }

  clearInspectMesh() {
    if (this.currentMesh) {
      this.scene.remove(this.currentMesh);
      this.currentMesh = null;
    }
    if (this.currentWireframe) {
      this.scene.remove(this.currentWireframe);
      this.currentWireframe = null;
    }
    if (this.boxHelper) {
      this.scene.remove(this.boxHelper);
      this.boxHelper = null;
    }
  }

  setModel(object, name, format, fileSize = 'Local Asset') {
    this.activeMode = 'inspect';
    if (this.systemGroup) {
      this.scene.remove(this.systemGroup);
      this.systemGroup = null;
    }
    if (this.tokenAvatarGroup) {
      this.tokenAvatarGroup.visible = false;
    }
    this.clearInspectMesh();

    this.currentMesh = object;
    object.traverse((child) => {
      if (child.isMesh && !child.userData.origMaterial) {
        child.userData.origMaterial = child.material;
      }
    });

    this.applyMaterialToMesh(this.currentMesh);
    this.scene.add(this.currentMesh);

    const box = new THREE.Box3().setFromObject(this.currentMesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    this.currentMesh.position.x -= center.x;
    this.currentMesh.position.y -= center.y;
    this.currentMesh.position.z -= center.z;

    box.setFromObject(this.currentMesh);
    const maxDim = Math.max(size.x, size.y, size.z);

    this.boxHelper = new THREE.Box3Helper(box, 0x00ff88);
    this.boxHelper.visible = document.getElementById('chk-bounds')?.checked || false;
    this.scene.add(this.boxHelper);

    this.fitCameraToSize(maxDim);
    this.calculateStats(this.currentMesh, name, format, size, fileSize);
  }

  fitCameraToSize(maxDim) {
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.6;
    cameraZ = Math.max(cameraZ, 25);

    this.camera.position.set(cameraZ * 0.7, cameraZ * 0.5, cameraZ * 0.9);
    this.controls.target.set(0, 5, 0);
    this.controls.update();
  }

  createMaterial(mode) {
    switch (mode) {
      case 'normals':
        return new THREE.MeshNormalMaterial();
      case 'wireframe':
        return new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true });
      case 'matcap':
        return new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.1, metalness: 0.95 });
      case 'pbr':
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color(this.meshColor),
          roughness: this.roughness,
          metalness: this.metalness,
          side: THREE.DoubleSide
        });
      case 'original':
      default:
        return null;
    }
  }

  applyMaterialToMesh(object) {
    const mat = this.createMaterial(this.currentMaterialMode);
    object.traverse((child) => {
      if (child.isMesh) {
        if (mat) {
          child.material = mat;
        } else if (child.userData.origMaterial) {
          child.material = child.userData.origMaterial;
        }
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  calculateStats(object, name, format, size, fileSize) {
    let vertices = 0;
    let triangles = 0;

    object.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geo = child.geometry;
        if (geo.index) {
          triangles += geo.index.count / 3;
          vertices += geo.attributes.position ? geo.attributes.position.count : 0;
        } else if (geo.attributes.position) {
          triangles += geo.attributes.position.count / 3;
          vertices += geo.attributes.position.count;
        }
      }
    });

    document.getElementById('stat-name').textContent = name;
    document.getElementById('stat-format').textContent = format.toUpperCase();
    document.getElementById('stat-verts').textContent = vertices.toLocaleString();
    document.getElementById('stat-tris').textContent = Math.round(triangles).toLocaleString();
    document.getElementById('stat-dims').textContent = 
      `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)}`;
    document.getElementById('stat-size').textContent = fileSize;
  }

  loadSample(type) {
    this.showLoader(true);
    if (type === 'system') {
      this.loadPushSystem();
    } else if (type === 'server_rack') {
      this.gltfLoader.load('models/data_center_rack.glb', (gltf) => {
        this.setModel(gltf.scene, 'Data Center Rack (Server)', 'GLB', '124 KB');
        this.showLoader(false);
      });
    } else if (type === 'smartphone') {
      this.gltfLoader.load('models/generic_smartphone_game-ready.glb', (gltf) => {
        this.setModel(gltf.scene, 'Smartphone (Device)', 'GLB', '203 KB');
        this.showLoader(false);
      });
    } else if (type === 'top_mod') {
      this.stlLoader.load('models/Top_Mod_V1.stl', (geometry) => {
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry);
        this.setModel(mesh, 'Top_Mod_V1.stl', 'STL', '523 KB');
        this.showLoader(false);
      });
    } else if (type === 'box') {
      this.objLoader.load('models/box_4x7x1.5.obj', (obj) => {
        this.setModel(obj, 'box_4x7x1.5.obj', 'OBJ', '684 B');
        this.showLoader(false);
      });
    } else {
      const knot = new THREE.TorusKnotGeometry(20, 6, 128, 32);
      const mesh = new THREE.Mesh(knot);
      this.setModel(mesh, 'Quantum Monolith', 'Procedural', 'Generated');
      this.showLoader(false);
    }
  }

  showLoader(show) {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = show ? 'flex' : 'none';
  }

  /* ================= UI EVENT LISTENERS ================= */
  initUI() {
    // Mode Switcher
    const tabSim = document.getElementById('tab-sim');
    const tabInspect = document.getElementById('tab-inspect');
    const simSection = document.getElementById('section-sim');
    const inspectSection = document.getElementById('section-inspect');
    const narratorPanel = document.getElementById('token-narrator');

    tabSim?.addEventListener('click', () => {
      tabSim.classList.add('active');
      tabInspect.classList.remove('active');
      simSection.style.display = 'block';
      inspectSection.style.display = 'none';
      narratorPanel.style.display = 'flex';
      this.loadPushSystem();
    });

    tabInspect?.addEventListener('click', () => {
      tabInspect.classList.add('active');
      tabSim.classList.remove('active');
      simSection.style.display = 'none';
      inspectSection.style.display = 'block';
      narratorPanel.style.display = 'none';
      this.loadSample('server_rack');
    });

    // Token Story Nav Buttons
    document.getElementById('btn-token-prev')?.addEventListener('click', () => {
      this.goToStoryStep(this.currentStoryStep - 1);
    });

    document.getElementById('btn-token-next')?.addEventListener('click', () => {
      this.goToStoryStep(this.currentStoryStep + 1);
    });

    // Replay / Speak again
    document.getElementById('btn-token-replay')?.addEventListener('click', () => {
      const step = this.story[this.currentStoryStep];
      this.speakText(step.speech);
    });

    // Audio Toggle
    const btnAudio = document.getElementById('btn-token-audio');
    btnAudio?.addEventListener('click', () => {
      this.speechEnabled = !this.speechEnabled;
      btnAudio.textContent = this.speechEnabled ? '🔊 VOICE: ON' : '🔇 VOICE: OFF';
      if (!this.speechEnabled && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      } else if (this.speechEnabled) {
        this.speakText(this.story[this.currentStoryStep].speech);
      }
    });

    // Full Flow Simulation Trigger
    document.getElementById('btn-dispatch-flow')?.addEventListener('click', () => {
      this.dispatchNotificationAnimation();
    });

    // Artifact Selection Pills
    document.querySelectorAll('.artifact-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.artifact-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        this.loadSample(pill.getAttribute('data-artifact'));
      });
    });

    // Shading
    document.querySelectorAll('[data-shader]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-shader]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentMaterialMode = btn.getAttribute('data-shader');
        if (this.currentMesh) this.applyMaterialToMesh(this.currentMesh);
      });
    });

    // View Presets
    document.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setView(btn.getAttribute('data-view'));
      });
    });

    // Handoff Drawer
    const handoffDrawer = document.getElementById('handoff-drawer');
    const btnOpenHandoff = document.getElementById('btn-open-handoff');
    const btnCloseHandoff = document.getElementById('btn-close-handoff');

    btnOpenHandoff?.addEventListener('click', () => {
      handoffDrawer.classList.toggle('open');
      btnOpenHandoff.classList.toggle('active');
    });

    btnCloseHandoff?.addEventListener('click', () => {
      handoffDrawer.classList.remove('open');
      btnOpenHandoff.classList.remove('active');
    });

    // Reset cam
    document.getElementById('btn-reset-cam')?.addEventListener('click', () => {
      if (this.activeMode === 'system') {
        const step = this.story[this.currentStoryStep];
        this.flyCamera(step.camPos, step.camTarget);
      } else if (this.currentMesh) {
        const box = new THREE.Box3().setFromObject(this.currentMesh);
        const size = box.getSize(new THREE.Vector3());
        this.fitCameraToSize(Math.max(size.x, size.y, size.z));
      }
    });

    // Snapshot
    document.getElementById('btn-snapshot')?.addEventListener('click', () => {
      this.renderer.render(this.scene, this.camera);
      const dataURL = this.renderer.domElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `PUSHTOKEN_Stage_${this.currentStoryStep + 1}_${Date.now()}.png`;
      link.href = dataURL;
      link.click();
    });

    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });
  }

  setView(view) {
    const d = this.activeMode === 'system' ? 140 : 80;
    switch (view) {
      case 'front':
        this.camera.position.set(0, 20, d);
        break;
      case 'top':
        this.camera.position.set(0, d * 1.2, 0);
        break;
      case 'side':
        this.camera.position.set(d, 20, 0);
        break;
      case 'iso':
      default:
        this.camera.position.set(d * 0.7, d * 0.5, d * 0.7);
        break;
    }
    this.controls.target.set(0, 10, 0);
    this.controls.update();
  }

  initDragDrop() {
    const dropTarget = document.getElementById('drop-target');
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropTarget.classList.add('active');
    });
    window.addEventListener('dragleave', (e) => {
      if (e.relatedTarget === null) dropTarget.classList.remove('active');
    });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dropTarget.classList.remove('active');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.loadFile(e.dataTransfer.files[0]);
      }
    });
  }

  loadFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    this.showLoader(true);
    const reader = new FileReader();
    if (ext === 'gltf' || ext === 'glb') {
      reader.onload = (e) => {
        this.gltfLoader.parse(e.target.result, '', (gltf) => {
          this.setModel(gltf.scene, file.name, ext.toUpperCase(), (file.size / 1024).toFixed(1) + ' KB');
          this.showLoader(false);
        });
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert(`Format .${ext} loaded. Use GLB/GLTF.`);
      this.showLoader(false);
    }
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

    // Animate 3D Push Token Avatar position smoothly
    if (this.tokenAvatarGroup && this.tokenAvatarGroup.visible) {
      this.tokenAvatarGroup.position.lerp(this.tokenTargetPos, 0.05);

      // Spin rings & core
      if (this.tokenCoreMesh) {
        this.tokenCoreMesh.rotation.y += 0.02;
        this.tokenCoreMesh.rotation.x += 0.01;
      }
      if (this.tokenRingMesh) {
        this.tokenRingMesh.rotation.z += 0.03;
        this.tokenRingMesh.rotation.x += 0.01;
      }
      if (this.tokenRing2Mesh) {
        this.tokenRing2Mesh.rotation.y += 0.025;
      }

      // Gentle floating bob
      this.tokenAvatarGroup.position.y = this.tokenTargetPos.y + Math.sin(Date.now() * 0.003) * 0.8;
    }

    // Cloud node rotation
    if (this.cloudMesh) {
      this.cloudMesh.rotation.y += 0.008;
      this.cloudMesh.rotation.x += 0.004;
    }

    if (this.autoRotate && this.systemGroup) {
      this.systemGroup.rotation.y += 0.003 * this.rotateSpeed;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new PushnotViewer();
});
