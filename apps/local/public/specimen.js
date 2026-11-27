// specimen.js: the sealed specimen case on Home (spec 05-ui-redesign, task 9).
// One rendered object built in code with three.js: a steel-edged case with frosted glass, holding a
// paper record card printed with the real recorded file name and SHA-256 from docs/evidence. The lid
// closes once on load (GSAP), then the scene stays still. Rendering happens only while that tween
// runs and on resize. Under prefers-reduced-motion one still frame is drawn with the lid closed.
// The canvas is decorative for assistive technology; the same facts are in the figure caption text.
import { gsapOrNull, ease } from '/motion.js';

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function recordCard(THREE, record) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 640;
  const g = c.getContext('2d');
  g.fillStyle = token('--color-surface');
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = token('--color-border');
  g.lineWidth = 4;
  g.strokeRect(24, 24, c.width - 48, c.height - 48);
  g.fillStyle = token('--color-primary');
  g.fillRect(24, 24, c.width - 48, 18);
  g.fillStyle = token('--color-muted');
  g.font = '500 34px "Plex Mono", ui-monospace, monospace';
  g.fillText('ReproLab run record', 72, 118);
  g.fillStyle = token('--color-ink');
  g.font = '500 46px "Plex Mono", ui-monospace, monospace';
  g.fillText(record.file, 72, 206);
  g.font = '400 32px "Plex Mono", ui-monospace, monospace';
  g.fillStyle = token('--color-muted');
  g.fillText('sha256', 72, 300);
  g.fillStyle = token('--color-ink');
  g.fillText(record.sha.slice(0, 32), 72, 348);
  g.fillText(record.sha.slice(32), 72, 392);
  g.fillStyle = token('--color-muted');
  g.fillText(record.engine, 72, 486);
  g.fillText(record.bytes, 72, 534);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export async function mountSpecimen({ stage, figure, record }) {
  let THREE;
  try {
    THREE = await import('/vendor/three-0.187.0/three.module.js');
  } catch {
    return false;
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return false;
  }
  if (document.fonts?.load) { try { await Promise.all([document.fonts.load('400 32px "Plex Mono"'), document.fonts.load('500 46px "Plex Mono"')]); } catch { /* system mono */ } }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  stage.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 5 / 4, 0.1, 100);
  camera.position.set(1.9, 4.9, 4.1);
  camera.lookAt(0, 0.2, 0.15);

  scene.add(new THREE.HemisphereLight(0xffffff, new THREE.Color(token('--color-band')), 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-3, 6, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.radius = 6;
  sun.shadow.camera.left = -4; sun.shadow.camera.right = 4; sun.shadow.camera.top = 4; sun.shadow.camera.bottom = -4;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(4, 2, -3);
  scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const W = 3.0; const D = 2.0; const Hh = 0.9; const t = 0.06;
  const steel = new THREE.MeshStandardMaterial({ color: new THREE.Color(token('--color-ink')), metalness: 0.75, roughness: 0.32 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.15, transparent: true, opacity: 0.22, depthWrite: false });
  const base = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, D), new THREE.MeshStandardMaterial({ color: new THREE.Color(token('--color-surface')), roughness: 0.8 }));
  base.position.y = 0.06; base.castShadow = true; base.receiveShadow = true;
  scene.add(base);

  const frame = new THREE.Group();
  const edge = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), steel); m.position.set(x, y, z); m.castShadow = true; frame.add(m); };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) edge(t, Hh, t, (sx * W) / 2, 0.12 + Hh / 2, (sz * D) / 2);
  for (const sz of [-1, 1]) edge(W, t, t, 0, 0.12 + Hh, (sz * D) / 2);
  for (const sx of [-1, 1]) edge(t, t, D, (sx * W) / 2, 0.12 + Hh, 0);
  const pane = (w, h, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass); m.position.set(x, y, z); m.rotation.y = ry; frame.add(m); };
  pane(W, Hh, 0, 0.12 + Hh / 2, D / 2, 0);
  pane(W, Hh, 0, 0.12 + Hh / 2, -D / 2, Math.PI);
  pane(D, Hh, W / 2, 0.12 + Hh / 2, 0, Math.PI / 2);
  pane(D, Hh, -W / 2, 0.12 + Hh / 2, 0, -Math.PI / 2);
  scene.add(frame);

  const card = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.44), new THREE.MeshStandardMaterial({ map: recordCard(THREE, record), roughness: 0.9 }));
  card.rotation.x = -Math.PI / 2 + 0.08;
  card.position.set(0, 0.22, 0.05);
  card.castShadow = true; card.receiveShadow = true;
  scene.add(card);

  // The lid hinges on the back edge. Its seal band is the one accent in the object.
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.12 + Hh, -D / 2);
  const lidGlass = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, D), glass);
  lidGlass.position.set(0, 0.015, D / 2);
  hinge.add(lidGlass);
  const lidEdge = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), steel); m.position.set(x, 0.03, z); m.castShadow = true; hinge.add(m); };
  lidEdge(W + t, t, 0, 0); lidEdge(W + t, t, 0, D); lidEdge(t, D, -W / 2, D / 2); lidEdge(t, D, W / 2, D / 2);
  // A small seal strip over the front edge of the lid, where a custody seal would sit.
  const seal = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.16), new THREE.MeshStandardMaterial({ color: new THREE.Color(token('--color-primary')), roughness: 0.6 }));
  seal.position.set(W / 2 - 0.5, 0.05, D);
  seal.castShadow = true;
  hinge.add(seal);
  scene.add(hinge);

  function resize() {
    const r = stage.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)); const h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1 ? 36 : 28;
    camera.updateProjectionMatrix();
  }
  const draw = () => renderer.render(scene, camera);

  resize();
  const gsap = gsapOrNull();
  if (gsap) {
    hinge.rotation.x = -1.05;
    card.position.y = 0.9;
    draw();
    const tl = gsap.timeline({ onUpdate: draw, onComplete: draw });
    tl.to(card.position, { y: 0.22, duration: 0.7, ease }, 0.15);
    tl.to(hinge.rotation, { x: 0, duration: 0.9, ease }, 0.55);
  } else {
    draw();
  }
  figure.classList.add('is-rendered');
  new ResizeObserver(() => { resize(); draw(); }).observe(stage);
  return true;
}
