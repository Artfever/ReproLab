// Compares ./LICENSE with the embedded SPDX MIT template, ignoring the copyright line.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const MIT_TEMPLATE = `MIT License

Copyright (c) <year> <copyright holders>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

const COPYRIGHT = /^Copyright \(c\) (\d{4}) \S.*$/m;
const norm = (s) => s.replace(/\r\n/g, '\n').trimEnd();

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const actual = norm(readFileSync(join(root, 'LICENSE'), 'utf8'));
const lines = actual.split('\n');
const idx = lines.findIndex((l) => COPYRIGHT.test(l));
if (idx !== 2) {
  console.error('MIT FAIL: copyright line must be the first line after the title');
  process.exit(1);
}
const template = norm(MIT_TEMPLATE).split('\n');
template[2] = lines[2];
if (template.join('\n') !== actual) {
  console.error('MIT FAIL: LICENSE differs from the SPDX MIT template beyond the copyright line');
  process.exit(1);
}
console.log('MIT OK');
