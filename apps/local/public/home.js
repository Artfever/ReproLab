// home.js: Home page behaviour (spec 05-ui-redesign, task 9).
// 1. The specimen case (three.js) shows the recorded hash that is also printed in the caption.
// 2. The machine strip asks the local server for Docker, image and engine status.
// 3. The recorded Coin log, already in the page as text, is typed once when it scrolls into view.
// All server text is inserted with textContent.
import { gsapOrNull } from '/motion.js';

const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, text) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
};

const ENGINE_WORD = { ready: ['Ready', 'ok'], setup_required: ['Setup required', 'wait'], planned: ['Planned', 'idle'] };

function setWord(node, word, tone) {
  node.textContent = word;
  node.setAttribute('data-tone', tone);
}

async function machine() {
  try {
    const res = await fetch('/api/health', { headers: { Accept: 'application/json' } });
    const h = await res.json();
    setWord($('health-docker'), h.docker === 'ok' ? 'Running' : h.docker === 'not_running' ? 'Installed, not running' : 'Not found', h.docker === 'ok' ? 'ok' : 'bad');
    setWord($('health-image'), h.image === 'present' ? 'Built' : 'Not built', h.image === 'present' ? 'ok' : 'wait');
  } catch {
    setWord($('health-docker'), 'Could not ask the server', 'bad');
    setWord($('health-image'), 'Could not ask the server', 'bad');
  }
  try {
    const res = await fetch('/api/engines', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('engines');
    const list = await res.json();
    const ul = $('engine-list');
    ul.replaceChildren(...list.map((e) => {
      const [word, tone] = ENGINE_WORD[e.status] ?? ['Unknown', 'idle'];
      const li = el('li');
      const name = el('span', { class: 'engine-name' }, e.name);
      const ver = el('span', { class: 'engine-version' }, e.version ? `version ${e.version}` : '');
      const st = el('span', { class: 'status-word', 'data-tone': tone }, word);
      li.append(name, ver, st);
      return li;
    }));
    $('machine-note').textContent = `${list.filter((e) => e.status === 'ready').length} of ${list.length} engines ready on this machine. Asked from the local server when this page loaded.`;
  } catch {
    $('engine-list').replaceChildren(el('li', {}, 'The engine list could not be loaded. The Run page shows it as well.'));
  }
}

function replay() {
  const pre = $('replay-log');
  const gsap = gsapOrNull();
  if (!pre || !gsap || !('IntersectionObserver' in window)) return;
  const full = pre.textContent;
  const lines = full.split('\n');
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    const state = { n: 0 };
    pre.textContent = '';
    gsap.to(state, {
      n: lines.length, duration: 1.4, ease: 'none',
      onUpdate: () => { pre.textContent = lines.slice(0, Math.round(state.n)).join('\n'); },
      onComplete: () => { pre.textContent = full; },
    });
  }, { threshold: 0.4 });
  io.observe(pre);
}

async function specimen() {
  const stage = $('specimen-stage');
  if (!stage) return;
  try {
    const { mountSpecimen } = await import('/specimen.js');
    await mountSpecimen({
      stage,
      figure: $('specimen'),
      record: {
        file: 'coda_CODAchain1.txt',
        sha: $('specimen-hash-text').textContent.trim(),
        engine: 'OpenBUGS 3.2.3 rev 1012',
        bytes: '129,880 bytes · Coin example',
      },
    });
  } catch {
    /* The CSS drawing stays in place. */
  }
}

machine();
replay();
specimen();
