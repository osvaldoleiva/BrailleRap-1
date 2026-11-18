// =====================================================================
// braillegl-i18n.js
// Textos de la interfaz. El idioma de la interfaz es independiente de
// la tabla braille que se usa para generar los puntos.
// =====================================================================

var BrailleGLI18N = (function () {
	'use strict';

	var strings = {

		es: {
			name: 'Español',
			tagline: 'Escribe braille en papel con una impresora 3D.',
			docs: 'Documentación',
			repo: 'Repositorio',
			uiLang: 'Idioma de la interfaz',
			textLabel: 'Texto a embozar',
			textPlaceholder: 'Escribe aquí el texto…',
			brailleTable: 'Tabla braille',
			brailleTableHelp: 'Define cómo se traduce cada carácter a puntos.',
			wordWrap: 'No cortar palabras',
			wordWrapHelp: 'Si una palabra no cabe en la línea, baja completa.',
			page: 'Página',
			pageOf: 'de',
			prev: 'Anterior',
			next: 'Siguiente',

			folderText: 'Texto e idioma',
			folderPaper: 'Papel',
			folderChar: 'Celda braille',
			folderPrinter: 'Impresora',
			folderSVG: 'Imagen SVG',

			paperPreset: 'Tamaño de papel',
			paperCustom: 'Personalizado (panel técnico)',
			textSection: 'Texto',
			paperWidth: 'Ancho del papel',
			paperHeight: 'Alto del papel',
			marginWidth: 'Margen lateral',
			marginHeight: 'Margen superior',
			letterWidth: 'Separación de puntos',
			dotRadius: 'Diámetro del punto',
			letterPadding: 'Separación entre celdas',
			linePadding: 'Separación entre líneas',

			headDown: 'Posición Z abajo',
			headUp: 'Posición Z arriba',
			speed: 'Velocidad',
			delta: 'Impresora delta',
			negX: 'X negativo',
			negY: 'Y negativo',
			mirrorX: 'Espejar X',
			mirrorY: 'Espejar Y',
			goToZero: 'Ir a cero',
			oneDirection: 'Grabar en un solo sentido',
			gcodeUp: 'G-code subir',
			gcodeDown: 'G-code bajar',

			svgImport: 'Importar SVG',
			svgClear: 'Quitar SVG',
			svgStep: 'Paso del trazo',
			svgDots: 'Puntos separados',
			dotFilter: 'Filtrar puntos vecinos',
			svgPosX: 'Posición X del SVG',
			svgPosY: 'Posición Y del SVG',

			download: 'Descargar G-code',
			downloadHint: 'Descarga el G-code de la página que estás viendo.',
			printSize: 'Tamaño impreso',
			cellsPerLine: 'Celdas por línea',
			linesPerPage: 'Líneas por página',
			pagesInfo: 'Páginas',
			unsupported: 'Caracteres que esta tabla no puede traducir y se omitieron:',
			ready: 'Listo.',
			advanced: 'Datos técnicos (G-code y posiciones)',
			gcodeRaw: 'G-code sin optimizar',
			optimizedGcode: 'G-code optimizado (el que se descarga)',
			dotPositions: 'Posiciones de los puntos',
			preview: 'Vista previa de la hoja'
		},

		en: {
			name: 'English',
			tagline: 'Emboss braille on paper with a 3D printer.',
			docs: 'Documentation',
			repo: 'Repository',
			uiLang: 'Interface language',
			textLabel: 'Text to emboss',
			textPlaceholder: 'Type your text here…',
			brailleTable: 'Braille table',
			brailleTableHelp: 'Defines how each character maps to dots.',
			wordWrap: 'Keep words whole',
			wordWrapHelp: 'If a word does not fit the line, it moves down whole.',
			page: 'Page',
			pageOf: 'of',
			prev: 'Previous',
			next: 'Next',

			folderText: 'Text and language',
			folderPaper: 'Paper',
			folderChar: 'Braille cell',
			folderPrinter: 'Printer',
			folderSVG: 'SVG image',

			paperPreset: 'Paper size',
			paperCustom: 'Custom (technical panel)',
			textSection: 'Text',
			paperWidth: 'Paper width',
			paperHeight: 'Paper height',
			marginWidth: 'Side margin',
			marginHeight: 'Top margin',
			letterWidth: 'Dot spacing',
			dotRadius: 'Dot diameter',
			letterPadding: 'Cell spacing',
			linePadding: 'Line spacing',

			headDown: 'Z down position',
			headUp: 'Z up position',
			speed: 'Speed',
			delta: 'Delta printer',
			negX: 'Negative X',
			negY: 'Negative Y',
			mirrorX: 'Mirror X',
			mirrorY: 'Mirror Y',
			goToZero: 'Go to zero',
			oneDirection: 'Emboss in one direction',
			gcodeUp: 'G-code up',
			gcodeDown: 'G-code down',

			svgImport: 'Import SVG',
			svgClear: 'Clear SVG',
			svgStep: 'Path step',
			svgDots: 'Separate dots',
			dotFilter: 'Filter neighbour dots',
			svgPosX: 'SVG X position',
			svgPosY: 'SVG Y position',

			download: 'Download G-code',
			downloadHint: 'Downloads the G-code for the page shown.',
			printSize: 'Print size',
			cellsPerLine: 'Cells per line',
			linesPerPage: 'Lines per page',
			pagesInfo: 'Pages',
			unsupported: 'Characters this table cannot translate were skipped:',
			ready: 'Ready.',
			advanced: 'Technical data (G-code and positions)',
			gcodeRaw: 'Raw G-code',
			optimizedGcode: 'Optimised G-code (the one downloaded)',
			dotPositions: 'Dot positions',
			preview: 'Sheet preview'
		},

		fr: {
			name: 'Français',
			tagline: 'Écrire du braille sur papier avec une imprimante 3D.',
			docs: 'Documentation',
			repo: 'Dépôt',
			uiLang: "Langue de l'interface",
			textLabel: 'Texte à embosser',
			textPlaceholder: 'Saisissez votre texte…',
			brailleTable: 'Table braille',
			brailleTableHelp: 'Définit la correspondance caractère / points.',
			wordWrap: 'Ne pas couper les mots',
			wordWrapHelp: "Si un mot ne tient pas sur la ligne, il passe entier à la suivante.",
			page: 'Page',
			pageOf: 'sur',
			prev: 'Précédente',
			next: 'Suivante',

			folderText: 'Texte et langue',
			folderPaper: 'Papier',
			folderChar: 'Cellule braille',
			folderPrinter: 'Imprimante',
			folderSVG: 'Image SVG',

			paperPreset: 'Format du papier',
			paperCustom: 'Personnalisé (panneau technique)',
			textSection: 'Texte',
			paperWidth: 'Largeur du papier',
			paperHeight: 'Hauteur du papier',
			marginWidth: 'Marge latérale',
			marginHeight: 'Marge supérieure',
			letterWidth: 'Écart des points',
			dotRadius: 'Diamètre du point',
			letterPadding: 'Écart des cellules',
			linePadding: 'Écart des lignes',

			headDown: 'Position Z basse',
			headUp: 'Position Z haute',
			speed: 'Vitesse',
			delta: 'Imprimante delta',
			negX: 'X négatif',
			negY: 'Y négatif',
			mirrorX: 'Miroir X',
			mirrorY: 'Miroir Y',
			goToZero: 'Aller à zéro',
			oneDirection: 'Graver dans un seul sens',
			gcodeUp: 'G-code haut',
			gcodeDown: 'G-code bas',

			svgImport: 'Importer un SVG',
			svgClear: 'Retirer le SVG',
			svgStep: 'Pas du tracé',
			svgDots: 'Points séparés',
			dotFilter: 'Filtrer les points voisins',
			svgPosX: 'Position X du SVG',
			svgPosY: 'Position Y du SVG',

			download: 'Télécharger le G-code',
			downloadHint: 'Télécharge le G-code de la page affichée.',
			printSize: 'Taille imprimée',
			cellsPerLine: 'Cellules par ligne',
			linesPerPage: 'Lignes par page',
			pagesInfo: 'Pages',
			unsupported: 'Caractères non traduisibles par cette table, ignorés :',
			ready: 'Prêt.',
			advanced: 'Données techniques (G-code et positions)',
			gcodeRaw: 'G-code brut',
			optimizedGcode: 'G-code optimisé (celui téléchargé)',
			dotPositions: 'Position des points',
			preview: 'Aperçu de la feuille'
		}
	};

	// Nombres mostrados para cada tabla braille disponible
	var tableNames = {
		'Espanol (6 puntos)': { es: 'Español (6 puntos)', en: 'Spanish (6 dots)', fr: 'Espagnol (6 points)' },
		'6 dots': { es: 'Francés (6 puntos)', en: 'French (6 dots)', fr: 'Français (6 points)' },
		'6 dots India': { es: 'Devanagari (6 puntos)', en: 'Devanagari (6 dots)', fr: 'Devanagari (6 points)' },
		'old 8 dots': { es: '8 puntos (antigua)', en: '8 dots (old)', fr: '8 points (ancienne)' },
		'new 8 dots': { es: '8 puntos (nueva)', en: '8 dots (new)', fr: '8 points (nouvelle)' }
	};

	// Tamanos de papel: dimensiones de la hoja en mm. El area util es la
	// hoja menos los margenes del panel tecnico. 175 x 290 es el valor por
	// defecto del BrailleRAP original.
	var paperPresets = [
		{ id: 'braillerap', label: 'BrailleRAP (175 x 290)', w: 175, h: 290 },
		{ id: 'a4', label: 'A4 (210 x 297)', w: 210, h: 297 },
		{ id: 'a3', label: 'A3 (297 x 420)', w: 297, h: 420 },
		{ id: 'carta', label: 'Carta / Letter (216 x 279)', w: 216, h: 279 },
		{ id: 'oficio', label: 'Oficio / Legal (216 x 330)', w: 216, h: 330 }
	];

	var current = 'es';

	return {
		list: function () {
			return Object.keys(strings).map(function (k) {
				return { code: k, name: strings[k].name };
			});
		},
		set: function (code) {
			if (strings[code]) {
				current = code;
			}
			return current;
		},
		get: function () {
			return current;
		},
		t: function (key) {
			var pack = strings[current] || strings.es;
			return pack[key] != null ? pack[key] : (strings.es[key] != null ? strings.es[key] : key);
		},
		tableName: function (key) {
			var n = tableNames[key];
			if (n && n[current]) {
				return n[current];
			}
			return key;
		},
		paperPresets: paperPresets
	};
})();
