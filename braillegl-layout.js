// =====================================================================
// braillegl-layout.js
//
// Motor de maquetacion braille: convierte texto en celdas y ubica esas
// celdas en la hoja respetando las palabras completas.
//
// Dos etapas separadas a proposito:
//   1. textToTokens(): texto -> celdas, resolviendo prefijos (mayuscula,
//      numero, caracteres especiales) y signos de mas de una celda.
//   2. layout(): celdas -> posiciones en mm, con salto de linea por
//      palabra y paginacion.
//
// Funciona en el navegador (window.BrailleGLLayout) y en node
// (module.exports), para poder probarlo sin abrir la pagina.
// =====================================================================

(function (root) {
	'use strict';

	// ---------------------------------------------------------------
	// Etapa 1: texto -> celdas
	// ---------------------------------------------------------------

	// Un valor de la tabla puede ser:
	//   [1,2,4]              -> una celda
	//   [[6],[2]]            -> varias celdas (p. ej. la barra en espanol)
	function toCellList(value) {
		if (value == null) {
			return null;
		}
		if (value.length > 0 && Array.isArray(value[0])) {
			return value.map(function (c) { return c.slice(); });
		}
		return [value.slice()];
	}

	function isDigitChar(c) {
		return c >= '0' && c <= '9';
	}

	function isLetter(c) {
		return c.toLowerCase() !== c.toUpperCase();
	}

	function isUpper(c) {
		return c !== c.toLowerCase();
	}

	function isLower(c) {
		return c !== c.toUpperCase();
	}

	function isBlank(c) {
		return c === ' ' || c === '\t' || c === '\n' || c === '\r';
	}

	// Superindices de Unicode aceptados como entrada en modo matematicas.
	// No es normativa: solo dice que caracter normal representa cada uno.
	var SUPERSCRIPTS = {
		'⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
		'⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
		'⁺': '+', '⁻': '-', '⁼': '=', '⁽': '(', '⁾': ')',
		'ⁿ': 'n', 'ⁱ': 'i'
	};

	// CMU 4.2.1: el indice formado por varios terminos va entre parentesis
	// auxiliares. Se considera que hay varios terminos cuando aparece un
	// +, - o = fuera de parentesis y no en la primera posicion (asi
	// x^-1 queda "x1-#a" y x^-(a+b) queda "x1-(a+b)", como en el 5.2.1).
	function needsAuxParens(s) {
		var depth = 0;
		for (var i = 0; i < s.length; i++) {
			var c = s[i];
			if (c === '(') {
				depth++;
			} else if (c === ')') {
				depth--;
			} else if (depth === 0 && i > 0 && (c === '+' || c === '-' || c === '=')) {
				return true;
			}
		}
		return false;
	}

	// CMU, notacion "0d": la celda siguiente no puede tener los puntos
	// 1, 2 ni 3; si los tiene, se deja un cajetin en blanco antes.
	function hasLeftColumnDots(cell) {
		return cell.indexOf(1) >= 0 || cell.indexOf(2) >= 0 || cell.indexOf(3) >= 0;
	}

	/**
	 * Analisis previo de mayusculas (modo literatura).
	 *
	 * Documento B 2 de la ONCE:
	 *   7.1 siglas: dos signos de mayuscula antes de la primera letra.
	 *   7.2 mayusculas como cambio tipografico: el texto va en minusculas
	 *       entre dos signos de escritura especial (puntos 35).
	 *
	 * Una palabra (tramo sin espacios ni saltos) esta "entera en
	 * mayusculas" si tiene dos o mas mayusculas y ninguna minuscula. Las
	 * cifras y la puntuacion no la rompen.
	 *
	 * @param {string} text
	 * @param {string} mode  'palabra' | 'tipografico'
	 * @param {Array} capitalPrefix  celda del signo de mayuscula
	 * @param {Array} typographicSign  celda del signo de escritura especial
	 * @returns {{before: object, after: object, suppress: object}}
	 *          celdas a poner antes / despues de la posicion i, y posiciones
	 *          de mayusculas que no llevan su prefijo individual
	 */
	function analyzeCaps(text, mode, capitalPrefix, typographicSign) {
		var before = {};
		var after = {};
		var suppress = {};
		var words = [];
		var line = 0;
		var i = 0;

		while (i < text.length) {
			var c = text[i];
			if (c === '\n' || c === '\r') {
				line++;
				i++;
				continue;
			}
			if (isBlank(c)) {
				i++;
				continue;
			}
			var w = { line: line, first: -1, last: -1, uppers: [], lowers: 0 };
			while (i < text.length && !isBlank(text[i])) {
				var ch = text[i];
				if (isLetter(ch)) {
					if (w.first < 0) {
						w.first = i;
					}
					w.last = i;
					if (isUpper(ch)) {
						w.uppers.push(i);
					} else if (isLower(ch)) {
						w.lowers++;
					}
				}
				i++;
			}
			w.allCaps = w.uppers.length >= 2 && w.lowers === 0;
			words.push(w);
		}

		function suppressWord(wd) {
			for (var k = 0; k < wd.uppers.length; k++) {
				suppress[wd.uppers[k]] = true;
			}
		}

		for (var j = 0; j < words.length; j++) {
			var wd = words[j];
			if (!wd.allCaps) {
				continue;
			}
			if (mode === 'tipografico') {
				// Grupo de palabras seguidas en mayusculas en la misma linea
				var end = j;
				while (end + 1 < words.length && words[end + 1].allCaps &&
						words[end + 1].line === wd.line) {
					end++;
				}
				before[wd.first] = [typographicSign.slice()];
				after[words[end].last] = [typographicSign.slice()];
				for (var g = j; g <= end; g++) {
					suppressWord(words[g]);
				}
				j = end;
			} else {
				// 'palabra': dos signos de mayuscula pegados a la primera letra
				before[wd.first] = [capitalPrefix.slice(), capitalPrefix.slice()];
				suppressWord(wd);
			}
		}

		return { before: before, after: after, suppress: suppress };
	}

	/**
	 * Convierte el texto en una lista de tokens.
	 *
	 * @param {string} text
	 * @param {object} lang  entrada de `languages[...]`
	 * @param {object} [hooks]
	 *        digitOf, specialPrefixOf: cifras o prefijos propios (devanagari
	 *          del proyecto original)
	 *        useCapitalPrefix: false en las tablas de 8 puntos
	 *        mode: 'literatura' (por defecto) | 'matematicas'. El modo
	 *          matematicas solo tiene efecto si la tabla trae un bloque `math`
	 *        capsMode: 'palabra' | 'tipografico'; si falta se usa el de la
	 *          tabla. Sin capsMode no hay agrupamiento de mayusculas
	 * @returns {{tokens: Array, unsupported: Array<string>, cellCount: number}}
	 *
	 * Tokens: {t:'w', cells:[[dots]], text:'palabra'} | {t:'s'} | {t:'n'}
	 */
	function textToTokens(text, lang, hooks) {
		hooks = hooks || {};
		var table = lang.latinToBraille;
		var numberPrefix = lang.numberPrefix || null;
		var capitalPrefix = lang.capitalPrefix || [4, 6];
		// Las tablas de 8 puntos traen la mayuscula en la propia celda,
		// asi que ahi no se antepone prefijo.
		var useCaps = hooks.useCapitalPrefix !== false && capitalPrefix != null;
		var math = (hooks.mode === 'matematicas' && lang.math) ? lang.math : null;

		// En matematicas el prefijo de mayuscula es parte inseparable de
		// cada letra (CMU 1.1), asi que no hay agrupamiento.
		var capsMode = hooks.capsMode || lang.capsMode || null;
		var caps = (!math && useCaps && capsMode)
			? analyzeCaps(text, capsMode, capitalPrefix, lang.typographicSign || [3, 5])
			: null;

		var tokens = [];
		var unsupported = [];
		var seenUnsupported = {};
		var cellCount = 0;

		var word = null;          // token en construccion
		var inNumber = false;
		// Modo matematicas: las letras a-j llevan prefijo de minuscula
		// (CMU 1.1 y 2.5) mientras dure la expresion numerica.
		var guardLetters = false;
		// Modo matematicas: el signo anterior exige semicajetin libre (0d).
		var pendingHalf = false;

		function lookup(c) {
			if (math && math.signs && math.signs[c] != null) {
				return toCellList(math.signs[c]);
			}
			return toCellList(table[c]);
		}

		function flushWord() {
			if (word && word.cells.length > 0) {
				tokens.push(word);
			}
			word = null;
		}

		function openWord() {
			if (!word) {
				word = { t: 'w', cells: [], text: '' };
			}
			return word;
		}

		function pushCells(cells) {
			var w = openWord();
			for (var i = 0; i < cells.length; i++) {
				if (pendingHalf) {
					pendingHalf = false;
					if (hasLeftColumnDots(cells[i])) {
						w.cells.push([]);
						cellCount++;
					}
				}
				w.cells.push(cells[i]);
				cellCount++;
			}
		}

		function wordCells(tks) {
			var out = [];
			for (var k = 0; k < tks.length; k++) {
				if (tks[k].t === 'w') {
					out = out.concat(tks[k].cells);
				}
			}
			return out;
		}

		function markUnsupported(c) {
			if (!seenUnsupported[c]) {
				seenUnsupported[c] = true;
				unsupported.push(c);
			}
		}

		for (var i = 0; i < text.length; i++) {
			var c = text[i];

			// Salto de linea explicito: \n, \r\n o \r suelto
			if (c === '\n' || c === '\r') {
				if (c === '\r' && text[i + 1] === '\n') {
					i++;
				}
				flushWord();
				tokens.push({ t: 'n' });
				inNumber = false;
				guardLetters = false;
				pendingHalf = false;
				continue;
			}

			// Espacio en blanco
			if (c === ' ' || c === '\t') {
				flushWord();
				tokens.push({ t: 's' });
				inNumber = false;
				guardLetters = false;
				pendingHalf = false;
				continue;
			}

			// Modo matematicas: superindice a la derecha (CMU 4.2.1 y 5.2.1).
			// Los superindices seguidos forman un solo exponente: prefijo 16 y
			// el exponente; si tiene varios terminos, entre parentesis
			// auxiliares. La vuelta a la linea base no lleva signo propio.
			if (math && SUPERSCRIPTS[c] != null) {
				var supStart = i;
				var sup = '';
				while (i < text.length && SUPERSCRIPTS[text[i]] != null) {
					sup += SUPERSCRIPTS[text[i]];
					i++;
				}
				i--;
				var inner = textToTokens(sup, lang, {
					mode: 'matematicas',
					useCapitalPrefix: hooks.useCapitalPrefix
				});
				for (var u = 0; u < inner.unsupported.length; u++) {
					markUnsupported(inner.unsupported[u]);
				}
				pushCells([math.superscriptPrefix.slice()]);
				if (needsAuxParens(sup)) {
					pushCells([math.auxOpen.slice()]);
					pushCells(wordCells(inner.tokens));
					pushCells([math.auxClose.slice()]);
				} else {
					pushCells(wordCells(inner.tokens));
				}
				openWord().text += text.slice(supStart, i + 1);
				// Tras un exponente numerico, una letra a-j se leeria como
				// cifra: lleva prefijo de minuscula (CMU 1.1, punto C).
				inNumber = false;
				guardLetters = isDigitChar(sup[sup.length - 1]);
				continue;
			}

			// Modo matematicas: multiplicar con punto, 6-0d (CMU 5.1)
			if (math && math.multiplyDotChars && math.multiplyDotChars.indexOf(c) >= 0) {
				pushCells([math.multiplyDot.slice()]);
				pendingHalf = true;
				openWord().text += c;
				inNumber = false;
				guardLetters = false;
				continue;
			}

			// Cifras: el signo de numero se pone una sola vez por grupo
			var digit = hooks.digitOf ? hooks.digitOf(c) : c;
			if (isDigitChar(String(digit))) {
				if (!inNumber && numberPrefix) {
					pushCells([numberPrefix.slice()]);
					inNumber = true;
				}
				if (math) {
					guardLetters = true;
				}
				var dcells = toCellList(table[c]);
				if (dcells == null) {
					dcells = toCellList(table[String(digit)]);
				}
				if (dcells == null) {
					markUnsupported(c);
					continue;
				}
				pushCells(dcells);
				openWord().text += c;
				continue;
			}

			// Dentro de un numero, el punto y la coma siguen siendo parte
			// del numero si les sigue otra cifra (separador de miles o
			// decimal), asi que no se repite el signo de numero.
			var nxt = text[i + 1];
			var nxtDigit = nxt != null && hooks.digitOf ? hooks.digitOf(nxt) : nxt;
			var nextIsDigit = nxt != null && isDigitChar(String(nxtDigit));

			// Modo matematicas: el apostrofo entre cifras separa la parte
			// decimal y se escribe con el punto 2 (CMU 2.3: 3'2 -> #c,b).
			if (math && inNumber && nextIsDigit && (c === "'" || c === '’')) {
				pushCells([math.decimalSeparator.slice()]);
				openWord().text += c;
				continue;
			}

			if (inNumber && (c === '.' || c === ',')) {
				if (!nextIsDigit) {
					inNumber = false;
					guardLetters = false;
				}
			} else if (!(math && (inNumber || guardLetters) && isLetter(c))) {
				// En matematicas las letras no cierran la expresion numerica:
				// las cifras siguientes no repiten el signo de numero
				// (CMU 1.1, ejemplo 234a5 -> #bcd@ae).
				inNumber = false;
				guardLetters = false;
			}

			// Prefijo propio del idioma (caracteres especiales)
			if (hooks.specialPrefixOf) {
				var sp = hooks.specialPrefixOf(c);
				if (sp && sp.length > 0) {
					pushCells([sp.slice()]);
				}
			}

			// Signos de mayuscula agrupados (analisis previo, literatura)
			if (caps && caps.before[i]) {
				pushCells(caps.before[i]);
			}

			// Mayuscula: cualquier caracter cuyo minusculo es distinto.
			// Cubre A-Z y tambien A/E/N con tilde, que la version
			// original no detectaba.
			var lower = c.toLowerCase();
			var cells = lookup(c);

			if (lower !== c && useCaps) {
				// Mayuscula con prefijo: se usa la celda de la minuscula.
				// Si la palabra ya lleva los signos agrupados, va sin prefijo.
				var lowerCells = lookup(lower);
				if (lowerCells != null) {
					cells = (caps && caps.suppress[i])
						? lowerCells
						: [capitalPrefix.slice()].concat(lowerCells);
				}
			} else if (cells == null && lower !== c) {
				cells = lookup(lower);
			}

			if (cells == null) {
				markUnsupported(c);
				continue;
			}

			// Modo matematicas: prefijo de latina minuscula, punto 5, ante
			// una letra de la a a la j dentro de una expresion numerica
			// (CMU 1.1 y 2.5: 3b -> #c@b, 1+2i -> #a+#b@i).
			if (math && guardLetters && isLower(c) && 'abcdefghij'.indexOf(c) >= 0) {
				cells = [math.letterPrefix.slice()].concat(cells);
			}

			pushCells(cells);
			openWord().text += c;

			if (caps && caps.after[i]) {
				pushCells(caps.after[i]);
			}
		}

		flushWord();

		return { tokens: tokens, unsupported: unsupported, cellCount: cellCount };
	}

	// ---------------------------------------------------------------
	// Etapa 2: celdas -> posiciones
	// ---------------------------------------------------------------

	/**
	 * Ubica las celdas en una o varias paginas.
	 *
	 * @param {Array} tokens  salida de textToTokens
	 * @param {object} m  metricas en mm:
	 *        paperWidth, paperHeight, marginWidth, marginHeight,
	 *        letterWidth, letterPadding, linePadding, dotRadius,
	 *        rowsStep (3 para 6 puntos, 2 para 8 puntos, como el
	 *        proyecto original), wordWrap (bool)
	 * @returns {{pages: Array<Array<{dots, x, y}>>, cellsPlaced: number,
	 *           cellsPerLine: number, linesPerPage: number}}
	 */
	function layout(tokens, m) {
		var adv = m.letterWidth + m.letterPadding;
		var lineStep = (m.rowsStep != null ? m.rowsStep : 3) * m.letterWidth + m.linePadding;
		var right = m.paperWidth - m.marginWidth;
		var bottom = m.paperHeight - m.marginHeight;
		var wordWrap = m.wordWrap !== false;

		function fits(x) {
			return (x + m.letterWidth + m.dotRadius) <= right;
		}

		// cuantas celdas caben en una linea y cuantas lineas en la hoja
		var cellsPerLine = 0;
		while (fits(m.marginWidth + cellsPerLine * adv) && cellsPerLine < 10000) {
			cellsPerLine++;
		}
		var linesPerPage = 0;
		while ((m.marginHeight + linesPerPage * lineStep) <= bottom && linesPerPage < 10000) {
			linesPerPage++;
		}
		if (cellsPerLine < 1 || linesPerPage < 1) {
			return { pages: [[]], cellsPlaced: 0, cellsPerLine: cellsPerLine, linesPerPage: linesPerPage };
		}

		// Las paginas se crean al ubicar la primera celda, para no dejar
		// una pagina vacia al final cuando el texto llena justo la hoja.
		var pages = [];
		var page = 0;
		var x = m.marginWidth;
		var y = m.marginHeight;
		// Espacios vistos desde la ultima palabra. Se cuentan (no se funden
		// en uno) para respetar dobles espacios y sangrias, como el
		// original, que dejaba una celda en blanco por cada espacio.
		var pendingSpaces = 0;
		var placedCount = 0;

		function newLine() {
			y += lineStep;
			x = m.marginWidth;
			pendingSpaces = 0;              // el espacio que sobraba al final se descarta
			if (y > bottom) {               // la hoja se lleno: pagina nueva
				page++;
				y = m.marginHeight;
			}
		}

		function place(dots) {
			if (!pages[page]) {
				pages[page] = [];
			}
			pages[page].push({ dots: dots, x: x, y: y });
			placedCount++;
			x += adv;
		}

		for (var i = 0; i < tokens.length; i++) {
			var tk = tokens[i];

			if (tk.t === 'n') {
				newLine();
				continue;
			}

			if (tk.t === 's') {
				pendingSpaces++;
				continue;
			}

			var cells = tk.cells;
			var n = cells.length;
			if (n === 0) {
				continue;
			}

			// --- Aqui esta el cambio de fondo ---
			// Se mide la palabra completa (prefijos incluidos) antes de
			// ubicarla. Si su ultima celda no cabe en lo que queda de linea,
			// baja entera. Solo se corta cuando es mas larga que una linea.
			if (wordWrap && n <= cellsPerLine) {
				var start = x + pendingSpaces * adv;
				if (!fits(start + (n - 1) * adv)) {
					newLine();
				}
			}

			// Espacios antes de la palabra: avanzan sin dejar celda. Si uno
			// ya no cabe, se salta de linea y los que quedan se descartan.
			while (pendingSpaces > 0) {
				if (!fits(x)) {
					newLine();
					break;
				}
				x += adv;
				pendingSpaces--;
			}
			pendingSpaces = 0;

			for (var k = 0; k < n; k++) {
				if (!fits(x)) {
					newLine();
				}
				place(cells[k]);
			}
		}

		// Paginas intermedias sin celdas (muchos saltos seguidos) existen
		// igual: se rellenan para que el indice coincida con la hoja.
		for (var p = 0; p < pages.length; p++) {
			if (!pages[p]) {
				pages[p] = [];
			}
		}
		if (pages.length === 0) {
			pages.push([]);
		}

		return {
			pages: pages,
			cellsPlaced: placedCount,
			cellsPerLine: cellsPerLine,
			linesPerPage: linesPerPage
		};
	}

	var api = {
		textToTokens: textToTokens,
		layout: layout,
		toCellList: toCellList,
		analyzeCaps: analyzeCaps
	};

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = api;
	}
	root.BrailleGLLayout = api;

})(typeof window !== 'undefined' ? window : globalThis);
