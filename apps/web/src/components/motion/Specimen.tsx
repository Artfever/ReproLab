'use client';

import { useEffect, useRef } from 'react';

// The sealed specimen case on the public home page (spec 05-ui-redesign). The server renders a line
// drawing and a caption with the real recorded image ID. In the browser, when WebGL is available and
// reduced motion is off, three.js renders the case once with its lid closing (GSAP), then stays still.
export function Specimen({ imageId, engine }: { imageId: string; engine: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const fig = useRef<HTMLElement>(null);

  useEffect(() => {
    const host = stage.current;
    const figure = fig.current;
    if (!host || !figure || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import('three');
      const { gsap } = await import('gsap');
      if (disposed) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return; }
      const css = getComputedStyle(document.documentElement);
      const tok = (n: string) => new THREE.Color(css.getPropertyValue(n).trim());
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.shadowMap.enabled = true;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.domElement.setAttribute('aria-hidden', 'true');
      host.append(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 5 / 4, 0.1, 100);
      camera.position.set(2.7, 6.6, 5.7);
      camera.lookAt(0, 0.2, 0.15);
      scene.add(new THREE.HemisphereLight(0xffffff, tok('--color-band'), 1.3));
      const sun = new THREE.DirectionalLight(0xffffff, 2.3);
      sun.position.set(-3, 6, 4);
      sun.castShadow = true;
      scene.add(sun);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.15 }));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      const W = 3; const D = 2; const H = 0.9; const t = 0.06;
      const steel = new THREE.MeshStandardMaterial({ color: tok('--color-ink'), metalness: 0.75, roughness: 0.32 });
      const glass = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, transparent: true, opacity: 0.22, depthWrite: false });
      const base = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, D), new THREE.MeshStandardMaterial({ color: tok('--color-surface'), roughness: 0.8 }));
      base.position.y = 0.06; base.castShadow = true; base.receiveShadow = true;
      scene.add(base);
      const edge = (w: number, h: number, d: number, x: number, y: number, z: number, parent: { add: (o: InstanceType<typeof THREE.Mesh>) => void }) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), steel); m.position.set(x, y, z); m.castShadow = true; parent.add(m);
      };
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) edge(t, H, t, (sx * W) / 2, 0.12 + H / 2, (sz * D) / 2, scene);
      for (const sz of [-1, 1]) edge(W, t, t, 0, 0.12 + H, (sz * D) / 2, scene);
      for (const sx of [-1, 1]) edge(t, t, D, (sx * W) / 2, 0.12 + H, 0, scene);

      const c = document.createElement('canvas'); c.width = 1024; c.height = 640;
      const g = c.getContext('2d');
      if (g) {
        g.fillStyle = css.getPropertyValue('--color-surface').trim(); g.fillRect(0, 0, 1024, 640);
        g.fillStyle = css.getPropertyValue('--color-primary').trim(); g.fillRect(24, 24, 976, 18);
        g.fillStyle = css.getPropertyValue('--color-muted').trim(); g.font = '500 34px ui-monospace, monospace'; g.fillText('ReproLab recorded sample', 72, 118);
        g.fillStyle = css.getPropertyValue('--color-ink').trim(); g.font = '500 44px ui-monospace, monospace'; g.fillText(engine, 72, 206);
        g.font = '400 30px ui-monospace, monospace'; g.fillText('image', 72, 300);
        g.fillText(imageId.slice(0, 39), 72, 348); g.fillText(imageId.slice(39), 72, 392);
        g.fillStyle = css.getPropertyValue('--color-muted').trim(); g.fillText('Seeds example, recorded on one machine', 72, 500);
      }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const card = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.44), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      card.rotation.x = -Math.PI / 2 + 0.08; card.position.set(0, 0.9, 0.05); card.receiveShadow = true;
      scene.add(card);

      const hinge = new THREE.Group();
      hinge.position.set(0, 0.12 + H, -D / 2);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, D), glass); lid.position.set(0, 0.015, D / 2); hinge.add(lid);
      edge(W + t, t, t, 0, 0.03, 0, hinge); edge(W + t, t, t, 0, 0.03, D, hinge); edge(t, t, D, -W / 2, 0.03, D / 2, hinge); edge(t, t, D, W / 2, 0.03, D / 2, hinge);
      const seal = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.16), new THREE.MeshStandardMaterial({ color: tok('--color-primary'), roughness: 0.6 }));
      seal.position.set(W / 2 - 0.5, 0.05, D); hinge.add(seal);
      hinge.rotation.x = -1.05;
      scene.add(hinge);

      const resize = () => {
        const r = host.getBoundingClientRect();
        renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
        camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix();
      };
      const draw = () => renderer.render(scene, camera);
      resize(); draw();
      figure.classList.add('is-rendered');
      const tl = gsap.timeline({ onUpdate: draw, onComplete: draw });
      tl.to(card.position, { y: 0.22, duration: 0.7, ease: 'power3.out' }, 0.15);
      tl.to(hinge.rotation, { x: 0, duration: 0.9, ease: 'power3.out' }, 0.55);
      const ro = new ResizeObserver(() => { resize(); draw(); });
      ro.observe(host);
      cleanup = () => { tl.kill(); ro.disconnect(); renderer.dispose(); renderer.domElement.remove(); figure.classList.remove('is-rendered'); };
    })();
    return () => { disposed = true; cleanup(); };
  }, [imageId, engine]);

  return (
    <figure className="specimen" ref={fig} aria-labelledby="specimen-caption">
      <div className="specimen-stage" ref={stage}>
        <svg className="specimen-drawing" viewBox="0 0 400 320" aria-hidden="true">
          <rect className="drawing-glass" x="70" y="80" width="260" height="150" rx="6" />
          <rect className="drawing-card" x="110" y="150" width="180" height="64" rx="3" />
          <text className="drawing-text" x="122" y="176">{engine}</text>
          <text className="drawing-text" x="122" y="196">{`image ${imageId.slice(7, 19)}…`}</text>
          <path className="drawing-line" d="M70 230 V80 H330 V230 Z M70 80 L110 52 H370 L330 80 M370 52 V202 L330 230" />
          <rect className="drawing-seal" x="250" y="74" width="40" height="12" rx="2" />
        </svg>
      </div>
      <figcaption id="specimen-caption">
        <span>Sealed record of the recorded Seeds sample</span>
        <code className="hash">{imageId}</code>
        <span>Container image ID from the recorded evidence. Drawn on this page; nothing runs on this site.</span>
      </figcaption>
    </figure>
  );
}
