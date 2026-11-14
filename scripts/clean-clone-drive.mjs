// clean-clone-drive.mjs: small HTTP driver used by scripts/verify-clean-clone.ps1 (spec 03-local-product, task 13.1).
// It talks to a running ReproLab local server and prints plain lines. Node built-ins only. Not part of the product.
//   node scripts/clean-clone-drive.mjs <baseUrl> health
//   node scripts/clean-clone-drive.mjs <baseUrl> demos
//   node scripts/clean-clone-drive.mjs <baseUrl> run <demoId>
//   node scripts/clean-clone-drive.mjs <baseUrl> assistant-status
//   node scripts/clean-clone-drive.mjs <baseUrl> ask <question words...>
const [baseArg, cmd, ...rest] = process.argv.slice(2);
if (!baseArg || !cmd) {
  console.error('usage: clean-clone-drive.mjs <baseUrl> health|demos|run <id>|assistant-status|ask <question>');
  process.exit(2);
}
const base = baseArg.replace(/\/$/, '');
const DEADLINE_MS = 6 * 60 * 1000;

async function getJson(p) {
  const r = await fetch(base + p);
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

async function main() {
  if (cmd === 'health') {
    const r = await getJson('/api/health');
    console.log(`GET /api/health -> HTTP ${r.status} ${JSON.stringify(r.body)}`);
    return r.status === 200 && r.body?.ok === true && r.body?.image === 'present' ? 0 : 1;
  }
  if (cmd === 'demos') {
    const r = await getJson('/api/demos');
    for (const d of r.body) {
      console.log(`demo ${d.id}: ${d.request ? 'offered' : 'NOT offered'}${d.missingReason ? ` (${d.missingReason})` : ''}`);
    }
    return 0;
  }
  if (cmd === 'assistant-status') {
    const r = await getJson('/api/assistant/status');
    console.log(`GET /api/assistant/status -> HTTP ${r.status} ${JSON.stringify(r.body)}`);
    return 0;
  }
  if (cmd === 'ask') {
    const question = rest.join(' ');
    const res = await fetch(`${base}/api/assistant/ask`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }),
    });
    console.log(`POST /api/assistant/ask -> HTTP ${res.status} ${await res.text()}`);
    return 0;
  }
  if (cmd === 'run') {
    const id = rest[0];
    const demo = (await getJson('/api/demos')).body.find((d) => d.id === id);
    if (!demo?.request) { console.log(`demo ${id} is not offered`); return 1; }
    const post = await fetch(`${base}/api/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(demo.request),
    });
    const sub = await post.json();
    console.log(`POST /api/runs (${id}) -> HTTP ${post.status} id=${sub.id}`);
    if (post.status !== 202) { console.log(JSON.stringify(sub)); return 1; }
    const t0 = Date.now();
    let run;
    for (;;) {
      run = (await getJson(`/api/runs/${sub.id}`)).body;
      if (!['queued', 'running'].includes(run.state)) break;
      if (Date.now() - t0 > DEADLINE_MS) { console.log('run did not finish in time'); return 1; }
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log(`state: ${run.state}`);
    console.log(`reason: ${run.reason}`);
    console.log(`engineVersion: ${run.engineVersion}`);
    console.log(`runtimeS: ${run.runtimeS}`);
    const errLine = (run.log?.lines ?? []).find((l) => /error|not defined|unexpected|expected|failed/i.test(l));
    console.log(`first engine error line in log: ${errLine ?? '(none)'}`);
    console.log('log lines:');
    for (const l of run.log?.lines ?? []) console.log(`  | ${l}`);
    console.log('files:');
    for (const f of run.files ?? []) console.log(`  ${f.name}  ${f.bytes} bytes  sha256=${f.sha256}`);
    if (run.summary?.available) {
      console.log(`summary label: ${run.summary.label}`);
      console.log(`summary nodes: ${JSON.stringify(run.summary.nodes)}`);
    } else {
      console.log(`summary: not available (${run.summary?.reason ?? 'none'})`);
    }
    const man = await fetch(`${base}/api/runs/${sub.id}/manifest`);
    const manText = await man.text();
    console.log(`GET manifest -> HTTP ${man.status}, ${manText.length} bytes`);
    try {
      const m = JSON.parse(manText);
      console.log(`manifest keys: ${Object.keys(m).join(', ')}`);
      console.log(`manifest image: ${JSON.stringify(m.image)}`);
    } catch { console.log('manifest is not JSON'); }
    const page = await fetch(`${base}/results.html?id=${sub.id}`);
    const html = await page.text();
    console.log(`GET /results.html?id=... -> HTTP ${page.status}, h1 present: ${/<h1[ >]/.test(html)}`);
    const want = { coin: 'succeeded', 'coin-invalid': 'engine_error' }[id];
    if (want && run.state !== want) { console.log(`EXPECTED state ${want}`); return 1; }
    if (id === 'seeds-upstream' && run.state !== 'succeeded') return 1;
    return 0;
  }
  console.error(`unknown command ${cmd}`);
  return 2;
}

main().then((code) => { process.exitCode = code; }, (e) => { console.log(`driver error: ${e?.message ?? e}`); process.exitCode = 1; });
