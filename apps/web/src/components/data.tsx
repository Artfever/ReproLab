import type { ReactNode } from 'react';

export interface Column { key: string; label: string; numeric?: boolean }

export function DataTable({ id, caption, columns, rows, kind }: {
  id: string; caption: string; columns: Column[]; rows: Record<string, ReactNode>[]; kind?: 'pre_declared' | 'post_hoc';
}) {
  return (
    <div className="table-scroll" role="region" aria-labelledby={`${id}-cap`} tabIndex={0}>
      <table data-comparison-kind={kind}>
        <caption id={`${id}-cap`}>{caption}</caption>
        <thead>
          <tr>{columns.map((c) => <th key={c.key} scope="col" className={c.numeric ? 'num' : undefined}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c, j) => j === 0
                ? <th key={c.key} scope="row">{r[c.key]}</th>
                : <td key={c.key} className={c.numeric ? 'num' : undefined}>{r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Hash({ value }: { value: string }) {
  return <code className="hash">{value}</code>;
}

const CLS: Record<string, string> = { pass: 'status-pass', succeeded: 'status-pass', fail: 'status-fail', failed: 'status-fail', timed_out: 'status-warn', 'post hoc': 'status-warn' };
export function StatusText({ status, children }: { status: string; children?: ReactNode }) {
  return <span className={CLS[status] ?? ''}>{children ?? status}</span>;
}

export function ProgramOutput({ run, lines }: { run: string; lines: { line_no: number; text: string }[] }) {
  return (
    <figure>
      <figcaption>Program output ({run}/log.txt)</figcaption>
      <pre>{lines.map((l) => `line ${l.line_no}: ${l.text}`).join('\n')}</pre>
    </figure>
  );
}