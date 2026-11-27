import type { Comparison } from '../../lib/sample-run';
import { fmtNum } from '../../lib/format.mjs';

// Server-rendered chart of one comparison (spec 05-ui-redesign, Requirement 7.5). Each node gets its own
// row and its own scale: the published mean, the tolerance band fixed before the run, and the ReproLab mean.
// The verdict is written next to each row in words, so colour is never the only signal.
export function ComparisonChart({ c, title }: { c: Comparison; title: string }) {
  const W = 720; const rowH = 56; const left = 92; const right = 92; const top = 12;
  const H = top + c.rows.length * rowH + 8;
  const iw = W - left - right;
  const id = `chart-${c.id}`;
  return (
    <figure className="chart" data-draw-root="">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`}>
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>For each node, the published mean with its tolerance band and the mean ReproLab recorded. Each row has its own scale. The verdict is written at the end of each row.</desc>
        {c.rows.map((r, i) => {
          const lo0 = Math.min(r.ref_mean - r.mean_tol, r.mean);
          const hi0 = Math.max(r.ref_mean + r.mean_tol, r.mean);
          const pad = (hi0 - lo0) * 0.12 || 0.1;
          const lo = lo0 - pad; const hi = hi0 + pad;
          const x = (v: number) => left + ((v - lo) / (hi - lo)) * iw;
          const y = top + i * rowH + 22;
          const bx = x(r.ref_mean - r.mean_tol);
          const bw = Math.max(2, x(r.ref_mean + r.mean_tol) - bx);
          // The band shows the mean rule only, so the verdict here is the mean check alone.
          const within = Math.abs(r.mean - r.ref_mean) <= r.mean_tol;
          return (
            <g key={r.node}>
              <text className="label" x={0} y={y + 4}>{r.node}</text>
              <line className="track" x1={left} x2={W - right} y1={y} y2={y} />
              <rect className="band" x={bx.toFixed(1)} y={y - 9} width={bw.toFixed(1)} height={18} rx={3} />
              <line className="ref" x1={x(r.ref_mean).toFixed(1)} x2={x(r.ref_mean).toFixed(1)} y1={y - 12} y2={y + 12} />
              <line className="lead-line" data-draw="" x1={x(r.ref_mean).toFixed(1)} x2={x(r.mean).toFixed(1)} y1={y} y2={y} />
              <circle className={within ? 'dot-pass' : 'dot-fail'} cx={x(r.mean).toFixed(1)} cy={y} r={6} />
              <text className="value" x={left} y={y + 26}>{`published ${fmtNum(r.ref_mean)} · ReproLab ${fmtNum(r.mean)}`}</text>
              <text className={within ? 'verdict-pass' : 'verdict-fail'} x={W - right + 16} y={y + 4}>{within ? 'within' : 'outside'}</text>
            </g>
          );
        })}
      </svg>
      <ul className="chart-legend">
        <li><span className="key key-band" aria-hidden="true" />Tolerance band, fixed before the run</li>
        <li><span className="key key-ref" aria-hidden="true" />Published mean (read by eye)</li>
        <li><span className="key key-dot" aria-hidden="true" />ReproLab mean</li>
      </ul>
    </figure>
  );
}
