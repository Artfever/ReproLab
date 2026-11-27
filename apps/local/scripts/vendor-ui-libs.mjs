// vendor-ui-libs.mjs (spec 05-ui-redesign, task 2).
// Copies built browser files of GSAP, ScrollTrigger, anime.js and three.js, and two IBM Plex Mono
// weights, from unpacked npm tarballs into apps/local/public/vendor and public/fonts, unmodified.
// Then writes public/vendor/manifest.json with each file's version, licence and SHA-256.
//
// Usage (from the repository root):
//   mkdir .scratch/pkgs; cd .scratch/pkgs
//   npm pack gsap@3.15.1 animejs@4.5.0 three@0.187.0 @ibm/plex-mono@2.5.0   (then extract each .tgz into <name>-<version>/)
//   node apps/local/scripts/vendor-ui-libs.mjs .scratch/pkgs
// The tarballs are not committed. Only the copied files and the manifest are.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(HERE, '..', 'public');

export const VENDOR = [
  { lib: 'gsap', version: '3.15.1', licence: "GreenSock Standard 'no charge' licence (https://gsap.com/standard-license). Not an OSI open-source licence.",
    files: [['gsap-3.15.1/package/dist/gsap.min.js', 'vendor/gsap-3.15.1/gsap.min.js'],
      ['gsap-3.15.1/package/dist/ScrollTrigger.min.js', 'vendor/gsap-3.15.1/ScrollTrigger.min.js']] },
  { lib: 'animejs', version: '4.5.0', licence: 'MIT',
    files: [['animejs-4.5.0/package/dist/bundles/anime.esm.min.js', 'vendor/animejs-4.5.0/anime.esm.min.js'],
      ['animejs-4.5.0/package/LICENSE.md', 'vendor/animejs-4.5.0/LICENSE.md']] },
  { lib: 'three', version: '0.187.0', licence: 'MIT',
    files: [['three-0.187.0/package/build/three.module.js', 'vendor/three-0.187.0/three.module.js'],
      ['three-0.187.0/package/build/three.core.js', 'vendor/three-0.187.0/three.core.js'],
      ['three-0.187.0/package/LICENSE', 'vendor/three-0.187.0/LICENSE']] },
  { lib: '@ibm/plex-mono', version: '2.5.0', licence: 'SIL Open Font License 1.1',
    files: [['ibm-plex-mono-2.5.0/package/fonts/complete/woff2/IBMPlexMono-Regular.woff2', 'fonts/IBMPlexMono-Regular.woff2'],
      ['ibm-plex-mono-2.5.0/package/fonts/complete/woff2/IBMPlexMono-Medium.woff2', 'fonts/IBMPlexMono-Medium.woff2'],
      ['ibm-plex-mono-2.5.0/package/LICENSE.txt', 'fonts/OFL.txt']] },
];

const GSAP_NOTICE = `GSAP ${'3.15.1'} and ScrollTrigger are copyright GreenSock (Webflow).
They are redistributed here unmodified under GreenSock's Standard "no charge" licence:
https://gsap.com/standard-license
That licence is not an OSI-approved open-source licence. ReproLab's MIT licence does not cover
these two files. The licence header is kept at the top of each minified file.
`;

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');

function main(pkgDir) {
  const out = [];
  for (const v of VENDOR) {
    for (const [src, dst] of v.files) {
      const from = path.resolve(pkgDir, src);
      if (!existsSync(from)) throw new Error(`missing ${from}`);
      const to = path.join(PUBLIC, dst);
      mkdirSync(path.dirname(to), { recursive: true });
      copyFileSync(from, to);
      out.push({ path: dst, lib: v.lib, version: v.version, licence: v.licence, bytes: readFileSync(to).length, sha256: sha(to) });
    }
  }
  const notice = path.join(PUBLIC, 'vendor/gsap-3.15.1/LICENSE-NOTICE.txt');
  writeFileSync(notice, GSAP_NOTICE);
  out.push({ path: 'vendor/gsap-3.15.1/LICENSE-NOTICE.txt', lib: 'gsap', version: '3.15.1', licence: 'notice written by ReproLab', bytes: readFileSync(notice).length, sha256: sha(notice) });
  writeFileSync(path.join(PUBLIC, 'vendor/manifest.json'), `${JSON.stringify({ schema_version: 1, files: out }, null, 2)}\n`);
  for (const f of out) console.log(`${String(f.bytes).padStart(9)} ${f.sha256.slice(0, 12)} ${f.path}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(path.resolve(process.argv[2] ?? '.scratch/pkgs'));
}
