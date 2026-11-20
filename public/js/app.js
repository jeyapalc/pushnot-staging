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
    this.currentMaterialMode = 'pbr';
    this.autoRotate = true;
    this.rotateSpeed = 1.0;
    this.showWireOverlay = false;

    // Default Material properties
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

    // Load initial sample
    this.loadSample('top_mod');
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090c10);
    this.scene.fog = new THREE.FogExp2(0x090c10, 0.008);

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    this.camera.position.set(120, 90, 160);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 1500;
    this.controls.minDistance = 2;

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(this.ambientLight);

    // Key Light (Cyan tinted)
    this.keyLight = new THREE.DirectionalLight(0x00f0ff, 2.5);
    this.keyLight.position.set(150, 200, 150);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.scene.add(this.keyLight);

    // Fill Light (Warm/Amber)
    this.fillLight = new THREE.DirectionalLight(0xff9900, 1.2);
    this.fillLight.position.set(-150, 80, -100);
    this.scene.add(this.fillLight);

    // Rim/Back Light (Magenta)
    this.rimLight = new THREE.DirectionalLight(0xff0055, 1.8);
    this.rimLight.position.set(0, -100, -150);
    this.scene.add(this.rimLight);
  }

  initHelpers() {
    // Cyberpunk grid
    this.grid = new THREE.GridHelper(300, 60, 0x00f0ff, 0x1e2d3d);
    this.grid.position.y = -0.5;
    this.scene.add(this.grid);

    this.axes = new THREE.AxesHelper(40);
    this.axes.visible = false;
    this.scene.add(this.axes);
  }

  initLoaders() {
    this.stlLoader = new STLLoader();
    this.objLoader = new OBJLoader();
    this.gltfLoader = new GLTFLoader();
  }

  createMaterial(mode) {
    switch (mode) {
      case 'normals':
        return new THREE.MeshNormalMaterial({ wireframe: false });
      case 'wireframe':
        return new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true });
      case 'matcap':
        return new THREE.MeshStandardMaterial({
          color: 0xdddddd,
          roughness: 0.1,
          metalness: 0.95
        });
      case 'pbr':
      default:
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color(this.meshColor),
          roughness: this.roughness,
          metalness: this.metalness,
          side: THREE.DoubleSide
        });
    }
  }

  applyMaterialToMesh(object) {
    const mat = this.createMaterial(this.currentMaterialMode);
    object.traverse((child) => {
      if (child.isMesh) {
        child.material = mat;
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
        if (child.isMesh) {
          child.material = wireMat;
        }
      });
      this.currentWireframe = clone;
      this.scene.add(this.currentWireframe);
    }
  }

  setModel(object, name, format, fileSize = 'Local Asset') {
    if (this.currentMesh) {
      this.scene.remove(this.currentMesh);
    }
    if (this.currentWireframe) {
      this.scene.remove(this.currentWireframe);
      this.currentWireframe = null;
    }
    if (this.boxHelper) {
      this.scene.remove(this.boxHelper);
      this.boxHelper = null;
    }

    this.currentMesh = object;
    this.applyMaterialToMesh(this.currentMesh);
    this.scene.add(this.currentMesh);

    // Compute bounding box and center geometry
    const box = new THREE.Box3().setFromObject(this.currentMesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    this.currentMesh.position.x -= center.x;
    this.currentMesh.position.y -= center.y;
    this.currentMesh.position.z -= center.z;

    // Recompute adjusted box
    box.setFromObject(this.currentMesh);
    const maxDim = Math.max(size.x, size.y, size.z);

    // Create bounding box helper (hidden by default)
    this.boxHelper = new THREE.Box3Helper(box, 0x00ff88);
    this.boxHelper.visible = document.getElementById('chk-bounds')?.checked || false;
    this.scene.add(this.boxHelper);

    // Fit camera
    this.fitCameraToSize(maxDim);

    // Update overlay & statistics
    this.updateWireframeOverlay();
    this.calculateStats(this.currentMesh, name, format, size, fileSize);
  }

  fitCameraToSize(maxDim) {
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.8;
    cameraZ = Math.max(cameraZ, 20);

    this.camera.position.set(cameraZ * 0.8, cameraZ * 0.6, cameraZ);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  calculateStats(object, name, format, size, fileSize) {
    let vertices = 0;
    let triangles = 0;

    object.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geo = child.geometry;
        if (geo.index) {
          triangles += geo.index.count / 3;
          vertices += geo.attributes.position.count;
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
    if (type === 'top_mod') {
      this.stlLoader.load(
        'models/Top_Mod_V1.stl',
        (geometry) => {
          geometry.computeVertexNormals();
          const mesh = new THREE.Mesh(geometry);
          this.setModel(mesh, 'Top_Mod_V1.stl', 'STL', '523 KB');
          this.showLoader(false);
        },
        undefined,
        (err) => {
          console.error(err);
          this.loadProcedural();
        }
      );
    } else if (type === 'box') {
      this.objLoader.load(
        'models/box_4x7x1.5.obj',
        (obj) => {
          this.setModel(obj, 'box_4x7x1.5.obj', 'OBJ', '684 B');
          this.showLoader(false);
        },
        undefined,
        (err) => {
          console.error(err);
          this.loadProcedural();
        }
      );
    } else {
      this.loadProcedural();
    }
  }

  loadProcedural() {
    const group = new THREE.Group();
    const torusKnot = new THREE.TorusKnotGeometry(25, 7, 128, 32, 2, 3);
    const knotMesh = new THREE.Mesh(torusKnot);
    group.add(knotMesh);

    // Orbiting rings
    const ringGeo = new THREE.TorusGeometry(45, 0.8, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 3;
    group.add(ringMesh);

    this.setModel(group, 'Quantum Monolith', 'Procedural', 'Generated');
    this.showLoader(false);
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
          alert('Failed to parse STL: ' + err.message);
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
          alert('Failed to parse OBJ: ' + err.message);
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
            alert('Failed to parse GLTF: ' + err.message);
            this.showLoader(false);
          }
        );
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert(`Unsupported format: .${ext}. Please drop STL, OBJ, GLTF, or GLB.`);
      this.showLoader(false);
    }
  }

  showLoader(show) {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = show ? 'flex' : 'none';
  }

  initUI() {
    // Artifact buttons
    document.querySelectorAll('.artifact-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        document.querySelectorAll('.artifact-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        const artifact = pill.getAttribute('data-artifact');
        this.loadSample(artifact);
      });
    });

    // File input upload
    const fileInput = document.getElementById('file-input');
    const uploadBox = document.getElementById('upload-box');
    uploadBox.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
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
    const colorPicker = document.getElementById('mesh-color');
    colorPicker.addEventListener('input', (e) => {
      this.meshColor = e.target.value;
      if (this.currentMaterialMode === 'pbr' && this.currentMesh) {
        this.applyMaterialToMesh(this.currentMesh);
      }
    });

    const roughSlider = document.getElementById('roughness-slider');
    roughSlider.addEventListener('input', (e) => {
      this.roughness = parseFloat(e.target.value);
      if (this.currentMesh) this.applyMaterialToMesh(this.currentMesh);
    });

    const metalSlider = document.getElementById('metalness-slider');
    metalSlider.addEventListener('input', (e) => {
      this.metalness = parseFloat(e.target.value);
      if (this.currentMesh) this.applyMaterialToMesh(this.currentMesh);
    });

    // Toggles
    document.getElementById('chk-turntable').addEventListener('change', (e) => {
      this.autoRotate = e.target.checked;
    });

    document.getElementById('rotate-speed').addEventListener('input', (e) => {
      this.rotateSpeed = parseFloat(e.target.value);
    });

    document.getElementById('chk-wire-overlay').addEventListener('change', (e) => {
      this.showWireOverlay = e.target.checked;
      this.updateWireframeOverlay();
    });

    document.getElementById('chk-grid').addEventListener('change', (e) => {
      this.grid.visible = e.target.checked;
    });

    document.getElementById('chk-axes').addEventListener('change', (e) => {
      this.axes.visible = e.target.checked;
    });

    document.getElementById('chk-bounds').addEventListener('change', (e) => {
      if (this.boxHelper) this.boxHelper.visible = e.target.checked;
    });

    // View Presets
    document.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.setView(view);
      });
    });

    // Actions
    document.getElementById('btn-reset-cam').addEventListener('click', () => {
      if (this.currentMesh) {
        const box = new THREE.Box3().setFromObject(this.currentMesh);
        const size = box.getSize(new THREE.Vector3());
        this.fitCameraToSize(Math.max(size.x, size.y, size.z));
      }
    });

    document.getElementById('btn-snapshot').addEventListener('click', () => {
      this.takeSnapshot();
    });

    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });
  }

  setView(view) {
    if (!this.currentMesh) return;
    const box = new THREE.Box3().setFromObject(this.currentMesh);
    const size = box.getSize(new THREE.Vector3());
    const d = Math.max(size.x, size.y, size.z) * 1.6;

    switch (view) {
      case 'front':
        this.camera.position.set(0, 0, d);
        break;
      case 'top':
        this.camera.position.set(0, d, 0);
        break;
      case 'side':
        this.camera.position.set(d, 0, 0);
        break;
      case 'iso':
      default:
        this.camera.position.set(d * 0.7, d * 0.6, d * 0.7);
        break;
    }
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  takeSnapshot() {
    this.renderer.render(this.scene, this.camera);
    const dataURL = this.renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `PUSHNOT_Artifact_${Date.now()}.png`;
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

    if (this.autoRotate && this.currentMesh) {
      this.currentMesh.rotation.y += 0.005 * this.rotateSpeed;
      if (this.currentWireframe) {
        this.currentWireframe.rotation.y = this.currentMesh.rotation.y;
      }
      if (this.boxHelper) {
        this.boxHelper.update();
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new PushnotViewer();
});
