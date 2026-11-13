// The only place numbers become display text. Tests use the same functions.
export const fmtSeconds = (n) => n.toFixed(3);
export const fmtNum = (n) => Number(n.toPrecision(4)).toString();
export const fmtTol = (n) => Number(n.toPrecision(3)).toString();
export const fmtInt = (n) => Math.round(n).toLocaleString('en-US');