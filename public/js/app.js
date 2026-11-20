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
    this.particles = [];
    this.activeParticlePacks = [];

    // Explanation Steps
    this.currentStepIndex = 0;
    this.steps = [
      {
        badge: 'STAGE 01 // REGISTRATION',
        title: 'Platform Token & Association',
        desc: 'App requests a device token from Apple (APNs) or Google (FCM). The platform returns an opaque address. The app then syncs this token with its backend along with John’s account ID.',
        focus: 'phone'
      },
      {
        badge: 'STAGE 02 // EVENT TRIGGER',
        title: 'Backend Event & Recipient Lookup',
        desc: 'A business event occurs (e.g. Order Shipped for John). The backend queries its Users/Installations table to find active device tokens associated with John’s account.',
        focus: 'server'
      },
      {
        badge: 'STAGE 03 // PROVIDER DISPATCH',
        title: 'Authenticated Request to Push Service',
        desc: 'The backend formats the payload and makes an authenticated request to the push service (FCM for Android, APNs for iOS). The push service returns an acceptance receipt.',
        focus: 'cloud'
      },
      {
        badge: 'STAGE 04 // DEVICE DELIVERY',
        title: 'Routing & Visible Presentation',
        desc: 'The push service routes the message to the registered device over its persistent connection. The OS inspects permissions and displays the banner alert.',
        focus: 'phone'
      },
      {
        badge: 'STAGE 05 // LIFECYCLE & ROTATION',
        title: 'Reinstallation & Token Refresh',
        desc: 'When an app is reinstalled or tokens rotate, the app syncs the new token. Old tokens receiving 410 Unregistered are deactivated while preserving the active installation.',
        focus: 'overview'
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
    this.camera.position.set(0, 70, 150);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;

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

    // Fill Light (Warm Purple/Amber)
    this.fillLight = new THREE.DirectionalLight(0xa855f7, 2.0);
    this.fillLight.position.set(-90, 80, -60);
    this.scene.add(this.fillLight);

    // Rim Light (Matrix Green)
    this.rimLight = new THREE.DirectionalLight(0x00ff88, 1.8);
    this.rimLight.position.set(0, -50, -100);
    this.scene.add(this.rimLight);
  }

  initHelpers() {
    // Cyberpunk grid
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

  /* ================= PUSH SYSTEM ARCHITECTURE SCENE ================= */
  loadPushSystem() {
    this.activeMode = 'system';
    this.clearCurrentMesh();
    this.showLoader(true);

    this.systemGroup = new THREE.Group();
    this.scene.add(this.systemGroup);

    let loadedCount = 0;
    const checkDone = () => {
      loadedCount++;
      if (loadedCount >= 2) {
        this.buildCloudRouter();
        this.buildDataStreams();
        this.fitCameraToSize(140);
        this.showLoader(false);
        this.updateStepUI();
        this.calculateStats(this.systemGroup, 'Push Notification Pipeline', 'Full 3D Stage', new THREE.Vector3(120, 45, 40), '327 KB');
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

    // Outer geometric polyhedral node
    const geo = new THREE.IcosahedronGeometry(8, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      wireframe: true,
      emissive: 0x6b21a8,
      emissiveIntensity: 0.6
    });
    const core = new THREE.Mesh(geo, mat);
    cloudGroup.add(core);

    // Inner glowing core
    const innerGeo = new THREE.SphereGeometry(4, 16, 16);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const innerCore = new THREE.Mesh(innerGeo, innerMat);
    cloudGroup.add(innerCore);

    // Orbiting rings
    const ringGeo = new THREE.TorusGeometry(14, 0.4, 8, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 3;
    cloudGroup.add(ring1);

    const ring2 = new THREE.Mesh(ringGeo, ringMat.clone());
    ring2.rotation.y = Math.PI / 3;
    cloudGroup.add(ring2);

    this.cloudMesh = cloudGroup;
    this.systemGroup.add(cloudGroup);
  }

  buildDataStreams() {
    // Curve 1: Server -> Cloud (Left to Center)
    this.curveServerToCloud = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-45, 18, 0),
      new THREE.Vector3(-25, 36, -5),
      new THREE.Vector3(0, 26, -10)
    );

    // Curve 2: Cloud -> Phone (Center to Right)
    this.curveCloudToPhone = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 26, -10),
      new THREE.Vector3(25, 36, -5),
      new THREE.Vector3(45, 18, 0)
    );

    // Curve 3: Phone -> Server Direct Token Registration
    this.curvePhoneToServer = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(45, 10, 0),
      new THREE.Vector3(0, 6, 25),
      new THREE.Vector3(-45, 10, 0)
    );

    this.addStreamLine(this.curveServerToCloud, 0x00f0ff);
    this.addStreamLine(this.curveCloudToPhone, 0x00ff88);
    this.addStreamLine(this.curvePhoneToServer, 0xa855f7);
  }

  addStreamLine(curve, color) {
    const points = curve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: color,
      dashSize: 2,
      gapSize: 1,
      transparent: true,
      opacity: 0.5
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    this.systemGroup.add(line);
  }

  dispatchNotificationAnimation() {
    // Create animated particle packet traveling Server -> Cloud -> Phone
    const packetGeo = new THREE.SphereGeometry(1.6, 16, 16);
    const packetMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const packet = new THREE.Mesh(packetGeo, packetMat);
    this.scene.add(packet);

    let progress = 0;
    const speed = 0.012;

    const animatePacket = () => {
      progress += speed;
      if (progress < 0.5) {
        const t = progress * 2;
        const pos = this.curveServerToCloud.getPoint(t);
        packet.position.copy(pos);
        packetMat.color.setHex(0x00f0ff);
      } else if (progress <= 1.0) {
        const t = (progress - 0.5) * 2;
        const pos = this.curveCloudToPhone.getPoint(t);
        packet.position.copy(pos);
        packetMat.color.setHex(0x00ff88);
      } else {
        this.scene.remove(packet);
        this.triggerPhoneNotification();
        return;
      }
      requestAnimationFrame(animatePacket);
    };

    animatePacket();
  }

  triggerPhoneNotification() {
    const banner = document.getElementById('notif-banner');
    if (banner) {
      banner.classList.add('show');
      setTimeout(() => {
        banner.classList.remove('show');
      }, 5000);
    }
  }

  updateStepUI() {
    const step = this.steps[this.currentStepIndex];
    document.getElementById('step-badge').textContent = step.badge;
    document.getElementById('step-title').textContent = step.title;
    document.getElementById('step-desc').textContent = step.desc;

    // Focus camera according to step
    if (this.activeMode === 'system') {
      if (step.focus === 'phone') {
        this.tweenCameraTo(new THREE.Vector3(50, 20, 45), new THREE.Vector3(50, 10, 0));
      } else if (step.focus === 'server') {
        this.tweenCameraTo(new THREE.Vector3(-50, 25, 55), new THREE.Vector3(-50, 15, 0));
      } else if (step.focus === 'cloud') {
        this.tweenCameraTo(new THREE.Vector3(0, 35, 50), new THREE.Vector3(0, 26, -10));
      } else {
        this.tweenCameraTo(new THREE.Vector3(0, 70, 150), new THREE.Vector3(0, 10, 0));
      }
    }
  }

  tweenCameraTo(targetCamPos, targetControlsPos) {
    this.camera.position.copy(targetCamPos);
    this.controls.target.copy(targetControlsPos);
    this.controls.update();
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

  clearCurrentMesh() {
    if (this.systemGroup) {
      this.scene.remove(this.systemGroup);
      this.systemGroup = null;
    }
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
    this.clearCurrentMesh();

    this.currentMesh = object;

    // Cache original materials
    object.traverse((child) => {
      if (child.isMesh && !child.userData.origMaterial) {
        child.userData.origMaterial = child.material;
      }
    });

    this.applyMaterialToMesh(this.currentMesh);
    this.scene.add(this.currentMesh);

    // Compute bounding box and center geometry
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
    this.updateWireframeOverlay();
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
        return new THREE.MeshStandardMaterial({
          color: 0xdddddd,
          roughness: 0.1,
          metalness: 0.95
        });
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

  updateWireframeOverlay() {
    if (this.currentWireframe) {
      this.scene.remove(this.currentWireframe);
      this.currentWireframe = null;
    }

    if (this.showWireOverlay && this.currentMesh) {
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.25
      });

      const clone = this.currentMesh.clone();
      clone.traverse((child) => {
        if (child.isMesh) child.material = wireMat;
      });
      this.currentWireframe = clone;
      this.scene.add(this.currentWireframe);
    }
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
      this.gltfLoader.load(
        'models/data_center_rack.glb',
        (gltf) => {
          this.setModel(gltf.scene, 'Data Center Rack (Server)', 'GLB', '124 KB');
          this.showLoader(false);
        },
        undefined,
        () => this.showLoader(false)
      );
    } else if (type === 'smartphone') {
      this.gltfLoader.load(
        'models/generic_smartphone_game-ready.glb',
        (gltf) => {
          this.setModel(gltf.scene, 'Smartphone (Device)', 'GLB', '203 KB');
          this.showLoader(false);
        },
        undefined,
        () => this.showLoader(false)
      );
    } else if (type === 'top_mod') {
      this.stlLoader.load(
        'models/Top_Mod_V1.stl',
        (geometry) => {
          geometry.computeVertexNormals();
          const mesh = new THREE.Mesh(geometry);
          this.setModel(mesh, 'Top_Mod_V1.stl', 'STL', '523 KB');
          this.showLoader(false);
        },
        undefined,
        () => this.showLoader(false)
      );
    } else if (type === 'box') {
      this.objLoader.load(
        'models/box_4x7x1.5.obj',
        (obj) => {
          this.setModel(obj, 'box_4x7x1.5.obj', 'OBJ', '684 B');
          this.showLoader(false);
        },
        undefined,
        () => this.showLoader(false)
      );
    } else {
      const knot = new THREE.TorusKnotGeometry(20, 6, 128, 32);
      const mesh = new THREE.Mesh(knot);
      this.setModel(mesh, 'Quantum Monolith', 'Procedural', 'Generated');
      this.showLoader(false);
    }
  }

  loadFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    this.showLoader(true);

    const reader = new FileReader();
    if (ext === 'stl') {
      reader.onload = (e) => {
        try {
          const geometry = this.stlLoader.parse(e.target.result);
          geometry.computeVertexNormals();
          const mesh = new THREE.Mesh(geometry);
          this.setModel(mesh, file.name, 'STL', sizeStr);
        } catch (err) {
          alert('Error parsing STL: ' + err.message);
        } finally {
          this.showLoader(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'obj') {
      reader.onload = (e) => {
        try {
          const obj = this.objLoader.parse(e.target.result);
          this.setModel(obj, file.name, 'OBJ', sizeStr);
        } catch (err) {
          alert('Error parsing OBJ: ' + err.message);
        } finally {
          this.showLoader(false);
        }
      };
      reader.readAsText(file);
    } else if (ext === 'gltf' || ext === 'glb') {
      reader.onload = (e) => {
        this.gltfLoader.parse(
          e.target.result,
          '',
          (gltf) => {
            this.setModel(gltf.scene, file.name, ext.toUpperCase(), sizeStr);
            this.showLoader(false);
          },
          (err) => {
            alert('Error parsing GLTF: ' + err.message);
            this.showLoader(false);
          }
        );
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert(`Unsupported format: .${ext}`);
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

    tabSim?.addEventListener('click', () => {
      tabSim.classList.add('active');
      tabInspect.classList.remove('active');
      simSection.style.display = 'block';
      inspectSection.style.display = 'none';
      this.loadPushSystem();
    });

    tabInspect?.addEventListener('click', () => {
      tabInspect.classList.add('active');
      tabSim.classList.remove('active');
      simSection.style.display = 'none';
      inspectSection.style.display = 'block';
      this.loadSample('server_rack');
    });

    // Explainer Stepper Buttons
    document.getElementById('btn-prev-step')?.addEventListener('click', () => {
      this.currentStepIndex = (this.currentStepIndex - 1 + this.steps.length) % this.steps.length;
      this.updateStepUI();
    });

    document.getElementById('btn-next-step')?.addEventListener('click', () => {
      this.currentStepIndex = (this.currentStepIndex + 1) % this.steps.length;
      this.updateStepUI();
    });

    // Simulate Push Dispatch
    document.getElementById('btn-dispatch-push')?.addEventListener('click', () => {
      this.dispatchNotificationAnimation();
    });

    // Artifact Selection Pills
    document.querySelectorAll('.artifact-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.artifact-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        const artifact = pill.getAttribute('data-artifact');
        this.loadSample(artifact);
      });
    });

    // File input
    const fileInput = document.getElementById('file-input');
    const uploadBox = document.getElementById('upload-box');
    uploadBox?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.loadFile(e.target.files[0]);
      }
    });

    // Shading Modes
    document.querySelectorAll('[data-shader]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-shader]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentMaterialMode = btn.getAttribute('data-shader');
        if (this.currentMesh) this.applyMaterialToMesh(this.currentMesh);
      });
    });

    // Color & Material sliders
    document.getElementById('mesh-color')?.addEventListener('input', (e) => {
      this.meshColor = e.target.value;
      if (this.currentMaterialMode === 'pbr' && this.currentMesh) {
        this.applyMaterialToMesh(this.currentMesh);
      }
    });

    document.getElementById('roughness-slider')?.addEventListener('input', (e) => {
      this.roughness = parseFloat(e.target.value);
      if (this.currentMesh) this.applyMaterialToMesh(this.currentMesh);
    });

    document.getElementById('metalness-slider')?.addEventListener('input', (e) => {
      this.metalness = parseFloat(e.target.value);
      if (this.currentMesh) this.applyMaterialToMesh(this.currentMesh);
    });

    // Toggles
    document.getElementById('chk-turntable')?.addEventListener('change', (e) => {
      this.autoRotate = e.target.checked;
    });

    document.getElementById('rotate-speed')?.addEventListener('input', (e) => {
      this.rotateSpeed = parseFloat(e.target.value);
    });

    document.getElementById('chk-wire-overlay')?.addEventListener('change', (e) => {
      this.showWireOverlay = e.target.checked;
      this.updateWireframeOverlay();
    });

    document.getElementById('chk-grid')?.addEventListener('change', (e) => {
      this.grid.visible = e.target.checked;
    });

    document.getElementById('chk-axes')?.addEventListener('change', (e) => {
      this.axes.visible = e.target.checked;
    });

    document.getElementById('chk-bounds')?.addEventListener('change', (e) => {
      if (this.boxHelper) this.boxHelper.visible = e.target.checked;
    });

    // View Presets
    document.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setView(btn.getAttribute('data-view'));
      });
    });

    // Header actions
    document.getElementById('btn-reset-cam')?.addEventListener('click', () => {
      if (this.activeMode === 'system') {
        this.fitCameraToSize(140);
      } else if (this.currentMesh) {
        const box = new THREE.Box3().setFromObject(this.currentMesh);
        const size = box.getSize(new THREE.Vector3());
        this.fitCameraToSize(Math.max(size.x, size.y, size.z));
      }
    });

    document.getElementById('btn-snapshot')?.addEventListener('click', () => {
      this.takeSnapshot();
    });

    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });

    // Handoff Stills Drawer Toggle
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

  takeSnapshot() {
    this.renderer.render(this.scene, this.camera);
    const dataURL = this.renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `PUSHNOT_Capture_${Date.now()}.png`;
    link.href = dataURL;
    link.click();
  }

  initDragDrop() {
    const dropTarget = document.getElementById('drop-target');

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropTarget.classList.add('active');
    });

    window.addEventListener('dragleave', (e) => {
      if (e.relatedTarget === null) {
        dropTarget.classList.remove('active');
      }
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dropTarget.classList.remove('active');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.loadFile(e.dataTransfer.files[0]);
      }
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

    // Spin cloud router node
    if (this.cloudMesh) {
      this.cloudMesh.rotation.y += 0.01;
      this.cloudMesh.rotation.x += 0.005;
    }

    if (this.autoRotate) {
      if (this.activeMode === 'system' && this.systemGroup) {
        this.systemGroup.rotation.y += 0.003 * this.rotateSpeed;
      } else if (this.currentMesh) {
        this.currentMesh.rotation.y += 0.005 * this.rotateSpeed;
        if (this.currentWireframe) {
          this.currentWireframe.rotation.y = this.currentMesh.rotation.y;
        }
        if (this.boxHelper) {
          this.boxHelper.update();
        }
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new PushnotViewer();
});
