// Mikro Denetim'i Pyodide'de (tarayıcıdaki Python motoru) değiştirmeden çalıştırır; sahte örnek verilerle.
// Kullanım:  cd web/tarayici-deneme && npm install && pip download --no-deps -d wheels openpyxl et_xmlfile xlrd
//            python3 ornek_uret.py && node deneme.mjs
import { loadPyodide } from 'pyodide';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BURA = path.dirname(fileURLToPath(import.meta.url));
const KOD = path.join(BURA, '..', '..', 'fk', 'fatura_kontrol');
const oku = y => new Uint8Array(fs.readFileSync(y));

const t0 = Date.now();
const py = await loadPyodide();
for (const w of fs.readdirSync(path.join(BURA, 'wheels'))) py.unpackArchive(oku(path.join(BURA, 'wheels', w)), 'wheel');
const kopyala = (k, h) => {
  py.FS.mkdirTree(h);
  for (const a of fs.readdirSync(k)) {
    if (a === '__pycache__') continue;
    const y = path.join(k, a);
    if (fs.statSync(y).isDirectory()) kopyala(y, h + '/' + a); else py.FS.writeFile(h + '/' + a, oku(y));
  }
};
kopyala(KOD, '/kod/fatura_kontrol');
py.runPython(fs.readFileSync(path.join(BURA, 'taslak_moduller.py'), 'utf8'));   // fastapi / sqlite3 / playwright yerine boş modüller
py.FS.mkdirTree('/girdi');
py.FS.writeFile('/girdi/f.zip', oku(path.join(BURA, 'ornek', 'faturalar.zip')));
py.FS.writeFile('/girdi/m.xlsx', oku(path.join(BURA, 'ornek', 'muavin.xlsx')));
console.log('yükleme', Date.now() - t0, 'ms');

const t1 = Date.now();
const sonuc = py.runPython(`
import sys, os, json
sys.path.insert(0, '/kod'); os.environ['FK_VERI'] = '/veri'
from datetime import date
from pathlib import Path
from fatura_kontrol import kontrol as K
from fatura_kontrol.denetim import denetle
klasor, b, e, vkn, ad = K.yuklenenleri_yerlestir([Path('/girdi/f.zip')], [Path('/girdi/m.xlsx')], date(2026, 9, 1), date(2026, 9, 30),
                                                None, 'mikro', None, 'ÖRNEK TİCARET A.Ş.', [])
veri = K.calistir(klasor, b, e, vkn, ad)
d = denetle(klasor, b, e, vkn, ad, veri.get('id', ''))
json.dumps({'sorunlu': {k: v['sorunlu'] for k, v in d['ozet'].items()},
            'dosyalar': sorted(str(p.relative_to('/veri')) for p in Path('/veri').rglob('*') if p.is_file())}, ensure_ascii=False)
`);
console.log('denetim', Date.now() - t1, 'ms');
console.log(sonuc);
