// Patterns that must never appear in site source. Used by disabled-features tests (positive and negative).
export const FORBIDDEN = [
  { id: 'child_process', re: /child_process|execSync|spawn\(/ },
  { id: 'fetch-call', re: /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/ },
  { id: 'form-control', re: /<form\b|<input\b|<textarea\b|<select\b|<button\b|type=["']file["']/i },
  { id: 'server-action', re: /['"]use server['"]/ },
  { id: 'docker-or-engine', re: /\bdocker\b|OpenBUGS\s+-t|\/opt\/openbugs/i },
  { id: 'secret-like', re: /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}/i },
  { id: 'inline-style-attr', re: /\sstyle=\{\{|\sstyle="/ },
  { id: 'dangerous-html', re: /dangerouslySetInnerHTML|eval\(|new Function\(/ },
];
export function scan(text) { return FORBIDDEN.filter((f) => f.re.test(text)).map((f) => f.id); }