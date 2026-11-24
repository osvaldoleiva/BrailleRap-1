// =====================================================================
// Signografia braille espanola (6 puntos) - grado 1, sin contracciones
//
// Fuente: Comision Braille Espanola (ONCE), Documento tecnico B 2
// "Signografia basica de las lenguas cooficiales espanolas".
// https://www.once.es/servicios-sociales/braille/documentos-tecnicos/
//
// Todos los valores marcados [B2] estan tomados de ese documento.
// Los marcados [MAP] son equivalencias practicas de teclado (p. ej. la
// comilla recta " se envia al signo de comillas angulares) y no signos
// nuevos: se pueden quitar sin afectar al resto de la tabla.
//
// Numeracion de puntos de la celda:
//
//    x: 0 1
// y
// 0     1 4
// 1     2 5
// 2     3 6
// =====================================================================

languages['Espanol (6 puntos)'] = {

	// Metadatos usados por el motor de maquetacion
	code: 'es',
	rows: 3,
	grade: 1,

	dotMap: {
		0: { 0: 1, 1: 2, 2: 3 },
		1: { 0: 4, 1: 5, 2: 6 }
	},

	// [B2] signo de numero: puntos 3-4-5-6, se antepone a las cifras
	numberPrefix: [3, 4, 5, 6],

	// [B2] signo de mayuscula: puntos 4-6, se antepone a la letra
	capitalPrefix: [4, 6],

	// Palabras enteras en mayusculas (solo modo literatura):
	//   'palabra'     [B2 7.1] dos signos de mayuscula antes de la primera
	//                 letra: ONCE -> 46-46 o n c e
	//   'tipografico' [B2 7.2] en minusculas entre dos signos de escritura
	//                 especial (puntos 3-5): NORMAS -> 35 n o r m a s 35
	capsMode: 'palabra',
	typographicSign: [3, 5],

	// -----------------------------------------------------------------
	// Modo matematicas. Fuente: Codigo Matematico Unificado para
	// Iberoamerica (CMU), Consejo Iberoamericano del Braille, 2.a edicion,
	// abril de 2024. Se cita el apartado de cada valor.
	// -----------------------------------------------------------------
	math: {
		// [CMU 1.1] prefijo de latina minuscula, ante a-j en expresiones
		// numericas: 3b -> 3456-14 5-12
		letterPrefix: [5],

		// [CMU 2.3] separador decimal, aunque en tinta sea punto o apostrofo
		decimalSeparator: [2],

		// [CMU 4.2.1, 5.2.1] superindice a la derecha (exponente)
		superscriptPrefix: [1, 6],

		// [CMU 3.1] parentesis auxiliares (sin signo en tinta)
		auxOpen: [2, 6],
		auxClose: [3, 5],

		// [CMU 5.1] multiplicar con punto: 6-0d. "0d" = la celda siguiente
		// no puede tener los puntos 1, 2 ni 3; si los tiene, el motor deja
		// un cajetin en blanco. Caracteres de entrada [MAP]: punto medio y
		// operador punto de Unicode.
		multiplyDot: [6],
		multiplyDotChars: ['·', '⋅'],

		// Signos que en matematicas reemplazan o completan la tabla
		signs: {
			"+": [2, 3, 5],                    // [CMU 5.1] sumar
			"-": [3, 6],                       // [CMU 5.1] restar
			"−": [3, 6],                  // [CMU 5.1] restar (signo menos tipografico)
			"=": [2, 3, 5, 6],                 // [CMU 5.1, 6.1] igual a
			"×": [2, 3, 6],               // [CMU 5.1] multiplicar (aspa)
			"/": [2, 5, 6],                    // [CMU 5.1] division con barra inclinada
			":": [[5], [2]],                   // [CMU 5.1] division con dos puntos
			"÷": [[5], [2]],              // [CMU 5.1] division (signo de dividir)
			"<": [2, 4, 6],                    // [CMU 6.1] menor que
			">": [1, 3, 5],                    // [CMU 6.1] mayor que
			"≤": [[2, 4, 6], [2, 3, 5, 6]], // [CMU 6.1] menor o igual que
			"≥": [[1, 3, 5], [2, 3, 5, 6]], // [CMU 6.1] mayor o igual que
			"≠": [[4, 5], [2, 3, 5, 6]],    // [CMU 6.2] distinto de
			"≈": [[5], [2, 3, 5, 6], [3]],  // [CMU 6.1] casi igual a
			"≐": [[4], [2, 3, 5, 6]],       // [CMU 6.1] aproximadamente igual a
			"≔": [[5, 6], [2, 3, 5, 6]],    // [CMU 6.1] igual por definicion
			"≡": [[2, 3, 5, 6], [2, 3, 5, 6]] // [CMU 6.1] identico a
		}
	},

	latinToBraille: {

		// --- Alfabeto [B2] ---
		"a": [1],
		"b": [1, 2],
		"c": [1, 4],
		"d": [1, 4, 5],
		"e": [1, 5],
		"f": [1, 2, 4],
		"g": [1, 2, 4, 5],
		"h": [1, 2, 5],
		"i": [2, 4],
		"j": [2, 4, 5],
		"k": [1, 3],
		"l": [1, 2, 3],
		"m": [1, 3, 4],
		"n": [1, 3, 4, 5],
		"ñ": [1, 2, 4, 5, 6],
		"o": [1, 3, 5],
		"p": [1, 2, 3, 4],
		"q": [1, 2, 3, 4, 5],
		"r": [1, 2, 3, 5],
		"s": [2, 3, 4],
		"t": [2, 3, 4, 5],
		"u": [1, 3, 6],
		"v": [1, 2, 3, 6],
		"w": [2, 4, 5, 6],
		"x": [1, 3, 4, 6],
		"y": [1, 3, 4, 5, 6],
		"z": [1, 3, 5, 6],

		// --- Vocales acentuadas y dieresis [B2] ---
		"á": [1, 2, 3, 5, 6],
		"é": [2, 3, 4, 6],
		"í": [3, 4],
		"ó": [3, 4, 6],
		"ú": [2, 3, 4, 5, 6],
		"ü": [1, 2, 5, 6],

		// --- Cifras [B2]: signo de numero + letras a-j ---
		"1": [1],
		"2": [1, 2],
		"3": [1, 4],
		"4": [1, 4, 5],
		"5": [1, 5],
		"6": [1, 2, 4],
		"7": [1, 2, 4, 5],
		"8": [1, 2, 5],
		"9": [2, 4],
		"0": [2, 4, 5],

		// --- Puntuacion [B2] ---
		// El punto 3 hace de punto final y tambien de separador de miles.
		// El punto 2 hace de coma y tambien de separador decimal.
		".": [3],
		",": [2],
		";": [2, 3],
		":": [2, 5],
		"?": [2, 6],
		"¿": [2, 6],
		"!": [2, 3, 5],
		"¡": [2, 3, 5],
		"«": [2, 3, 6],
		"»": [2, 3, 6],
		"(": [1, 2, 6],
		")": [3, 4, 5],
		"-": [3, 6],
		"*": [3, 5],
		"'": [3],
		" ": [],

		// --- Signos matematicos ---
		// Igual a: puntos 2-3-5-6. CMU 2.a ed. 2024, apartados 5.1 y 6.1.
		"=": [2, 3, 5, 6],

		// --- Signos de dos celdas [B2] ---
		// La barra se escribe punto 6 seguido de punto 2.
		"/": [[6], [2]],

		// --- Equivalencias de teclado [MAP] ---
		'"': [2, 3, 6],   // " -> comillas angulares
		"‘": [3],          // ' tipografica de apertura
		"’": [3],          // ' tipografica de cierre
		"“": [2, 3, 6],   // " tipografica de apertura
		"”": [2, 3, 6],   // " tipografica de cierre
		"–": [3, 6],      // guion medio -> guion
		"—": [3, 6],      // guion largo -> guion
		"…": [[3], [3], [3]] // puntos suspensivos -> tres puntos 3
	}
};
