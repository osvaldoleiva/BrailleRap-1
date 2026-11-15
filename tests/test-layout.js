// Pruebas del maquetador braille. Sin framework:
//   node tests/test-layout.js
// Imprime PASS / FALLA por caso y sale con codigo 1 si algo falla.

const fs = require('fs');
const vm = require('vm');
const root = __dirname + '/../';

// Las tablas escriben en una variable global `languages`, como en la pagina.
global.languages = {};
for (const f of ['braille-es.js', 'braille6.js', 'braille6india.js',
                 'braille8old.js', 'braille8new.js', 'devnagrinumbers.js']) {
  vm.runInThisContext(fs.readFileSync(root + f, 'utf8'), { filename: f });
}
const L = require(root + 'braillegl-layout.js');

const es = languages['Espanol (6 puntos)'];
const fr = languages['6 dots'];

// Valores por defecto de script.js (crocsg/BrailleRap)
function metrics(over) {
  return Object.assign({
    paperWidth: 175, paperHeight: 290,
    marginWidth: 3, marginHeight: 5,
    letterWidth: 2.3, letterPadding: 3.75, linePadding: 3,
    dotRadius: 1.25, rowsStep: 3, wordWrap: true
  }, over || {});
}
const ADV = 2.3 + 3.75;

// Columna de una celda (0, 1, 2...) a partir de su x en mm
const col = (c, m) => Math.round((c.x - (m || metrics()).marginWidth) / ADV);

// Agrupa las celdas de cada pagina por linea: [[ [col, 'puntos'], ... ], ...]
function lines(pageCells) {
  const byY = new Map();
  for (const c of pageCells) {
    const k = c.y.toFixed(3);
    if (!byY.has(k)) byY.set(k, []);
    byY.get(k).push(c);
  }
  return [...byY.keys()].sort((a, b) => a - b).map(k =>
    byY.get(k).sort((a, b) => a.x - b.x));
}

function run(text, m, lang) {
  const tk = L.textToTokens(text, lang || es, {});
  const out = L.layout(tk.tokens, m || metrics());
  return { tk, out, pages: out.pages.map(lines) };
}

const cellsStr = cells => JSON.stringify(cells);

let fail = 0;
function check(name, cond, extra) {
  console.log((cond ? 'PASS  ' : 'FALLA ') + name);
  if (!cond) {
    fail++;
    if (extra !== undefined) console.log('        obtenido:', JSON.stringify(extra));
  }
}

// ---------------------------------------------------------------------
// 1. 28 celdas por linea con los valores por defecto
// ---------------------------------------------------------------------
{
  const r = run('a', metrics());
  check('1. con los valores por defecto caben 28 celdas por linea',
    r.out.cellsPerLine === 28, r.out.cellsPerLine);
  // y la celda 28 es efectivamente la ultima que entra
  const x27 = 3 + 27 * ADV, x28 = 3 + 28 * ADV;
  check('1b. la celda 28 cabe y la 29 no',
    x27 + 2.3 + 1.25 <= 172 && x28 + 2.3 + 1.25 > 172);
}

// ---------------------------------------------------------------------
// 2. Una palabra que no cabe en lo que queda de linea baja entera
// ---------------------------------------------------------------------
{
  // "aaaa " x4 ocupa 20 posiciones (16 letras + 4 espacios). Quedan 8;
  // "murcielago" tiene 10 celdas: debe bajar entera.
  const r = run('aaaa '.repeat(4) + 'murcielago extraordinario');
  const [l1, l2] = r.pages[0];
  check('2. la palabra que no cabe baja entera',
    l1.length === 16 && l2.length >= 10 && col(l2[0]) === 0 &&
    cellsStr(l2.slice(0, 10).map(c => c.dots)) ===
      cellsStr(L.textToTokens('murcielago', es).tokens[0].cells),
    { linea1: l1.length, linea2: l2.map(c => c.dots.join('')) });
  check('2b. el espacio pendiente al final de la linea se descarta',
    col(l2[0]) === 0, l2.length && col(l2[0]));

  // prefijos incluidos en la medida: "Hola" son 5 celdas (4-6 + h o l a)
  const r2 = run('a'.repeat(24) + ' Hola');
  // 24 + 1 espacio = 25; 5 celdas no caben en las 3 restantes
  check('2c. la palabra se mide con sus celdas de prefijo',
    r2.pages[0].length === 2 && r2.pages[0][1].length === 5 &&
    cellsStr(r2.pages[0][1][0].dots) === '[4,6]',
    r2.pages[0].map(l => l.length));
  // con 4 letras de relleno la ultima celda de "Hola" cae justo en la 28
  const r3 = run('a'.repeat(22) + ' Hola');
  check('2d. una palabra que termina justo en la ultima columna no baja',
    r3.pages[0].length === 1 && col(r3.pages[0][0][26]) === 27,
    r3.pages[0].map(l => l.length));
}

// ---------------------------------------------------------------------
// 3. Una palabra mas larga que la linea si se corta
// ---------------------------------------------------------------------
{
  const r = run('x'.repeat(40));
  check('3. una palabra mas larga que la linea se corta (28 + 12)',
    r.pages[0].length === 2 && r.pages[0][0].length === 28 && r.pages[0][1].length === 12,
    r.pages[0].map(l => l.length));
  const r2 = run('ab ' + 'x'.repeat(40));
  // "ab" + espacio usan 3 columnas: entran 25 x en la primera linea
  check('3b. la palabra larga empieza en la misma linea y se corta',
    r2.pages[0][0].length === 2 + 25 && r2.pages[0][1].length === 15,
    r2.pages[0].map(l => l.length));
}

// ---------------------------------------------------------------------
// 4. Mismo texto con y sin wordWrap
// ---------------------------------------------------------------------
{
  const text = 'a'.repeat(26) + ' hola';
  const off = run(text, metrics({ wordWrap: false }));
  const on = run(text, metrics({ wordWrap: true }));
  // 26 letras + 1 espacio = 27 posiciones: sin wordWrap solo entra la h
  check('4a. sin wordWrap la palabra se parte (27 + 3)',
    off.pages[0][0].length === 27 && off.pages[0][1].length === 3,
    off.pages[0].map(l => l.length));
  check('4b. con wordWrap baja entera (26 + 4)',
    on.pages[0][0].length === 26 && on.pages[0][1].length === 4,
    on.pages[0].map(l => l.length));
  check('4c. ambos modos ubican la misma cantidad de celdas',
    off.out.cellsPlaced === on.out.cellsPlaced && on.out.cellsPlaced === on.tk.cellCount);
}

// ---------------------------------------------------------------------
// 5. Signo de numero una vez por grupo
// ---------------------------------------------------------------------
{
  const NUM = '[3,4,5,6]';
  const t1 = L.textToTokens('1234', es);
  check('5a. 1234 = prefijo + 4 celdas',
    t1.cellCount === 5 && cellsStr(t1.tokens[0].cells) ===
      cellsStr([[3,4,5,6], [1], [1,2], [1,4], [1,4,5]]), t1.tokens[0].cells);
  const t2 = L.textToTokens('1.000', es);
  check('5b. 1.000 no repite el prefijo (prefijo + 1 . 0 0 0)',
    t2.cellCount === 6 && cellsStr(t2.tokens[0].cells) ===
      cellsStr([[3,4,5,6], [1], [3], [2,4,5], [2,4,5], [2,4,5]]), t2.tokens[0].cells);
  const t3 = L.textToTokens('12 34', es);
  const prefixes = t3.tokens.filter(t => t.t === 'w')
    .map(w => w.cells.filter(c => cellsStr(c) === NUM).length);
  check('5c. 12 34 lleva dos prefijos', cellsStr(prefixes) === '[1,1]' && t3.cellCount === 6, prefixes);
  const t4 = L.textToTokens('3,5', es);
  check('5d. la coma decimal tampoco repite el prefijo', t4.cellCount === 4, t4.tokens[0].cells);
  const t5 = L.textToTokens('Hay 3.', es);
  const w = t5.tokens.filter(t => t.t === 'w')[1].cells;
  check('5e. el punto final tras una cifra sale del numero',
    cellsStr(w) === cellsStr([[3,4,5,6], [1,4], [3]]), w);
  const t6 = L.textToTokens('1.2.3', es);
  check('5f. 1.2.3 sigue siendo un solo numero',
    t6.tokens[0].cells.filter(c => cellsStr(c) === NUM).length === 1, t6.tokens[0].cells);
}

// ---------------------------------------------------------------------
// 6. Mayusculas acentuadas
// ---------------------------------------------------------------------
{
  const t = L.textToTokens('Ñandú Árbol', es);
  const [w1, , w2] = t.tokens;
  check('6a. Ñandú empieza con [4,6] + ñ (12456)',
    cellsStr(w1.cells.slice(0, 2)) === '[[4,6],[1,2,4,5,6]]', w1.cells);
  check('6b. Ñandú termina con ú (23456)',
    cellsStr(w1.cells[w1.cells.length - 1]) === '[2,3,4,5,6]', w1.cells);
  check('6c. Árbol empieza con [4,6] + á (12356)',
    cellsStr(w2.cells.slice(0, 2)) === '[[4,6],[1,2,3,5,6]]', w2.cells);
  check('6d. ningun caracter no soportado', t.unsupported.length === 0, t.unsupported);
  const t2 = L.textToTokens('É Í Ó Ú Ü', es);
  check('6e. É Í Ó Ú Ü llevan prefijo y celda propia',
    cellsStr(t2.tokens.filter(x => x.t === 'w').map(x => x.cells)) ===
      cellsStr([[[4,6],[2,3,4,6]], [[4,6],[3,4]], [[4,6],[3,4,6]],
                [[4,6],[2,3,4,5,6]], [[4,6],[1,2,5,6]]]));
}

// ---------------------------------------------------------------------
// 7. La barra ocupa dos celdas
// ---------------------------------------------------------------------
{
  const t = L.textToTokens('a/b', es);
  check('7. la barra / ocupa dos celdas (6 y 2)',
    cellsStr(t.tokens[0].cells) === '[[1],[6],[2],[1,2]]', t.tokens[0].cells);
  const r = run('a'.repeat(26) + ' x/y');
  check('7b. las dos celdas de la barra cuentan al medir la palabra',
    r.pages[0].length === 2 && r.pages[0][1].length === 4, r.pages[0].map(l => l.length));
}

// ---------------------------------------------------------------------
// 8. No soportados
// ---------------------------------------------------------------------
{
  const t = L.textToTokens('hola @ mundo # @', es);
  check('8. se reportan @ y # una sola vez', t.unsupported.join('') === '@#', t.unsupported);
}

// ---------------------------------------------------------------------
// 9. Paginacion sin perdida
// ---------------------------------------------------------------------
{
  const r = run('palabra '.repeat(600));
  const placed = r.out.pages.reduce((n, p) => n + p.length, 0);
  check('9a. un texto largo genera varias paginas', r.out.pages.length > 1, r.out.pages.length);
  check('9b. no se pierde ninguna celda',
    r.out.cellsPlaced === r.tk.cellCount && placed === r.tk.cellCount,
    [r.out.cellsPlaced, placed, r.tk.cellCount]);
  const m = metrics();
  const inside = r.out.pages.every(p => p.every(c =>
    c.x >= m.marginWidth && c.x + m.letterWidth + m.dotRadius <= m.paperWidth - m.marginWidth &&
    c.y >= m.marginHeight && c.y <= m.paperHeight - m.marginHeight));
  check('9c. todas las celdas quedan dentro del area util', inside);
  check('9d. ninguna pagina supera las lineas por pagina',
    r.pages.every(p => p.length <= r.out.linesPerPage),
    [r.out.linesPerPage, r.pages.map(p => p.length)]);
  // texto que llena justo una pagina y termina en salto: sin pagina vacia
  const full = ('a'.repeat(28) + '\n').repeat(r.out.linesPerPage);
  const r2 = run(full);
  check('9e. un salto final tras llenar la hoja no crea una pagina vacia',
    r2.out.pages.length === 1, r2.out.pages.length);
}

// ---------------------------------------------------------------------
// 10. Saltos de linea explicitos y lineas en blanco
// ---------------------------------------------------------------------
{
  const ys = text => {
    const r = run(text);
    return [...new Set(r.out.pages[0].map(c => +c.y.toFixed(2)))];
  };
  // avance de linea = 3 * 2.3 + 3 = 9.9 mm
  check('10a. uno\\ndos\\n\\ntres deja una linea en blanco',
    cellsStr(ys('uno\ndos\n\ntres')) === cellsStr([5, 14.9, 34.7]), ys('uno\ndos\n\ntres'));
  check('10b. \\r\\n y \\r equivalen a \\n',
    cellsStr(ys('uno\r\ndos\r\rtres')) === cellsStr([5, 14.9, 34.7]), ys('uno\r\ndos\r\rtres'));
  const r = run('a  b\n   c');
  const [l1, l2] = r.pages[0];
  check('10c. doble espacio y sangria se conservan',
    col(l1[1]) === 3 && col(l2[0]) === 3, [l1.map(c => col(c)), l2.map(c => col(c))]);
}

// ---------------------------------------------------------------------
// 11. La tabla francesa original sigue funcionando
// ---------------------------------------------------------------------
{
  const t = L.textToTokens('Bonjour, le monde! 12', fr);
  check('11a. la tabla francesa traduce sin no soportados', t.unsupported.length === 0, t.unsupported);
  check('11b. la francesa usa su propio prefijo de numero [6]',
    cellsStr(t.tokens[t.tokens.length - 1].cells) === '[[6],[1,6],[1,2,6]]',
    t.tokens[t.tokens.length - 1].cells);
  check('11c. la francesa usa [4,6] como mayuscula',
    cellsStr(t.tokens[0].cells[0]) === '[4,6]', t.tokens[0].cells[0]);
}

// ---------------------------------------------------------------------
// Extras: 8 puntos y devanagari
// ---------------------------------------------------------------------
{
  const t8 = L.textToTokens('Ab', languages['new 8 dots'], { useCapitalPrefix: false });
  check('12. en 8 puntos la mayuscula es una celda propia, sin prefijo',
    t8.cellCount === 2 && cellsStr(t8.tokens[0].cells[0]) ===
      cellsStr(languages['new 8 dots'].latinToBraille['A']), t8.tokens[0].cells);
  const r8 = L.layout(t8.tokens, metrics({ rowsStep: 2 }));
  check('12b. en 8 puntos el avance de linea usa 2 filas',
    L.layout(L.textToTokens('a\nb', languages['new 8 dots'], { useCapitalPrefix: false }).tokens,
      metrics({ rowsStep: 2 })).pages[0][1].y === 5 + 2 * 2.3 + 3);

  const hooks = { digitOf: compairCharAgaistDevnagriNumber,
                  specialPrefixOf: getPrefixforSpecialcharacter };
  const ind = languages['6 dots India'];
  const td = L.textToTokens('१२', ind, hooks);
  check('13. cifras devanagari: un prefijo por grupo',
    td.cellCount === 3 && cellsStr(td.tokens[0].cells[0]) === '[3,4,5,6]' &&
      td.unsupported.length === 0, td);
  const ts = L.textToTokens('ऋऋ', ind, hooks);
  check('13b. prefijo especial devanagari antes de cada caracter',
    ts.cellCount === 4 && cellsStr(ts.tokens[0].cells[0]) === '[5]' &&
      cellsStr(ts.tokens[0].cells[2]) === '[5]', ts.tokens[0] && ts.tokens[0].cells);
}

console.log(fail === 0 ? '\nTODO OK' : '\n' + fail + ' prueba(s) fallaron');
process.exit(fail ? 1 : 0);
