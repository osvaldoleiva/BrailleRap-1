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

	/**
	 * Convierte el texto en una lista de tokens.
	 *
	 * @param {string} text
	 * @param {object} lang  entrada de `languages[...]`
	 * @param {object} [hooks] {digitOf, specialPrefixOf} para idiomas con
	 *        cifras o prefijos propios (devanagari del proyecto original)
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

		var tokens = [];
		var unsupported = [];
		var seenUnsupported = {};
		var cellCount = 0;

		var word = null;          // token en construccion
		var inNumber = false;

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
				w.cells.push(cells[i]);
				cellCount++;
			}
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
				continue;
			}

			// Espacio en blanco
			if (c === ' ' || c === '\t') {
				flushWord();
				tokens.push({ t: 's' });
				inNumber = false;
				continue;
			}

			// Cifras: el signo de numero se pone una sola vez por grupo
			var digit = hooks.digitOf ? hooks.digitOf(c) : c;
			if (isDigitChar(String(digit))) {
				if (!inNumber && numberPrefix) {
					pushCells([numberPrefix.slice()]);
					inNumber = true;
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
			if (inNumber && (c === '.' || c === ',')) {
				var nxt = text[i + 1];
				var nxtDigit = nxt != null && hooks.digitOf ? hooks.digitOf(nxt) : nxt;
				if (!(nxt != null && isDigitChar(String(nxtDigit)))) {
					inNumber = false;
				}
			} else {
				inNumber = false;
			}

			// Prefijo propio del idioma (caracteres especiales)
			if (hooks.specialPrefixOf) {
				var sp = hooks.specialPrefixOf(c);
				if (sp && sp.length > 0) {
					pushCells([sp.slice()]);
				}
			}

			// Mayuscula: cualquier caracter cuyo minusculo es distinto.
			// Cubre A-Z y tambien A/E/N con tilde, que la version
			// original no detectaba.
			var lower = c.toLowerCase();
			var cells = toCellList(table[c]);

			if (lower !== c && useCaps) {
				// Mayuscula con prefijo: se usa la celda de la minuscula.
				var lowerCells = toCellList(table[lower]);
				if (lowerCells != null) {
					cells = [capitalPrefix.slice()].concat(lowerCells);
				}
			} else if (cells == null && lower !== c) {
				cells = toCellList(table[lower]);
			}

			if (cells == null) {
				markUnsupported(c);
				continue;
			}

			pushCells(cells);
			openWord().text += c;
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

	var api = { textToTokens: textToTokens, layout: layout, toCellList: toCellList };

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = api;
	}
	root.BrailleGLLayout = api;

})(typeof window !== 'undefined' ? window : globalThis);
