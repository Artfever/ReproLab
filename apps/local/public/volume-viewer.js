// volume-viewer.js: three.js view of the NiftyNet fixture's volume.npy (spec 05-ui-redesign, task 12).
// Loaded only for a succeeded NiftyNet run. Each voxel of the real output file is one cube coloured
// by its value; the selected slice is solid and the others are faint. Renders on demand: once on
// mount and again when the slice control changes. There is no animation loop.
import { parseNpy } from '/results-logic.js';

const MAX_VOXELS = 32768;

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export async function mountVolumeViewer({ buffer, stage, range, wrap }) {
  const vol = parseNpy(buffer);
  if (vol.shape.length !== 3) throw new Error('The volume is not three-dimensional.');
  const [d, h, w] = vol.shape;
  if (d * h * w > MAX_VOXELS) throw new Error('The volume is too large for this viewer.');
  const THREE = await import('/vendor/three-0.187.0/three.module.js');

  let min = Infinity; let max = -Infinity;
  for (const v of vol.data) { if (v < min) min = v; if (v > max) max = v; }
  const span = max > min ? max - min : 1;

  wrap.hidden = false;
  range.max = String(d - 1);
  range.value = '0';

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  stage.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(token('--color-log-bg'));
  const camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 200);
  const size = Math.max(d, h, w);
  camera.position.set(size * 1.9, size * 1.5, size * 2.3);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 5, 4);
  scene.add(key);

  const low = new THREE.Color(token('--color-log-muted'));
  const high = new THREE.Color(token('--color-log-accent'));
  const geo = new THREE.BoxGeometry(0.86, 0.86, 0.86);
  const cubes = [];
  for (let z = 0; z < d; z += 1) {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const v = vol.data[z * h * w + y * w + x];
        const mat = new THREE.MeshStandardMaterial({ color: low.clone().lerp(high, (v - min) / span), roughness: 0.55, metalness: 0.05, transparent: true });
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x - (w - 1) / 2, (h - 1) / 2 - y, z - (d - 1) / 2);
        m.userData.z = z;
        scene.add(m);
        cubes.push(m);
      }
    }
  }

  function resize() {
    const r = stage.getBoundingClientRect();
    const width = Math.max(1, Math.round(r.width));
    const height = Math.max(1, Math.round(r.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function draw() {
    const k = Number(range.value);
    for (const c of cubes) c.material.opacity = c.userData.z === k ? 1 : 0.14;
    renderer.render(scene, camera);
    range.setAttribute('aria-valuetext', `Slice ${k + 1} of ${d}`);
  }

  resize();
  draw();
  range.addEventListener('input', draw);
  new ResizeObserver(() => { resize(); draw(); }).observe(stage);
}
