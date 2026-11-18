// =====================================================================
// script-braillegl.js
//
// Version de script.js con tres cambios de fondo:
//   1. La maquetacion pasa por braillegl-layout.js, que mide la palabra
//      completa antes de ubicarla: ya no se corta una palabra al final
//      de la linea.
//   2. El texto se pagina: si no cabe en la hoja se generan varias
//      paginas navegables en vez de truncarse en silencio.
//   3. La interfaz esta traducida (braillegl-i18n.js) y el idioma de la
//      interfaz es independiente de la tabla braille.
//
// El original (script.js + index.html) queda intacto.
// =====================================================================

paper.install(window);

let svg = null;
let svgButton = null;
let divJ = null;

$(document).ready(function () {

	const T = BrailleGLI18N;
	const canvas = document.getElementById('paperCanvas');

	paper.setup(canvas);

	// Parametros globales. Se mantienen los nombres del proyecto original
	// para no romper configuraciones ya conocidas.
	let braille = {
		marginWidth: 3,
		marginHeight: 5,
		paperWidth: 175,
		paperHeight: 290,
		letterWidth: 2.3,
		dotRadius: 1.25,
		letterPadding: 3.75,
		linePadding: 3,
		headDownPosition: -2.0,
		headUpPosition: 10,
		speed: 4000,
		delta: false,
		goToZero: false,
		invertX: true,
		invertY: true,
		mirrorX: true,
		mirrorY: true,
		svgStep: 2,
		svgDots: true,
		svgPosX: 0,
		svgPosY: 0,
		language: 'Espanol (6 puntos)',
		GCODEup: 'M3 S0',
		GCODEdown: 'M3 S1',
		usedotgrid: false,
		// nuevos
		oneDirection: true,
		yFirst: true,
		wordWrap: true,
		page: 0
	};

	let text = '';
	let gcode = '';
	let sortedgcode = '';
	let lastLayout = null;
	let lastTokens = null;

	let xhead = 0;
	let yhead = 0;

	let dotMap = null;

	function DotPosition(xpos, ypos) {
		this.x = xpos;
		this.y = ypos;
	}

	let GCODEdotposition = [];
	let GCODEsvgdotposition = [];

	// -----------------------------------------------------------------
	// Generadores de G-code (identicos al original)
	// -----------------------------------------------------------------

	let gcodeSetAbsolutePositioning = function () { return 'G90;\r\n'; };
	let gcodeMotorOff = function () { return 'M84;\r\n'; };
	let gcodeHome = function () { return 'G28 X;\r\n' + 'G28 Y;\r\n'; };
	let gcodeSetSpeed = function (speed) { return 'G1 F' + speed + ';\r\n'; };

	let gcodePosition = function (X, Y, Z) {
		let code = '';
		if (X == null && Y == null && Z == null) {
			throw new Error('Null position when moving');
		}
		if (X != null) { code += ' X' + X.toFixed(2); }
		if (Y != null) { code += ' Y' + Y.toFixed(2); }
		if (Z != null) { code += ' Z' + Z.toFixed(2); }
		code += ';\r\n';
		return code;
	};

	let gcodeMoveTo = function (X, Y, Z) { return 'G1' + gcodePosition(X, Y, Z); };

	let gcodeMoveToCached = function (X, Y, Z) {
		if (X != null) { xhead = X; }
		if (Y != null) { yhead = Y; }
		return gcodeMoveTo(X, Y, Z);
	};

	let gcodeprintdot = function () {
		return braille.GCODEdown + ';\r\n' + braille.GCODEup + ';\r\n';
	};

	let gcodePrintDotCached = function () {
		if (xhead != null && yhead != null) {
			GCODEdotposition.push(new DotPosition(xhead, yhead));
		}
		return gcodeprintdot();
	};

	let gcodeGraphDotCached = function () {
		if (xhead != null && yhead != null) {
			GCODEsvgdotposition.push(new DotPosition(xhead, yhead));
		}
		return gcodeprintdot();
	};

	// Grabado unidireccional (braille.oneDirection): filas de arriba hacia
	// abajo (Y creciente) y, dentro de cada fila, siempre de X mayor a X
	// menor. El cabezal vuelve en vacio al inicio de cada fila, pero todos
	// los puntos se marcan desde el mismo lado (evita el juego mecanico).
	let sortOneDirection = function (a, b) {
		if (a.y == b.y) { return b.x - a.x; }
		return a.y - b.y;
	};

	let sortAscending = function (a, b) {
		if (a.y == b.y) { return a.x - b.x; }
		return a.y - b.y;
	};

	// Orden en zigzag por linea (comportamiento original): la primera fila
	// va de X menor a X mayor y cada fila siguiente invierte el sentido.
	let sortZigzag = function (positions) {
		let sorted = positions.slice().sort(sortAscending);
		let result = [];
		let row = [];
		let reverse = false;
		for (let i = 0; i <= sorted.length; i++) {
			if (i == sorted.length || (row.length > 0 && sorted[i].y != row[0].y)) {
				if (reverse) { row.reverse(); }
				result = result.concat(row);
				row = [];
				reverse = !reverse;
			}
			if (i < sorted.length) { row.push(sorted[i]); }
		}
		return result;
	};

	let buildoptimizedgcode = function () {
		let i;
		let gridsizex = Math.max(1, Math.floor(braille.paperWidth / braille.svgStep));
		let gridsizey = Math.max(1, Math.floor(braille.paperHeight / braille.svgStep));

		let dotgrid = Array(gridsizex);
		for (i = 0; i < gridsizex; i++) {
			dotgrid[i] = new Array(gridsizey);
			dotgrid[i].fill(0);
		}

		let codestr = gcodeHome();
		codestr += gcodeSetSpeed(braille.speed);
		if (braille.goToZero) { codestr += gcodeMoveTo(0, 0, 0); }

		// Cambio de renglon (braille.yFirst): cuando la Y cambia, mover
		// primero solo en Y y luego solo en X, para que el carro no pase en
		// diagonal por encima de los puntos ya hechos.
		//   G1 Y12.30;
		//   G1 X157.50;
		let lastY = null;
		let moveToDot = function (x, y) {
			let code;
			if (braille.yFirst && y !== lastY) {
				code = gcodeMoveTo(null, y) + gcodeMoveTo(x, null);
			} else {
				code = gcodeMoveTo(x, y);
			}
			lastY = y;
			return code;
		};

		let sortedpositions = braille.oneDirection
			? GCODEdotposition.slice().sort(sortOneDirection)
			: sortZigzag(GCODEdotposition);

		for (i = 0; i < sortedpositions.length; i++) {
			codestr += moveToDot(sortedpositions[i].x, sortedpositions[i].y);
			codestr += gcodeprintdot();
			// La grilla solo sirve para filtrar el SVG. El original fallaba
			// aqui con coordenadas negativas (invertX sin mirrorX).
			let cx = Math.floor(sortedpositions[i].x / braille.svgStep);
			let cy = Math.floor(sortedpositions[i].y / braille.svgStep);
			if (cx >= 0 && cx < gridsizex && cy >= 0 && cy < gridsizey) {
				dotgrid[cx][cy] = 1;
			}
		}

		for (i = 0; i < GCODEsvgdotposition.length; i++) {
			let gx = Math.floor(GCODEsvgdotposition[i].x / braille.svgStep);
			let gy = Math.floor(GCODEsvgdotposition[i].y / braille.svgStep);
			if (gx < 0 || gx >= gridsizex) { continue; }
			if (gy < 0 || gy >= gridsizey) { continue; }

			if (braille.usedotgrid === true) {
				if (dotgrid[gx][gy] === 0) {
					codestr += moveToDot(GCODEsvgdotposition[i].x, GCODEsvgdotposition[i].y);
					codestr += gcodeprintdot();
					dotgrid[gx][gy] = 1;
				}
			} else {
				codestr += moveToDot(GCODEsvgdotposition[i].x, GCODEsvgdotposition[i].y);
				codestr += gcodeprintdot();
			}
		}

		codestr += gcodeMoveTo(0, braille.paperHeight);
		codestr += gcodeMotorOff();
		return codestr;
	};

	// -----------------------------------------------------------------
	// SVG
	// -----------------------------------------------------------------

	// Igual que el original: con svgDots desactivado el cabezal solo sube
	// al final del trazo.
	let dotAt = function (point, gcodeObj, lastDot) {
		let px = braille.invertX ? -point.x : braille.paperWidth - point.x;
		let py = braille.invertY ? -point.y : braille.paperHeight - point.y;
		gcodeObj.code += gcodeMoveToCached(braille.mirrorX ? -px : px, braille.mirrorY ? -py : py);
		gcodeGraphDotCached();
		gcodeObj.code += gcodeMoveTo(null, null, braille.headDownPosition);
		if (braille.svgDots || lastDot) {
			gcodeObj.code += gcodeMoveTo(null, null, braille.headUpPosition);
		}
	};

	let itemMustBeDrawn = function (item) {
		return (item.strokeWidth > 0 && item.strokeColor != null) || item.fillColor != null;
	};

	let plotItem = function (item, gcodeObj) {
		if (!item.visible) { return; }

		if (item.className == 'Shape') {
			let shape = item;
			if (itemMustBeDrawn(shape)) {
				let path = shape.toPath(true);
				item.parent.addChildren(item.children);
				item.remove();
				item = path;
			}
		}
		if ((item.className == 'Path' || item.className == 'CompoundPath') && item.strokeWidth > 0) {
			let path = item;
			if (path.segments != null) {
				for (let i = 0; i < path.length; i += braille.svgStep) {
					dotAt(path.getPointAt(i), gcodeObj, i + braille.svgStep >= path.length);
				}
			}
		}
		if (item.children == null) { return; }
		for (let child of item.children) {
			plotItem(child, gcodeObj);
		}
	};

	let svgToGCode = function (svgItem, gcodeObj) {
		plotItem(svgItem, gcodeObj);
		if (GCODEsvgdotposition != null && GCODEsvgdotposition.length > 0) {
			GCODEsvgdotposition.sort(braille.oneDirection ? sortOneDirection : sortAscending);
		}
	};

	// -----------------------------------------------------------------
	// Idioma braille
	// -----------------------------------------------------------------

	function currentLanguage() {
		return languages[braille.language] || languages['6 dots'];
	}

	function is8dot() {
		return braille.language.indexOf('8 dots') >= 0;
	}

	function initLanguage() {
		let lang = currentLanguage();
		dotMap = lang.dotMap;
		if (dotMap == null) {
			throw new Error('La tabla ' + braille.language + ' no define dotMap.');
		}
	}

	// -----------------------------------------------------------------
	// Dibujo y G-code de una celda ya ubicada
	// -----------------------------------------------------------------

	// Mismo calculo de coordenadas y mismo G-code que el bucle del
	// original; solo cambia de donde salen la celda y su posicion.
	function emitCell(cell, rows, textGroup) {
		let gx = braille.invertX ? -cell.x : braille.paperWidth - cell.x;
		let gy = -cell.y;                      // el papel baja, la impresora sube

		if (braille.delta) {                   // origen al centro de la hoja
			gx -= braille.paperWidth / 2;
			gy += braille.paperHeight / 2;
		} else if (!braille.invertY) {
			gy += braille.paperHeight;
		}

		gcode += gcodeMoveToCached(braille.mirrorX ? -gx : gx, braille.mirrorY ? -gy : gy);

		let charGroup = new Group();
		textGroup.addChild(charGroup);

		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < 2; x++) {
				if (cell.dots.indexOf(dotMap[x][y]) === -1) {
					continue;
				}

				let px = cell.x + x * braille.letterWidth;
				let py = cell.y + y * braille.letterWidth;

				let dot = new Path.Circle(new Point(px, py), braille.dotRadius / 2);
				dot.fillColor = 'black';
				charGroup.addChild(dot);

				if (x > 0 || y > 0) {
					let dx = braille.invertX ? -px : braille.paperWidth - px;
					let dy = -py;
					if (braille.delta) {
						dx -= braille.paperWidth / 2;
						dy += braille.paperHeight / 2;
					} else if (!braille.invertY) {
						dy += braille.paperHeight;
					}
					gcode += gcodeMoveToCached(braille.mirrorX ? -dx : dx, braille.mirrorY ? -dy : dy);
				}

				gcode += gcodePrintDotCached();
			}
		}
	}

	// -----------------------------------------------------------------
	// Generacion completa
	// -----------------------------------------------------------------

	function brailleToGCode() {

		let eightDot = is8dot();
		let rows = eightDot ? 4 : 3;

		// --- 1. texto a celdas ---
		let lang = currentLanguage();
		lastTokens = BrailleGLLayout.textToTokens(text, lang, {
			digitOf: typeof compairCharAgaistDevnagriNumber === 'function'
				? compairCharAgaistDevnagriNumber : null,
			specialPrefixOf: typeof getPrefixforSpecialcharacter === 'function'
				? getPrefixforSpecialcharacter : null,
			useCapitalPrefix: !eightDot
		});

		// --- 2. celdas a posiciones, respetando las palabras ---
		lastLayout = BrailleGLLayout.layout(lastTokens.tokens, {
			paperWidth: braille.paperWidth,
			paperHeight: braille.paperHeight,
			marginWidth: braille.marginWidth,
			marginHeight: braille.marginHeight,
			letterWidth: braille.letterWidth,
			letterPadding: braille.letterPadding,
			linePadding: braille.linePadding,
			dotRadius: braille.dotRadius,
			rowsStep: eightDot ? 2 : 3,
			wordWrap: braille.wordWrap
		});

		if (braille.page >= lastLayout.pages.length) {
			braille.page = lastLayout.pages.length - 1;
		}
		if (braille.page < 0) {
			braille.page = 0;
		}

		// --- 3. lienzo ---
		let canvasWidth = canvas.width / window.devicePixelRatio;
		let canvasHeight = canvas.height / window.devicePixelRatio;
		let pixelMillimeterRatio = Math.min(canvasWidth / braille.paperWidth,
			canvasHeight / braille.paperHeight);

		project.clear();

		GCODEdotposition = [];
		GCODEsvgdotposition = [];

		gcode = gcodeSetAbsolutePositioning();
		gcode += gcodeSetSpeed(braille.speed);
		if (braille.goToZero) { gcode += gcodeMoveTo(0, 0, 0); }
		gcode += gcodeMoveTo(0, 0, braille.headUpPosition);

		paper.project.activeLayer.applyMatrix = false;
		paper.project.activeLayer.scaling = pixelMillimeterRatio;

		let bounds = new Path.Rectangle(0, 0,
			Math.max(braille.paperWidth, 0), Math.max(braille.paperHeight, 0));
		bounds.strokeWidth = 1;
		bounds.strokeColor = '#9bb3cc';

		// marco del area util, para que se vea donde cae el margen
		let usable = new Path.Rectangle(
			braille.marginWidth, braille.marginHeight,
			Math.max(0, braille.paperWidth - 2 * braille.marginWidth),
			Math.max(0, braille.paperHeight - 2 * braille.marginHeight));
		usable.strokeWidth = 0.4;
		usable.strokeColor = '#dfe6ee';

		// --- 4. dibujar la pagina actual ---
		let textGroup = new Group();
		let pageCells = lastLayout.pages[braille.page] || [];
		for (let i = 0; i < pageCells.length; i++) {
			emitCell(pageCells[i], rows, textGroup);
		}

		if (svg != null) {
			let gcodeObject = { code: gcode };
			svgToGCode(svg, gcodeObject);
			svg.scaling = 1;
			gcode = gcodeObject.code;
		}

		gcode += gcodeMoveTo(0, 0, braille.headUpPosition);
		if (braille.goToZero) { gcode += gcodeMoveTo(0, 0, 0); }

		$('#gcode').val(gcode);

		if (svg != null) {
			paper.project.activeLayer.addChild(svg);
		}

		let printBounds = textGroup.children.length > 0 ? textGroup.bounds : null;
		if (svg != null) {
			printBounds = printBounds != null ? printBounds.unite(svg.bounds) : svg.bounds;
		}

		let pstr = GCODEdotposition.length + '\r\n';
		for (let d = 0; d < GCODEdotposition.length; d++) {
			pstr += '(' + d + ')' + GCODEdotposition[d].x + ' ' + GCODEdotposition[d].y + '\r\n';
		}

		sortedgcode = buildoptimizedgcode();
		$('#dotposition').val(pstr);
		$('#optimizedgcode').val(sortedgcode);

		updateStatus(printBounds);
		updatePager();
	}

	// -----------------------------------------------------------------
	// Avisos al usuario
	// -----------------------------------------------------------------

	function updateStatus(printBounds) {
		// printBounds viene en milimetros: la escala px/mm se aplica a la
		// capa, no a las coordenadas de los items.
		let size = '--';
		if (printBounds != null) {
			size = printBounds.width.toFixed(0) + ' x ' + printBounds.height.toFixed(0) + ' mm';
		}

		let html = '<dl>';
		html += '<dt>' + T.t('printSize') + '</dt><dd>' + size + '</dd>';
		html += '<dt>' + T.t('cellsPerLine') + '</dt><dd>' + lastLayout.cellsPerLine + '</dd>';
		html += '<dt>' + T.t('linesPerPage') + '</dt><dd>' + lastLayout.linesPerPage + '</dd>';
		html += '<dt>' + T.t('pagesInfo') + '</dt><dd>' + lastLayout.pages.length + '</dd>';
		html += '</dl>';

		let warn = false;
		if (lastTokens.unsupported.length > 0) {
			warn = true;
			html += '<p class="unsupported">' + T.t('unsupported') + ' ';
			html += lastTokens.unsupported.map(function (c) {
				return '<code>' + (c === ' ' ? '␣' : $('<div>').text(c).html()) + '</code>';
			}).join(' ');
			html += '</p>';
		}

		$('#status').html(html).toggleClass('warn', warn);
	}

	function updatePager() {
		let total = lastLayout.pages.length;
		$('#page-count').text(T.t('page') + ' ' + (braille.page + 1) + ' ' + T.t('pageOf') + ' ' + total);
		$('#page-prev').prop('disabled', braille.page <= 0).attr('aria-label', T.t('prev'));
		$('#page-next').prop('disabled', braille.page >= total - 1).attr('aria-label', T.t('next'));
	}

	// -----------------------------------------------------------------
	// Panel dat.GUI (se reconstruye al cambiar el idioma de interfaz)
	// -----------------------------------------------------------------

	let gui = null;

	function buildGUI() {
		let container = document.getElementById('gui');

		// El input de archivo vive dentro del boton SVG: se desprende antes
		// de vaciar el panel, porque .empty() le borraria el manejador.
		if (divJ != null) {
			divJ.detach();
		}
		if (gui != null) {
			try { gui.destroy(); } catch (e) { /* dat.GUI antiguo */ }
		}
		$(container).empty();

		gui = new dat.GUI({ autoPlace: false });
		container.appendChild(gui.domElement);
		$(gui.domElement).find('.close-button').remove();
		dat.GUI.toggleHide = function () {};

		function add(name, min, max, folder, labelKey, callback) {
			let f = folder != null ? folder : gui;
			let controller = f.add(braille, name, min, max);
			controller.onChange(callback != null ? callback : brailleToGCode);
			controller.onFinishChange(callback != null ? callback : brailleToGCode);
			controller.name(T.t(labelKey));
			return controller;
		}

		let paperFolder = gui.addFolder(T.t('folderPaper'));
		add('paperWidth', 1, 1000, paperFolder, 'paperWidth', onPaperSizeChanged);
		add('paperHeight', 1, 1000, paperFolder, 'paperHeight', onPaperSizeChanged);
		add('marginWidth', 0, 100, paperFolder, 'marginWidth');
		add('marginHeight', 0, 100, paperFolder, 'marginHeight');

		let charFolder = gui.addFolder(T.t('folderChar'));
		add('letterWidth', 1, 100, charFolder, 'letterWidth');
		add('dotRadius', 1, 30, charFolder, 'dotRadius');
		add('letterPadding', 1, 30, charFolder, 'letterPadding');
		add('linePadding', 1, 30, charFolder, 'linePadding');

		let printerFolder = gui.addFolder(T.t('folderPrinter'));
		add('headDownPosition', -150, 150, printerFolder, 'headDown');
		add('headUpPosition', -150, 150, printerFolder, 'headUp');
		add('speed', 0, 6000, printerFolder, 'speed');
		add('delta', null, null, printerFolder, 'delta');
		add('invertX', null, null, printerFolder, 'negX');
		add('invertY', null, null, printerFolder, 'negY');
		add('mirrorX', null, null, printerFolder, 'mirrorX');
		add('mirrorY', null, null, printerFolder, 'mirrorY');
		add('goToZero', null, null, printerFolder, 'goToZero');
		add('oneDirection', null, null, printerFolder, 'oneDirection');
		add('yFirst', null, null, printerFolder, 'yFirst');
		add('GCODEup', null, null, printerFolder, 'gcodeUp');
		add('GCODEdown', null, null, printerFolder, 'gcodeDown');

		let svgFolder = gui.addFolder(T.t('folderSVG'));
		svgButton = svgFolder.add({
			importSVG: function () {
				if (svg != null) {
					svgButton.name(T.t('svgImport'));
					svg.remove();
					svg = null;
					GCODEsvgdotposition = [];
					brailleToGCode();
				} else {
					divJ.click();
				}
			}
		}, 'importSVG');
		svgButton.name(svg != null ? T.t('svgClear') : T.t('svgImport'));
		$(svgButton.domElement).append(divJ);

		add('svgStep', 0, 100, svgFolder, 'svgStep');
		add('svgDots', null, null, svgFolder, 'svgDots');
		add('usedotgrid', null, null, svgFolder, 'dotFilter');
		add('svgPosX', -500, 500, svgFolder, 'svgPosX', function (value) {
			if (svg != null) { svg.position.x = value; brailleToGCode(); }
		});
		add('svgPosY', -500, 500, svgFolder, 'svgPosY', function (value) {
			if (svg != null) { svg.position.y = value; brailleToGCode(); }
		});

		paperFolder.open();
	}

	// -----------------------------------------------------------------
	// Controles de la cabecera y de la tarjeta de texto
	// -----------------------------------------------------------------

	function resizeCanvasToPaper() {
		canvas.style.aspectRatio = braille.paperWidth + ' / ' + braille.paperHeight;
		if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
			paper.view.viewSize = new paper.Size(canvas.clientWidth, canvas.clientHeight);
		}
	}

	function onPaperSizeChanged() {
		syncPaperPreset();
		resizeCanvasToPaper();
		brailleToGCode();
	}

	function fillBrailleTableSelect() {
		let $sel = $('#braille-table').empty();
		Object.keys(languages).forEach(function (key) {
			$('<option>').val(key).text(T.tableName(key)).appendTo($sel);
		});
		$sel.val(braille.language);
	}

	function fillPaperPresetSelect() {
		let $sel = $('#paper-preset').empty();
		T.paperPresets.forEach(function (p) {
			$('<option>').val(p.id).text(p.label).appendTo($sel);
		});
		$('<option>').val('custom').text(T.t('paperCustom')).appendTo($sel);
		syncPaperPreset();
	}

	// Si el ancho o el alto se cambian a mano en el panel, el selector
	// pasa a "personalizado".
	function syncPaperPreset() {
		let match = T.paperPresets.filter(function (p) {
			return p.w === braille.paperWidth && p.h === braille.paperHeight;
		})[0];
		$('#paper-preset').val(match ? match.id : 'custom');
	}

	function applyTranslations() {
		document.documentElement.lang = T.get();
		document.title = 'BrailleGL';

		let map = {
			'#t-tagline': 'tagline',
			'#t-uiLang': 'uiLang',
			'#t-docs': 'docs',
			'#t-repo': 'repo',
			'#t-textLabel': 'textLabel',
			'#t-brailleTable': 'brailleTable',
			'#t-brailleTableHelp': 'brailleTableHelp',
			'#t-wordWrap': 'wordWrap',
			'#t-wordWrapHelp': 'wordWrapHelp',
			'#t-paperPreset': 'paperPreset',
			'#t-downloadHint': 'downloadHint',
			'#t-advanced': 'advanced',
			'#t-optimizedGcode': 'optimizedGcode',
			'#t-dotPositions': 'dotPositions',
			'#t-gcodeRaw': 'gcodeRaw',
			'#h-text': 'textSection',
			'#h-preview': 'preview'
		};
		Object.keys(map).forEach(function (sel) {
			$(sel).text(T.t(map[sel]));
		});

		$('#latin').attr('placeholder', T.t('textPlaceholder'));
		$('#download-gcode').text(T.t('download'));

		fillBrailleTableSelect();
		fillPaperPresetSelect();
		buildGUI();
	}

	// idioma de la interfaz
	let $uiLang = $('#ui-lang');
	T.list().forEach(function (l) {
		$('<option>').val(l.code).text(l.name).appendTo($uiLang);
	});
	$uiLang.val(T.get()).on('change', function () {
		T.set($(this).val());
		applyTranslations();
		brailleToGCode();
	});

	// tabla braille
	$('#braille-table').on('change', function () {
		braille.language = $(this).val();
		braille.page = 0;
		initLanguage();
		brailleToGCode();
	});

	// no cortar palabras
	$('#word-wrap').prop('checked', braille.wordWrap).on('change', function () {
		braille.wordWrap = this.checked;
		braille.page = 0;
		brailleToGCode();
	});

	// tamano de papel
	$('#paper-preset').on('change', function () {
		let p = T.paperPresets.filter(function (x) { return x.id === $('#paper-preset').val(); })[0];
		if (!p) { return; }
		braille.paperWidth = p.w;
		braille.paperHeight = p.h;
		braille.page = 0;
		buildGUI();              // refresca los valores mostrados
		onPaperSizeChanged();
	});

	// paginas
	$('#page-prev').on('click', function () {
		if (braille.page > 0) { braille.page--; brailleToGCode(); }
	});
	$('#page-next').on('click', function () {
		if (braille.page < lastLayout.pages.length - 1) { braille.page++; brailleToGCode(); }
	});

	// descarga
	$('#download-gcode').on('click', function () {
		let a = document.body.appendChild(document.createElement('a'));
		let suffix = lastLayout.pages.length > 1 ? '-p' + (braille.page + 1) : '';
		a.download = 'braille' + suffix + '.gcode';
		a.href = encodeURI('data:text/plain;charset=utf-8,' + sortedgcode);
		a.click();
		a.remove();
	});

	// texto
	$('#latin').on('input propertychange', function () {
		text = $('#latin').val();
		brailleToGCode();
	});

	// -----------------------------------------------------------------
	// Importar SVG
	// -----------------------------------------------------------------

	divJ = $("<input data-name='file-selector' type='file' class='form-control' name='file[]' accept='image/svg+xml'/>");

	let importSVG = function (event) {
		GCODEsvgdotposition = [];
		svgButton.name(T.t('svgClear'));
		svg = paper.project.importSVG(event.target.result);
		svg.strokeScaling = false;
		svg.pivot = svg.bounds.topLeft;
		svg.scaling = 1;
		brailleToGCode();
		svg.sendToBack();
	};

	let handleFileSelect = function (event) {
		let files = event.dataTransfer != null ? event.dataTransfer.files : event.target.files;
		for (let i = 0; i < files.length; i++) {
			let file = files.item(i);
			if (!/^image\//.test(file.type)) { continue; }
			let reader = new FileReader();
			reader.onload = function (ev) { importSVG(ev); };
			reader.readAsText(file);
		}
	};

	divJ.click(function (event) {
		event.stopPropagation();
		return -1;
	});
	divJ.hide();
	divJ.change(handleFileSelect);

	// -----------------------------------------------------------------
	// Arranque
	// -----------------------------------------------------------------

	initLanguage();
	applyTranslations();
	resizeCanvasToPaper();
	brailleToGCode();

	$(window).on('resize', function () {
		resizeCanvasToPaper();
		brailleToGCode();
	});
});
