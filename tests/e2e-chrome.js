// Prueba OPCIONAL de la pagina real en Chrome headless.
// puppeteer-core NO es dependencia del proyecto: instalalo fuera del repo
//   mkdir /tmp/e2e && cd /tmp/e2e && npm i puppeteer-core@23.11.1
//   NODE_PATH=/tmp/e2e/node_modules node tests/e2e-chrome.js . /tmp
// Usa /usr/bin/google-chrome. Sale con codigo 1 si algo falla.

const puppeteer = require('puppeteer-core');
const path = require('path');

const repo = path.resolve(process.argv[2]);
const shots = process.argv[3] || __dirname;
const NEW = 'file://' + repo + '/index-braillegl.html';
const OLD = 'file://' + repo + '/index.html';

let fail = 0;
function check(name, cond, extra) {
  console.log((cond ? 'PASS  ' : 'FALLA ') + name);
  if (!cond) { fail++; if (extra !== undefined) console.log('        obtenido:', JSON.stringify(extra)); }
}

async function open(browser, url) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.jQuery && document.querySelector('#gui .dg'));
  return { page, errors };
}

// paper.install(window) reemplaza window.Event: se dispara con jQuery
const setText = (page, t) => page.evaluate(t => $('#latin').val(t).trigger('input'), t);
const select = (page, sel, v) => page.evaluate((s, v) => $(s).val(v).trigger('change'), sel, v);
const strikes = (page, id) => page.evaluate(id =>
  ($(id).val().match(/^M3 S1;/gm) || []).length, id || '#optimizedgcode');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--allow-file-access-from-files', '--no-sandbox']
  });

  const { page, errors } = await open(browser, NEW);

  // --- carga ---
  check('carga sin errores de consola', errors.length === 0, errors);
  check('la tabla por defecto es Espanol',
    await page.$eval('#braille-table', s => s.value) === 'Espanol (6 puntos)');

  // --- golpes en el G-code ---
  for (const [txt, n] of [['ñu', 8], ['Ñu', 10], ['12', 7]]) {
    await setText(page, txt);
    const opt = await strikes(page);
    const raw = await strikes(page, '#gcode');
    check(`"${txt}" da ${n} M3 S1 (optimizado y crudo)`, opt === n && raw === n, { opt, raw });
  }
  const gc = await page.$eval('#optimizedgcode', t => t.value);
  check('el G-code conserva homing, velocidad, parking y M84',
    /^G28 X;\r?\nG28 Y;\r?\nG1 F4000;\r?\n/.test(gc) && /G1 X0\.00 Y290\.00;\r?\nM84;\r?\n$/.test(gc),
    gc.slice(0, 40) + ' ... ' + gc.slice(-40));

  // --- estado ---
  await setText(page, 'Hola @ mundo');
  const status = await page.$eval('#status', e => e.textContent);
  check('el estado lista los caracteres no traducibles', /@/.test(status) && $warn(await page.$eval('#status', e => e.className)), status);
  function $warn(c) { return /warn/.test(c); }
  check('el estado muestra celdas por linea = 28', /Celdas por línea\s*28/.test(status), status);
  check('el estado tiene aria-live', await page.$eval('#status', e => e.getAttribute('aria-live')) === 'polite');
  const size = await page.$eval('#status', e => e.textContent.match(/(\d+) x (\d+) mm/));
  check('el tamano impreso esta en mm (no dividido otra vez)', size && +size[1] > 50 && +size[1] < 175, size);

  // --- idioma de interfaz ---
  const folders = () => page.$$eval('#gui .dg li.title', l => l.map(x => x.textContent));
  const esFolders = await folders();
  await select(page, '#ui-lang', 'en');
  const enFolders = await folders();
  check('cambiar a ingles reconstruye dat.GUI traducido',
    esFolders.includes('Papel') && enFolders.includes('Paper') && enFolders.includes('Printer'), { esFolders, enFolders });
  check('las etiquetas fuera de dat.GUI cambian',
    await page.$eval('#t-wordWrap', e => e.textContent) === 'Keep words whole' &&
    await page.$eval('#download-gcode', e => e.textContent) === 'Download G-code');
  check('la tabla braille no cambia con el idioma de interfaz',
    await page.$eval('#braille-table', s => s.value) === 'Espanol (6 puntos)');
  check('el atributo lang del documento sigue a la interfaz',
    await page.evaluate(() => document.documentElement.lang) === 'en');
  const labels = await page.$$eval('#gui .property-name', l => l.map(x => x.textContent));
  check('los controles de dat.GUI estan traducidos', labels.includes('Dot spacing') && labels.includes('Mirror X'), labels);
  check('el input de SVG conserva su manejador tras reconstruir',
    await page.evaluate(() => {
      const inp = document.querySelector('#gui input[type=file]');
      const ev = inp && $._data(inp, 'events');
      return !!(ev && ev.change && ev.change.length);
    }));
  await select(page, '#ui-lang', 'fr');
  check('frances', (await folders()).includes('Imprimante'));
  await select(page, '#ui-lang', 'es');

  // --- cambio de tabla ---
  await setText(page, 'ñu');
  await select(page, '#braille-table', '6 dots');
  const st2 = await page.$eval('#status', e => e.textContent);
  check('con la tabla francesa la ñ se reporta como no traducible', /ñ/.test(st2), st2);
  await select(page, '#braille-table', 'Espanol (6 puntos)');
  check('al volver a la espanola no quedan restos de la tabla anterior',
    await strikes(page) === 8 && !(await page.$eval('#status', e => e.className)).includes('warn'));

  // --- paginacion ---
  // palabras distintas para que cada pagina tenga otro contenido
  await setText(page, Array.from({length: 900}, (_, i) => 'palabra' + 'abcdefghij'[i % 10]).join(' '));
  const count = await page.$eval('#page-count', e => e.textContent);
  const total = +count.match(/de (\d+)/)[1];
  check('texto largo: varias paginas', total > 1, count);
  check('boton anterior deshabilitado en la primera', await page.$eval('#page-prev', b => b.disabled));
  check('los botones de pagina tienen aria-label',
    await page.$eval('#page-next', b => b.getAttribute('aria-label')) === 'Siguiente');
  const g1 = await page.$eval('#optimizedgcode', t => t.value);
  await page.click('#page-next');
  check('siguiente pagina', /Página 2 de/.test(await page.$eval('#page-count', e => e.textContent)));
  const g2 = await page.$eval('#optimizedgcode', t => t.value);
  check('el G-code corresponde a la pagina visible', g1 !== g2 && g2.length > 100);
  const fname = await page.evaluate(() => {
    let name = null;
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { name = this.download; };
    $('#download-gcode').click();
    HTMLAnchorElement.prototype.click = orig;
    return name;
  });
  check('la descarga lleva sufijo -p2', fname === 'braille-p2.gcode', fname);
  await page.screenshot({ path: shots + '/braillegl-p2.png' });

  // todas las paginas suman todos los golpes
  const all = await page.evaluate(async () => {
    let sum = 0;
    while (!$('#page-prev').prop('disabled')) $('#page-prev').click();
    for (;;) {
      sum += ($('#optimizedgcode').val().match(/^M3 S1;/gm) || []).length;
      if ($('#page-next').prop('disabled')) break;
      $('#page-next').click();
    }
    return sum;
  });
  const dotsOf = { p: 4, a: 1, l: 3, b: 2, r: 4, c: 2, d: 3, e: 2, f: 3, g: 4, h: 3, i: 2, j: 3 };
  const expected = Array.from({length: 900}, (_, i) => 'palabra' + 'abcdefghij'[i % 10])
    .join('').split('').reduce((n, c) => n + dotsOf[c], 0);
  check('la suma de golpes de todas las paginas = todo el texto', all === expected, [all, expected]);

  // --- papel y vista previa ---
  await setText(page, 'Hola mundo');
  await select(page, '#paper-preset', 'a3');
  const ratio = await page.$eval('#paperCanvas', c => c.clientWidth / c.clientHeight);
  check('la vista previa sigue la relacion de aspecto A3', Math.abs(ratio - 297 / 420) < 0.02, ratio);
  const cpl = await page.$eval('#status', e => e.textContent.match(/Celdas por línea\s*(\d+)/)[1]);
  check('A3 cambia las celdas por linea', +cpl > 28, cpl);
  const guiWidth = await page.evaluate(() => {
    const row = [...document.querySelectorAll('#gui .property-name')].find(e => e.textContent === 'Ancho del papel');
    return row && row.parentElement.querySelector('input').value;
  });
  check('el panel tecnico refleja el ancho del preset', guiWidth === '297', guiWidth);
  const items = await page.evaluate(() => paper.project.activeLayer.children
    .filter(c => c.className === 'Path').map(p => [Math.round(p.bounds.width), Math.round(p.bounds.height)]));
  check('se dibuja el borde de la hoja y el area util',
    JSON.stringify(items) === JSON.stringify([[297, 420], [291, 410]]), items);
  await select(page, '#paper-preset', 'braillerap');
  await page.screenshot({ path: shots + '/braillegl.png', fullPage: true });

  // --- accesibilidad basica ---
  const unlabeled = await page.evaluate(() =>
    [...document.querySelectorAll('main select, main textarea, main input, details textarea, header select')]
      .filter(e => !e.closest('#gui'))
      .filter(e => !document.querySelector('label[for="' + e.id + '"]') || !document.querySelector('label[for="' + e.id + '"]').textContent.trim())
      .map(e => e.id));
  check('cada control visible tiene label con texto', unlabeled.length === 0, unlabeled);
  check('el volcado de G-code esta en un details plegado',
    await page.$eval('details.tech', d => !d.open && d.querySelectorAll('textarea').length === 3));

  check('sin errores de consola al final', errors.length === 0, errors);

  // --- fidelidad con el original ---
  // Misma tabla (francesa), wordWrap desactivado, texto de una sola pagina
  // con un corte de linea a mitad de palabra: el G-code optimizado debe
  // ser identico byte a byte.
  const sample = 'bonjour le monde 123 extraordinaire ' + 'x'.repeat(40) + ' fin';
  const old = await open(browser, OLD);
  await setText(old.page, sample);
  const gOld = await old.page.$eval('#optimizedgcode', t => t.value);
  await select(page, '#braille-table', '6 dots');
  await page.evaluate(() => $('#word-wrap').prop('checked', false).trigger('change'));
  await setText(page, sample);
  const gNew = await page.$eval('#optimizedgcode', t => t.value);
  check('wordWrap off + tabla francesa: G-code identico al original', gOld === gNew && gOld.length > 500,
    [gOld.length, gNew.length]);
  await page.evaluate(() => $('#word-wrap').prop('checked', true).trigger('change'));
  const gWrap = await page.$eval('#optimizedgcode', t => t.value);
  check('con wordWrap el G-code cambia pero con los mismos golpes',
    gWrap !== gNew && (gWrap.match(/M3 S1/g) || []).length === (gNew.match(/M3 S1/g) || []).length);

  await browser.close();
  console.log(fail === 0 ? '\nTODO OK' : '\n' + fail + ' prueba(s) fallaron');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
