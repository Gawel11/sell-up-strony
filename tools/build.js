// Buduje dist/: zaciemniony JS (inline i lib), zminifikowany CSS, noindex w demach.
const fs = require('fs'), path = require('path');
const O = require('javascript-obfuscator'), csso = require('csso');
const SRC = '/home/claude/sell-up-strony', OUT = SRC + '/dist';
const PAGES = ['index.html', 'kebab/index.html', 'pizza/index.html', 'dym-burger/index.html', 'obiady-domowe/index.html', 'razem/index.html', 'bulkaikromka/index.html', 'bubble-tea/index.html'];
const NOINDEX = PAGES.filter(p => p !== 'index.html');
const LIBS = ['lib/sellup-order.js', 'lib/sellup-lead.js', 'lib/sellup-kitchen.js', 'lib/sellup-app.js'];
const OPT = { compact: true, simplify: true, stringArray: true, stringArrayThreshold: 0.75, stringArrayEncoding: ['base64'], stringArrayWrappersCount: 1,
  identifierNamesGenerator: 'hexadecimal', renameGlobals: false, selfDefending: false, controlFlowFlattening: false, deadCodeInjection: false,
  target: 'browser', unicodeEscapeSequence: false, transformObjectKeys: false, splitStrings: false, numbersToExpressions: false, sourceMap: false };
let N = 0;
const ob = code => O.obfuscate(code, Object.assign({}, OPT, { identifiersPrefix: 'su' + (++N).toString(36) + '_' })).getObfuscatedCode();
fs.rmSync(OUT, { recursive: true, force: true });
for (const p of PAGES) {
  let h = fs.readFileSync(path.join(SRC, p), 'utf8');
  h = h.replace(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g, (m, attrs = '', body) => {
    if (/\bsrc=/.test(attrs) || !body.trim()) return m;
    const isText = /type="text\/plain"/.test(attrs);
    if (/type=/.test(attrs) && !isText) return m;
    let out = ob(body);
    if (isText) out = out.replace(/<\/script/gi, '<\\/script');
    return '<script' + attrs + '>' + out + '</script>';
  });
  h = h.replace(/<style>([\s\S]*?)<\/style>/g, (m, css) => '<style>' + csso.minify(css).css + '</style>');
  if (NOINDEX.includes(p) && !/name="robots"/.test(h)) h = h.replace(/<head>/i, '<head>\n<meta name="robots" content="noindex, nofollow, noarchive">');
  fs.mkdirSync(path.dirname(path.join(OUT, p)), { recursive: true });
  fs.writeFileSync(path.join(OUT, p), h);
  console.log(p, (h.length / 1024).toFixed(0) + ' KB');
}
for (const l of LIBS) { fs.mkdirSync(path.dirname(path.join(OUT, l)), { recursive: true }); fs.writeFileSync(path.join(OUT, l), '(function(){' + ob(fs.readFileSync(path.join(SRC, l), 'utf8')) + '})();'); console.log(l); }
