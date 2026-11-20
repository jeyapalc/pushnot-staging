import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* =====================================================================
   PUSHNOT // 3D speaker aid for "how push notifications work"
   Every visual is derived from (stage, t). Scrubbing backwards undoes
   effects; nothing is toggled by side effects.
   ===================================================================== */

const POS = {
  server: new THREE.Vector3(-48, 0, 0),
  phone: new THREE.Vector3(48, 0, 0),
  ipad: new THREE.Vector3(76, 0, -28),
  apns: new THREE.Vector3(-13, 26, -8),
  fcm: new THREE.Vector3(15, 19, -16)
};

const TOKEN_OLD = 'apns:7f4a…e891';
const TOKEN_NEW = 'apns:9b12…c440';
const TOKEN_IPAD = 'apns:b912…77d0';
const TOKEN_FCM = 'fcm:eX98…001a';

const STAGES = [
  { label: '01 · MINT TOKEN',         cam: [0, 56, 148],  tgt: [0, 12, 0] },
  { label: '02 · REGISTER',           cam: [0, 52, 138],  tgt: [0, 12, 0] },
  { label: '03 · EVENT & LOOKUP',     cam: [-18, 46, 110], tgt: [-22, 14, 0] },
  { label: '04 · SEND TO APNs',       cam: [-16, 48, 114], tgt: [-18, 16, -4] },
  { label: '05 · DELIVER & DISPLAY',  cam: [18, 46, 114],  tgt: [16, 14, -4] },
  { label: '06 · REINSTALL & ROTATE', cam: [0, 58, 152],  tgt: [0, 12, 0] }
];
const STAGE_SECONDS = [5, 5, 6, 5, 5, 10];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const inR = (t, a, b) => t >= a && t < b;

class PushnotSpeakerAid {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.loader = new GLTFLoader();

    this.stage = 0;
    this.t = 0;
    this.fanout = false;
    this.alertsAllowed = true;
    this.secondApp = false;

    this.playing = false;
    this.playUntil = 0;
    this.lastFrame = performance.now();

    this.camGoal = null;
    this.anchors = { phoneTop: 34, serverTop: 38, ipadTop: 38 };

    this.lastDbKey = '';
    this.lastLogKey = '';

    this.initScene();
    this.initLights();
    this.initPipelines();
    this.initGateways();
    this.initMovers();
    this.loadModels();
    this.initUI();

    this.goToStage(0, true);
    this.animate();
  }

  /* ---------------- scene ---------------- */
  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06080d);
    this.scene.fog = new THREE.FogExp2(0x06080d, 0.0045);

    this.camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 2000);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.addEventListener('start', () => { this.camGoal = null; });

    const grid = new THREE.GridHelper(280, 56, 0x00f0ff, 0x111c2a);
    grid.position.y = -0.2;
    this.scene.add(grid);

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  initLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const a = new THREE.DirectionalLight(0x00f0ff, 2.4); a.position.set(60, 120, 80); this.scene.add(a);
    const b = new THREE.DirectionalLight(0xffaa00, 1.6); b.position.set(-80, 100, -50); this.scene.add(b);
    const c = new THREE.DirectionalLight(0x00ff88, 1.4); c.position.set(0, -40, -80); this.scene.add(c);
  }

  initPipelines() {
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    // Token registration path: phone -> app backend
    this.cPhoneToServer = new THREE.QuadraticBezierCurve3(v(46, 12, 2), v(0, 4, 28), v(-46, 14, 2));
    // Backend -> APNs (authenticated send); reverse = provider response
    this.cServerToApns = new THREE.QuadraticBezierCurve3(v(-46, 20, 0), v(-30, 38, -6), POS.apns.clone());
    // APNs -> phone (token issue + message delivery)
    this.cApnsToPhone = new THREE.QuadraticBezierCurve3(POS.apns.clone(), v(20, 40, -6), v(48, 18, 1));
    // APNs -> iPad (fan-out)
    this.cApnsToIpad = new THREE.QuadraticBezierCurve3(POS.apns.clone(), v(34, 44, -24), v(76, 18, -27));
    // Backend -> FCM (other route; used by Android installs)
    this.cServerToFcm = new THREE.QuadraticBezierCurve3(v(-46, 22, -2), v(-16, 44, -16), POS.fcm.clone());

    this.line(this.cPhoneToServer, 0xffaa00, 0.55);
    this.line(this.cServerToApns, 0x00f0ff, 0.55);
    this.line(this.cApnsToPhone, 0x00ff88, 0.55);
    this.line(this.cServerToFcm, 0xb026ff, 0.18);
    this.ipadLine = this.line(this.cApnsToIpad, 0x00ff88, 0.4);
    this.ipadLine.visible = false;
  }

  line(curve, color, opacity) {
    const g = new THREE.BufferGeometry().setFromPoints(curve.getPoints(60));
    const m = new THREE.LineDashedMaterial({ color, dashSize: 2.4, gapSize: 1.2, transparent: true, opacity });
    const l = new THREE.Line(g, m);
    l.computeLineDistances();
    this.scene.add(l);
    return l;
  }

  initGateways() {
    this.apnsNode = this.gateway(0x00f0ff);
    this.apnsNode.position.copy(POS.apns);
    this.fcmNode = this.gateway(0xb026ff);
    this.fcmNode.position.copy(POS.fcm);
    this.fcmNode.scale.setScalar(0.8);
    this.scene.add(this.apnsNode, this.fcmNode);
  }

  gateway(color) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(
      new THREE.IcosahedronGeometry(4.5, 1),
      new THREE.MeshStandardMaterial({ color, wireframe: true, emissive: color, emissiveIntensity: 0.6 })
    ));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.22, 8, 40), new THREE.MeshBasicMaterial({ color }));
    ring.rotation.x = Math.PI / 3;
    g.add(ring);
    return g;
  }

  initMovers() {
    // Token chip (address) — amber octahedron
    this.chip = new THREE.Group();
    this.chipMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff8800, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.2 });
    this.chip.add(new THREE.Mesh(new THREE.OctahedronGeometry(2.2), this.chipMat));
    this.chip.add(new THREE.PointLight(0xffaa00, 2.5, 26));

    // Payload envelope (message) — green slab, carries address label
    const mkEnv = () => {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00cc66, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.8, 0.6), mat);
      g.add(box);
      g.add(new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: 0xffffff })));
      g.add(new THREE.PointLight(0x00ff88, 2.2, 24));
      g.userData.mat = mat;
      return g;
    };
    this.env = mkEnv();
    this.env2 = mkEnv();

    // Provider response (200 / 410)
    this.ackMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    this.ack = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 16), this.ackMat);

    this.scene.add(this.chip, this.env, this.env2, this.ack);
  }

  loadModels() {
    const status = document.getElementById('load-status');
    let pending = 2;
    const done = () => { if (--pending === 0) status.style.display = 'none'; };
    const fail = (name) => (err) => {
      console.error(err);
      status.textContent = `⚠ FAILED TO LOAD ${name}`;
      status.classList.add('error');
    };

    this.loader.load('models/data_center_rack.glb', (gltf) => {
      const rack = gltf.scene;
      rack.rotation.y = Math.PI / 4;
      this.anchors.serverTop = this.ground(rack, 38, POS.server);
      this.scene.add(rack);
      done();
    }, undefined, fail('SERVER RACK'));

    this.loader.load('models/generic_smartphone_game-ready.glb', (gltf) => {
      const phone = gltf.scene;
      phone.rotation.y = -Math.PI / 5;
      this.anchors.phoneTop = this.ground(phone, 32, POS.phone);
      this.scene.add(phone);

      this.ipad = phone.clone(true);
      this.ipad.rotation.y = -0.5;
      this.anchors.ipadTop = this.ground(this.ipad, 38, POS.ipad);
      this.ipad.visible = this.fanout;
      this.scene.add(this.ipad);
      done();
    }, undefined, fail('SMARTPHONE'));
  }

  // Scale to target size, sit on the grid, centred on target x/z. Returns top y.
  ground(obj, size, at) {
    obj.scale.setScalar(1);
    obj.position.set(0, 0, 0);
    let box = new THREE.Box3().setFromObject(obj);
    const dim = box.getSize(new THREE.Vector3());
    obj.scale.setScalar(size / Math.max(dim.x, dim.y, dim.z));
    box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3());
    obj.position.set(at.x - c.x, -box.min.y, at.z - c.z);
    return new THREE.Box3().setFromObject(obj).max.y;
  }

  /* ---------------- state derivation ---------------- */
  computeState() {
    const S = this.stage, t = this.t, f = this.fanout, allow = this.alertsAllowed;
    const st = {
      caption: '', phone: null, rows: [], log: [],
      chip: null, env: null, env2: null, ack: null,
      banner: false, silent: false, ipadDelivered: false
    };

    // ---- phone token card ----
    if (S === 0) st.phone = t < 0.95 ? { kind: 'pending', value: 'requesting token…' } : { kind: 'active', value: TOKEN_OLD };
    else if (S < 5) st.phone = { kind: 'active', value: TOKEN_OLD };
    else if (t < 0.1) st.phone = { kind: 'active', value: TOKEN_OLD };
    else if (t < 0.3) st.phone = { kind: 'pending', value: 'app reinstalled · requesting…' };
    else st.phone = { kind: 'new', value: TOKEN_NEW };

    // ---- backend registrations ----
    const oldExists = S > 1 || (S === 1 && t >= 0.97);
    const targetOld = (S === 2 && t >= 0.3) || S === 3 || S === 4 || (S === 5 && inR(t, 0.58, 0.95));
    const targetIpad = f && ((S === 2 && t >= 0.3) || S === 3 || S === 4);
    if (oldExists) {
      st.rows.push({
        acct: 'john@example.com', dev: 'iPhone', tok: TOKEN_OLD,
        status: S === 5 && t >= 0.95 ? 'RETIRED' : 'ACTIVE',
        cls: S === 5 && t >= 0.95 ? 'retired' : targetOld ? 'target' : (S === 1 ? 'fresh' : '')
      });
    }
    if (S === 5 && t >= 0.55) st.rows.push({ acct: 'john@example.com', dev: 'iPhone', tok: TOKEN_NEW, status: 'ACTIVE', cls: 'fresh' });
    st.rows.push({ acct: 'john@example.com', dev: 'iPad', tok: TOKEN_IPAD, status: 'ACTIVE', cls: targetIpad ? 'target' : '' });
    st.rows.push({ acct: 'sarah@corp.com', dev: 'Pixel', tok: TOKEN_FCM, status: 'ACTIVE', cls: '' });

    // ---- server log + movers + caption ----
    const sendLines = () => {
      const L = [];
      L.push('EVENT order_shipped #8492 → john@example.com');
      if (S > 2 || t >= 0.3) L.push(`LOOKUP active installations → ${f ? 2 : 1} target${f ? 's' : ''}`);
      if (S > 2 || t >= 0.6) L.push("BUILD payload {title:'Order Shipped', ref:'order/8492'} ttl=1h");
      if (S >= 3) L.push(`POST api.push.apple.com/3/device/${TOKEN_OLD}${f ? ' (+iPad)' : ''} · JWT auth`);
      if (S > 3 || (S === 3 && t >= 0.98)) L.push('← 200 OK apns-id 8f1c… · ACCEPTED (not proof of delivery)');
      return L;
    };

    switch (S) {
      case 0:
        st.caption = t < 0.1 ? 'The app asks the OS to register for remote notifications.'
          : t < 0.95 ? 'APNs issues an opaque device token for THIS app on THIS device.'
          : "The phone has its address. The server doesn't know it yet.";
        if (inR(t, 0.1, 0.95)) st.chip = { p: this.cApnsToPhone.getPoint(seg(t, 0.1, 0.95)), label: TOKEN_OLD };
        st.log = ['(no registration for this installation yet)'];
        break;

      case 1:
        st.caption = t < 0.97 ? "The app sends its token to its own backend, tied to the signed-in account."
          : 'Backend upserts ONE active registration for this installation.';
        if (t < 0.97) st.chip = { p: this.cPhoneToServer.getPoint(seg(t, 0, 0.97)), label: TOKEN_OLD };
        st.log = ["POST /installations {account:'john', installation:'iphone-01', provider:'apns'}"];
        if (t >= 0.97) st.log.push('UPSERT iphone-01 → ' + TOKEN_OLD + ' · ACTIVE');
        break;

      case 2:
        st.caption = t < 0.3 ? "A product event fires: John's order #8492 shipped."
          : t < 0.6 ? (f ? 'Lookup: John has 2 active installations → send to each.' : "Lookup: find John's active installation and its token.")
          : 'Build the payload. Token = WHERE it goes. Payload = WHAT it says.';
        if (t >= 0.6) {
          const s = seg(t, 0.6, 0.8);
          st.env = { p: this.cServerToApns.getPoint(0), scale: s, label: `TO ${TOKEN_OLD} · "Order Shipped"` };
          if (f) st.env2 = { p: this.cServerToApns.getPoint(0).add(new THREE.Vector3(0, -4, 3)), scale: s, label: `TO ${TOKEN_IPAD}` };
        }
        st.log = sendLines();
        break;

      case 3:
        st.caption = t < 0.6 ? 'Authenticated request to APNs — the provider that issued this token.'
          : 'APNs answers 200: request ACCEPTED. That is not delivery yet.';
        st.env = { p: this.cServerToApns.getPoint(seg(t, 0, 0.6)), label: `TO ${TOKEN_OLD} · "Order Shipped"` };
        if (f) st.env2 = { p: this.cServerToApns.getPoint(seg(t, 0.04, 0.64)), label: `TO ${TOKEN_IPAD}` };
        if (inR(t, 0.62, 0.98)) st.ack = { p: this.cServerToApns.getPoint(1 - seg(t, 0.62, 0.98)), label: '200 OK · ACCEPTED', ok: true };
        st.log = sendLines();
        break;

      case 4:
        st.caption = t < 0.7 ? 'APNs routes the message to the device over its persistent connection.'
          : t < 0.8 ? "The OS checks this app's notification permission."
          : allow ? 'Alert displayed. Display is device-side evidence, not something the server knows.'
          : 'Delivered — but alerts are off for this app, so nothing is shown.';
        if (t < 0.8) {
          st.env = { p: this.cApnsToPhone.getPoint(seg(t, 0, 0.7)), label: `TO ${TOKEN_OLD} · "Order Shipped"` };
          if (f) st.env2 = { p: this.cApnsToIpad.getPoint(seg(t, 0, 0.7)), label: `TO ${TOKEN_IPAD}` };
        }
        st.banner = t >= 0.8 && allow;
        st.silent = t >= 0.8 && !allow;
        st.ipadDelivered = f && t >= 0.8;
        st.log = sendLines();
        if (t >= 0.8) st.log.push(allow ? '(device-side) displayed on iPhone' : '(device-side) delivered, alert suppressed by settings');
        break;

      case 5:
        st.caption = t < 0.1 ? 'John deletes the app. Its old token stops being valid.'
          : t < 0.3 ? 'Reinstall: APNs issues a NEW token for the new installation.'
          : t < 0.55 ? 'The app syncs the new token; the backend registers it.'
          : t < 0.77 ? 'A queued send still targets the OLD token…'
          : t < 0.95 ? 'APNs rejects it: 410 Unregistered.'
          : 'Backend retires the old token. The new registration stays ACTIVE.';
        if (inR(t, 0.12, 0.3)) st.chip = { p: this.cApnsToPhone.getPoint(seg(t, 0.12, 0.3)), label: TOKEN_NEW };
        if (inR(t, 0.32, 0.55)) st.chip = { p: this.cPhoneToServer.getPoint(seg(t, 0.32, 0.55)), label: TOKEN_NEW };
        if (inR(t, 0.58, 0.77)) st.env = { p: this.cServerToApns.getPoint(seg(t, 0.58, 0.75)), label: `TO ${TOKEN_OLD} (stale)`, stale: true };
        if (inR(t, 0.77, 0.95)) st.ack = { p: this.cServerToApns.getPoint(1 - seg(t, 0.77, 0.95)), label: '410 UNREGISTERED', ok: false };
        st.log = [];
        if (t >= 0.1) st.log.push('(device) app uninstalled → reinstalled');
        if (t >= 0.55) st.log.push('UPSERT iphone-02 → ' + TOKEN_NEW + ' · ACTIVE');
        if (t >= 0.58) st.log.push('POST api.push.apple.com/3/device/' + TOKEN_OLD + ' (queued send)');
        if (t >= 0.95) st.log.push('← 410 Unregistered → RETIRE ' + TOKEN_OLD + ' · keep ' + TOKEN_NEW);
        if (!st.log.length) st.log = ['(waiting)'];
        break;
    }
    return st;
  }

  /* ---------------- apply state ---------------- */
  render3D(st) {
    const place = (obj, m) => {
      obj.visible = !!m;
      if (m) {
        obj.position.copy(m.p);
        obj.scale.setScalar(m.scale === undefined ? 1 : Math.max(0.01, m.scale));
      }
    };
    place(this.chip, st.chip);
    place(this.env, st.env);
    place(this.env2, st.env2);
    place(this.ack, st.ack);

    if (st.env) {
      this.env.userData.mat.color.setHex(st.env.stale ? 0xff3366 : 0x00ff88);
      this.env.userData.mat.emissive.setHex(st.env.stale ? 0xaa0033 : 0x00cc66);
    }
    if (st.ack) this.ackMat.color.setHex(st.ack.ok ? 0x00ff88 : 0xff0055);

    this.ipadLine.visible = this.fanout;
    if (this.ipad) this.ipad.visible = this.fanout;
  }

  renderOverlays(st) {
    const A = this.anchors;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    // Caption + stage UI
    document.getElementById('cap-stage').textContent = STAGES[this.stage].label;
    document.getElementById('cap-text').textContent = st.caption;
    document.getElementById('scrub').value = Math.round(this.t * 1000);
    document.getElementById('scrub-pct').textContent = Math.round(this.t * 100) + '%';
    document.getElementById('btn-play').textContent = this.playing ? '❚❚ PAUSE' : '▶ PLAY STAGE';

    // Phone token card
    const card = document.getElementById('card-phone');
    card.className = 'holo holo-card ' + st.phone.kind;
    document.getElementById('card-phone-badge').textContent =
      st.phone.kind === 'pending' ? '◌ NO TOKEN YET' : st.phone.kind === 'new' ? '● NEW DEVICE TOKEN' : '● DEVICE TOKEN';
    document.getElementById('card-phone-val').textContent = st.phone.value;
    this.place('card-phone', V(POS.phone.x, A.phoneTop + 3, POS.phone.z), true);
    this.place('card-app2', V(POS.phone.x + 14, A.phoneTop - 4, POS.phone.z), this.secondApp);

    // Backend DB + Log (docked cleanly top-left, never clipped or overlapping)
    const dbKey = JSON.stringify(st.rows);
    if (dbKey !== this.lastDbKey) {
      this.lastDbKey = dbKey;
      document.getElementById('db-body').innerHTML = st.rows.map((r) =>
        `<tr class="${r.cls}"><td>${r.acct}</td><td>${r.dev}</td><td>${r.tok}</td><td class="st">${r.status}</td></tr>`
      ).join('');
    }

    // Server log (stacked inside backend card)
    const logKey = st.log.join('|');
    if (logKey !== this.lastLogKey) {
      this.lastLogKey = logKey;
      document.getElementById('log-body').innerHTML = st.log.map((l) => {
        const cls = l.startsWith('←') ? (l.includes('410') ? 'bad' : 'ok') : l.startsWith('(') ? 'dim' : '';
        return `<div class="${cls}">› ${l}</div>`;
      }).join('');
    }

    // Moving-object labels
    this.place('lbl-chip', st.chip && st.chip.p.clone().add(V(0, 3.5, 0)), !!st.chip);
    if (st.chip) document.getElementById('lbl-chip').textContent = '🔑 ' + st.chip.label;
    this.place('lbl-env', st.env && st.env.p.clone().add(V(0, 3.5, 0)), !!st.env && (st.env.scale === undefined || st.env.scale > 0.3));
    if (st.env) {
      const e = document.getElementById('lbl-env');
      e.textContent = '✉ ' + st.env.label;
      e.classList.toggle('stale', !!st.env.stale);
    }
    this.place('lbl-env2', st.env2 && st.env2.p.clone().add(V(0, -3.2, 0)), !!st.env2 && (st.env2.scale === undefined || st.env2.scale > 0.3));
    if (st.env2) document.getElementById('lbl-env2').textContent = '✉ ' + st.env2.label;
    this.place('lbl-ack', st.ack && st.ack.p.clone().add(V(0, 3, 0)), !!st.ack);
    if (st.ack) {
      const a = document.getElementById('lbl-ack');
      a.textContent = st.ack.label;
      a.classList.toggle('bad', !st.ack.ok);
    }

    // Device outcomes
    this.place('banner', V(POS.phone.x, A.phoneTop * 0.72, POS.phone.z + 6), st.banner);
    this.place('silent', V(POS.phone.x, A.phoneTop * 0.6, POS.phone.z + 6), st.silent);
    this.place('ipad-banner', V(POS.ipad.x, A.ipadTop * 0.72, POS.ipad.z + 6), st.ipadDelivered && this.alertsAllowed);

    // Node tags
    this.place('tag-server', V(POS.server.x, -2, POS.server.z + 10), true);
    this.place('tag-phone', V(POS.phone.x, -2, POS.phone.z + 8), true);
    this.place('tag-ipad', V(POS.ipad.x, -2, POS.ipad.z + 8), this.fanout);
    this.place('tag-apns', V(POS.apns.x, POS.apns.y + 9, POS.apns.z), true);
    this.place('tag-fcm', V(POS.fcm.x, POS.fcm.y - 7, POS.fcm.z), true);
  }

  place(id, worldPos, show) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!show || !worldPos) { el.style.display = 'none'; return; }
    const p = worldPos.clone().project(this.camera);
    if (p.z > 1 || p.z < -1) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    const w = el.offsetWidth || 160;
    const h = el.offsetHeight || 40;
    const padX = Math.max(16, w / 2 + 12);
    const x = Math.max(padX, Math.min(innerWidth - padX, (p.x * 0.5 + 0.5) * innerWidth));
    const y = Math.max(122 + h, Math.min(innerHeight - 178, (-p.y * 0.5 + 0.5) * innerHeight));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  /* ---------------- navigation & playback ---------------- */
  goToStage(i, snap = false) {
    this.stage = Math.max(0, Math.min(STAGES.length - 1, i));
    this.t = 0;
    document.querySelectorAll('.btn-stage').forEach((b, k) => b.classList.toggle('active', k === this.stage));
    this.setCamera(STAGES[this.stage].cam, STAGES[this.stage].tgt, snap);
    document.querySelectorAll('[data-cam]').forEach((b) => b.classList.remove('active'));
  }

  setCamera(cam, tgt, snap) {
    const pos = new THREE.Vector3(...cam);
    const target = new THREE.Vector3(...tgt);
    if (snap) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.camGoal = null;
    } else {
      this.camGoal = { pos, target };
    }
  }

  play(untilStage = this.stage) {
    if (this.t >= 1 && this.stage >= untilStage) this.t = 0;
    this.playUntil = untilStage;
    this.playing = true;
    this.lastFrame = performance.now();
  }

  stop() { this.playing = false; }

  fullSend() {
    // Event → lookup → send → accept → deliver (stages 3..5), one continuous run.
    this.stop();
    this.goToStage(2);
    this.play(4);
  }

  tick(dt) {
    if (!this.playing) return;
    this.t += dt / STAGE_SECONDS[this.stage];
    if (this.t >= 1) {
      if (this.stage < this.playUntil) {
        this.goToStage(this.stage + 1);
      } else {
        this.t = 1;
        this.stop();
      }
    }
  }

  /* ---------------- UI wiring ---------------- */
  initUI() {
    document.querySelectorAll('.btn-stage').forEach((b, k) => b.addEventListener('click', () => { this.stop(); this.goToStage(k); }));

    document.getElementById('scrub').addEventListener('input', (e) => {
      this.stop();
      this.t = parseInt(e.target.value, 10) / 1000;
    });

    document.getElementById('btn-prev').addEventListener('click', () => { this.stop(); this.goToStage(this.stage - 1); });
    document.getElementById('btn-next').addEventListener('click', () => { this.stop(); this.goToStage(this.stage + 1); });
    document.getElementById('btn-play').addEventListener('click', () => (this.playing ? this.stop() : this.play()));
    document.getElementById('btn-full').addEventListener('click', () => this.fullSend());

    const tgl = (id, key, on, off) => {
      const b = document.getElementById(id);
      const sync = () => { b.textContent = this[key] ? on : off; b.classList.toggle('on', this[key]); };
      b.addEventListener('click', () => { this[key] = !this[key]; sync(); });
      sync();
    };
    tgl('btn-fanout', 'fanout', '📱📱 FAN-OUT: iPhone + iPad', '📱 FAN-OUT: iPhone only');
    tgl('btn-alerts', 'alertsAllowed', '🔔 ALERTS: ALLOWED', '🔕 ALERTS: DENIED');
    tgl('btn-app2', 'secondApp', '🧩 2ND APP TOKEN: SHOWN', '🧩 2ND APP TOKEN: HIDDEN');

    document.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('[data-cam]').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const presets = {
        wide: [[0, 60, 140], [0, 12, 0]],
        phone: [[48, 26, 52], [46, 14, 0]],
        server: [[-40, 34, 60], [-46, 16, 0]],
        gateway: [[0, 40, 50], [0, 26, -10]]
      };
      const [c, t] = presets[b.dataset.cam];
      this.setCamera(c, t, false);
    }));

    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    });

    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') { this.stop(); this.goToStage(this.stage + 1); }
      else if (e.key === 'ArrowLeft') { this.stop(); this.goToStage(this.stage - 1); }
      else if (e.code === 'Space') { e.preventDefault(); this.playing ? this.stop() : this.play(); }
      else if (e.key >= '1' && e.key <= '6') { this.stop(); this.goToStage(parseInt(e.key, 10) - 1); }
      else if (e.key.toLowerCase() === 'f') this.fullSend();
      else if (e.key === '.') { this.stop(); this.t = Math.min(1, this.t + 0.05); }
      else if (e.key === ',') { this.stop(); this.t = Math.max(0, this.t - 0.05); }
    });
  }

  /* ---------------- loop ---------------- */
  animate() {
    requestAnimationFrame(() => this.animate());
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    this.tick(dt);

    if (this.camGoal) {
      this.camera.position.lerp(this.camGoal.pos, 0.07);
      this.controls.target.lerp(this.camGoal.target, 0.07);
      if (this.camera.position.distanceTo(this.camGoal.pos) < 0.05) this.camGoal = null;
    }

    this.apnsNode.rotation.y += 0.012;
    this.apnsNode.rotation.x += 0.006;
    this.fcmNode.rotation.y -= 0.008;
    this.chip.rotation.y += 0.05;
    this.env.rotation.y = Math.sin(now * 0.002) * 0.3;
    this.env2.rotation.y = this.env.rotation.y;

    const st = this.computeState();
    this.render3D(st);
    this.controls.update();
    this.renderOverlays(st);
    this.renderer.render(this.scene, this.camera);
  }
}

addEventListener('DOMContentLoaded', () => new PushnotSpeakerAid());
