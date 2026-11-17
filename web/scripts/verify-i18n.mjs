// Every translation key the source uses exists in all five dictionaries. translate() shows the
// key itself when it's missing, so a typo is neither a crash nor a blank: the page renders
// "car:dialy_price". Keys built by concatenation ('car:status:' + id) are checked as prefixes: each
// dictionary needs at least one key starting with them. Full parity isn't checked: the files are
// the phone app's, which carry a few unused GhostChef keys.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LANGS = [ 'fr', 'en', 'tnfr', 'tnar', 'ar' ];
const dictionaries = Object.fromEntries(LANGS.map(lang => [ lang, Object.keys(JSON.parse(readFileSync(`src/i18n/${lang}.json`, 'utf8'))) ]));
const failures = [];
let used = 0;

const files = (dir) => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [ path ] : [];
});
// A quoted 'namespace:key' literal (the only shape keys take here).
const KEY = /['"`]([a-z_]+:[a-z0-9_:.-]*)['"`]/g;
for (const file of [ ...files('pages'), ...files('src') ]) {
  for (const [ , key ] of readFileSync(file, 'utf8').matchAll(KEY)) {
    if (/^(https?|tel|data|blob):/.test(key)) {
      continue;
    }
    used++;
    for (const lang of LANGS) {
      const exists = key.endsWith(':') ? dictionaries[lang].some(existing => existing.startsWith(key)) : dictionaries[lang].includes(key);
      if (! exists) {
        failures.push(`${file}: '${key}' missing in ${lang}.json`);
      }
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`i18n: ${used} key uses checked in ${LANGS.length} languages, all present.`);
