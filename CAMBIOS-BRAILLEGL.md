# Cambios de BrailleGL sobre BrailleRap

Base: [crocsg/BrailleRap](https://github.com/crocsg/BrailleRap), rama `master`
(commit `eb4bdcb`), licencia MIT.

Todo lo nuevo está en archivos aparte. `index.html`, `script.js`, `style.css` y
las tablas existentes (`braille6.js`, `braille6india.js`, `braille8old.js`,
`braille8new.js`, `devnagrinumbers.js`) no se modificaron, así que las dos
versiones conviven y se pueden comparar abriendo una u otra página. No hay
dependencias nuevas ni paso de build: se sigue abriendo el HTML directamente.

| Archivo | Qué hace |
|---|---|
| `index-braillegl.html` | Página nueva, punto de entrada de esta versión. |
| `braillegl.css` | Estilos de la interfaz nueva. |
| `braille-es.js` | Tabla braille española (6 puntos, grado 1). |
| `braillegl-layout.js` | Motor de maquetación: texto → celdas → posiciones. |
| `braillegl-i18n.js` | Textos de la interfaz en español, inglés y francés. |
| `script-braillegl.js` | Copia adaptada de `script.js` que usa el motor nuevo. |
| `tests/test-layout.js` | Pruebas del maquetador en node (`npm test`). |
| `tests/e2e-chrome.js` | Prueba opcional de la página en Chrome headless. |
| `package.json` | Solo fija `"type": "commonjs"` y el script de prueba. Sin dependencias. |

## 1. Las palabras ya no se cortan

El original ubica carácter por carácter y salta de línea recién cuando el
siguiente carácter no cabe (`script.js`, líneas 512-519), partiendo la palabra.

`braillegl-layout.js` separa el trabajo en dos funciones puras, usables en el
navegador (`window.BrailleGLLayout`) y en node (`module.exports`):

1. **`textToTokens(text, lang, hooks)`** convierte el texto en palabras, espacios y
   saltos. Cada palabra trae ya sus celdas, con los prefijos resueltos
   (mayúscula, signo de número, prefijos especiales del devanagari mediante los
   hooks `digitOf` y `specialPrefixOf` de `devnagrinumbers.js`) y los signos de
   varias celdas expandidos.
2. **`layout(tokens, metrics)`** mide la palabra completa, prefijos incluidos,
   antes de ubicarla. Si su última celda no cabe en lo que queda de línea, baja
   entera. Solo se corta carácter por carácter si es más larga que una línea.

La geometría es la del original: avance entre celdas `letterWidth +
letterPadding`, avance de línea `rowsStep × letterWidth + linePadding` (3 filas
en 6 puntos, 2 en 8 puntos), y una celda cabe si `x + letterWidth + dotRadius ≤
paperWidth − marginWidth`. Con los valores por defecto caben 28 celdas por línea
y 29 líneas por página.

Otros comportamientos:

- **Paginación en vez de truncado.** El original dejaba de escribir en silencio
  al llenarse la hoja. Ahora el texto sigue en otra página, ninguna celda se
  pierde, y se navega con los botones bajo la vista previa. Un salto de línea
  final que cae justo al llenarse la hoja no crea una página vacía.
- **Espacios.** Cada espacio sigue ocupando una columna, como en el original
  (los dobles espacios y la sangría se conservan). El espacio pendiente al final
  de una línea se descarta al saltar.
- **Saltos de línea.** Se aceptan `\n`, `\r\n` y `\r` suelto.
- La casilla *No cortar palabras* desactiva el corte por palabra. Con ella
  desactivada y la tabla francesa, el G-code optimizado es idéntico byte a byte
  al de la página original (lo comprueba `tests/e2e-chrome.js`).

## 2. Tabla braille española

`braille-es.js` registra `languages['Espanol (6 puntos)']` con el mismo
`dotMap` que `braille6.js`, signo de número `[3,4,5,6]` y signo de mayúscula
`[4,6]`.

Fuente: Comisión Braille Española (ONCE), **Documento técnico B 2,
*Signografía básica de las lenguas cooficiales españolas***.
<https://www.once.es/servicios-sociales/braille/documentos-tecnicos/documentos-tecnicos-relacionados-con-el-braille>

| Grupo | Signos |
|---|---|
| Alfabeto | a–z y ñ (12456) |
| Acentuadas | á 12356 · é 2346 · í 34 · ó 346 · ú 23456 · ü 1256 |
| Cifras | signo de número 3456 + letras a–j (1 = a … 0 = j) |
| Puntuación | `.` 3 · `,` 2 · `;` 23 · `:` 25 · `¿?` 26 · `¡!` 235 · `«»` 236 · `(` 126 · `)` 345 · `-` 36 · `*` 35 · `'` 3 |
| Dos celdas | `/` = 6 y luego 2 |

La puntuación española difiere de la francesa del proyecto: el punto es el
punto 3, no 2-5-6. En el archivo, cada entrada lleva la marca `[B2]` (tomada del
documento) o `[MAP]`. Las `[MAP]` son equivalencias prácticas de teclado y no
signos nuevos: comilla recta `"` y comillas tipográficas `“ ”` → comillas
angulares, `‘ ’` → apóstrofo, guion medio `–` y guion largo `—` → guion, `…`
→ tres puntos 3.

Reglas implementadas en el motor:

- El signo de número sale **una vez por grupo de cifras**. El punto y la coma
  dentro de un número (`1.000`, `3,5`) no lo repiten. Solo siguen siendo parte
  del número si el carácter siguiente es otra cifra, así que el punto final de
  `Hay 3.` cierra el número.
- **Mayúsculas** con `c.toLowerCase() !== c`, no con `/[A-Z]/`. El original
  perdía `Ñ`, `Á`, `É`… En las tablas de 8 puntos la mayúscula es una celda
  propia y no se antepone prefijo.
- Un valor de la tabla puede ser una celda (`[1,2,4]`) o varias (`[[6],[2]]`).
- Los caracteres sin traducción se listan en el recuadro de estado (sin
  repetir), en vez de escribirse en la consola.
- El motor lee `lang.latinToBraille` directamente. El original acumulaba las
  entradas de todas las tablas en un `Map` que nunca se limpiaba, así que al
  cambiar de tabla quedaban restos de la anterior.

## 3. Interfaz

- Selector de **idioma de interfaz** (es / en / fr) en la cabecera,
  independiente de la tabla braille. Al cambiarlo se reconstruye el panel
  dat.GUI con las etiquetas traducidas.
- A la vista, fuera de dat.GUI: texto, tabla braille, *No cortar palabras*,
  tamaño de papel (BrailleRAP 175×290, A4, A3, Carta, Oficio; pasa a
  «Personalizado» si se edita el ancho o el alto en el panel) y botón de
  descarga.
- dat.GUI conserva lo técnico (papel, celda, impresora, SVG), traducido.
- Recuadro de estado con `aria-live`: tamaño impreso, celdas por línea, líneas
  por página, páginas y caracteres no traducibles.
- El G-code que se descarga es el de la página visible, con el sufijo `-pN` en
  el nombre si hay más de una.
- La vista previa dibuja el borde de la hoja y el marco del área útil, y su
  relación de aspecto sigue al tamaño de papel.
- Los tres volcados de G-code están en un `<details>` plegado al final.
- Accesibilidad: un `label` por control, foco visible y `aria-label` en los
  botones de página.

## 4. Mayúsculas y modos de transcripción

Selector nuevo **Modo de transcripción** junto al de tabla braille, con dos
valores. Es independiente de la tabla y del idioma de la interfaz. Solo existe
para tablas con bloque `math` (hoy, la española); con las demás queda
deshabilitado y fijo en literatura. Entra al motor como
`textToTokens(text, lang, { mode: 'literatura' | 'matematicas' })`.

### Literatura (por defecto)

Fuente: documento técnico **B 2** de la ONCE.

- `=` → 2356 (también en literatura; el valor es el del CMU 5.1 y 6.1).
- **Palabras enteras en mayúsculas.** Un análisis previo (`analyzeCaps`) recorre
  el texto por palabras antes de traducirlo. Una palabra está «entera en
  mayúsculas» si tiene dos o más mayúsculas y ninguna minúscula; las cifras y la
  puntuación no la rompen (`EE.UU.`, `«ONCE»` entran; `A`, `iPhone` no). El
  criterio es el metadato `capsMode` de la tabla (o el hook del mismo nombre):

  | `capsMode` | Regla | Ejemplo |
  |---|---|---|
  | `palabra` (por defecto) | B 2, 7.1: dos signos 46 antes de la primera letra | `ONCE` → 46-46 o n c e; `«ONCE»` → 236 46 46 o n c e 236 |
  | `tipografico` | B 2, 7.2: en minúsculas entre dos signos 35 (`typographicSign`); palabras seguidas forman un grupo | `estas NORMAS es` → estas 35 normas 35 es |

  Un salto de línea corta el grupo. Las tablas sin `capsMode` (francesa, india)
  y las de 8 puntos siguen como antes.

### Matemáticas

Fuente: **Código Matemático Unificado para Iberoamérica**, Consejo
Iberoamericano del Braille, 2.ª edición, abril de 2024. Los valores están en el
bloque `math` de `braille-es.js`, con su apartado.

| Qué | Puntos | CMU |
|---|---|---|
| Mayúscula: prefijo 46 en cada letra, sin agrupar (`ABC` → 46-1 46-12 46-14) | 46 | 1.1 |
| Prefijo de latina minúscula ante a–j dentro de una expresión numérica (`3b` → 3456-14 5-12; `1+2i`; `234a5` → `#bcd@ae`) | 5 | 1.1, 2.5 |
| Separador decimal con apóstrofo en tinta (`3’2` → `#c,b`) | 2 | 2.3 |
| `+` sumar · `-` y `−` restar · `=` igual | 235 · 36 · 2356 | 5.1 |
| `×` multiplicar (aspa) | 236 | 5.1 |
| `·` multiplicar (punto): si la celda siguiente tiene algún punto 1, 2 o 3 se deja un cajetín en blanco (`6·2` → `#f_ #b`) | 6-0d | 5.1 y notación |
| `/` división con barra inclinada | 256 | 5.1 |
| `:` y `÷` división con dos puntos | 5-2 | 5.1 |
| `<` · `>` | 246 · 135 | 6.1 |
| `≤` · `≥` | 246-2356 · 135-2356 | 6.1 |
| `≈` · `≐` · `≔` · `≡` | 5-2356-3 · 4-2356 · 56-2356 · 2356-2356 | 6.1 |
| `≠` | 45-2356 | 6.2 |
| Exponente con superíndices Unicode (`x²` → `x1#b`, `x⁻¹` → `x1-#a`) | 16 | 4.2.1, 5.2.1 |
| Exponente de varios términos entre paréntesis auxiliares (`xⁿ⁺¹` → `x1?n+#a}`) | 26 … 35 | 3.1, 4.2.1 |

Dentro de una expresión numérica las letras no cierran el número: las cifras
siguientes no repiten el signo de número (CMU 1.1, `234a5`). Un exponente se
considera de varios términos cuando tiene `+`, `-` o `=` fuera de paréntesis y
no en la primera posición, para que `x⁻¹` y `x⁻⁽ⁿ⁺¹⁾` queden como los ejemplos
del 5.2.1, sin auxiliares.

Pendiente de decisión (no implementado):

- Punto en tinta entre cifras en modo matemáticas: hoy se transcribe como
  aparece (punto 3), así que `3.2` sale `#c.b` y no `#c,b` como en el CMU 2.3.
  El CMU decide por el significado y no da regla para texto plano.
- Espacio como separador de millares (`3 802 197`, `-25 347`): hoy el espacio
  separa números.
- Fracciones (`¾`, CMU 2.4).
- Texto y fórmulas mezclados en un mismo documento (CMU 14.1).

## Correcciones respecto del original

- **Tamaño impreso.** Los `bounds` del grupo de texto ya están en mm, porque la
  escala px/mm se aplica a la capa de paper.js. El original los dividía otra vez
  por `mmPerPixels` y reportaba un tamaño unas 3 veces más chico.
- **Filtro de puntos.** `buildoptimizedgcode` del original falla con
  coordenadas negativas (por ejemplo `invertX` sin `mirrorX`) al marcar la
  grilla de filtrado. Ahora se ignoran los índices fuera de la grilla. El
  G-code emitido no cambia.
- **Importar SVG tras reconstruir el panel.** Se conserva el manejador del
  selector de archivo al reconstruir el panel por cambio de idioma.

La emisión de G-code no cambió: `G90`, `G1 F`, homing `G28`, `M3 S1`/`M3 S0`,
orden zigzag por línea, parking `G1 X0 Y<alto>`, `M84`, las transformaciones
`invertX`/`invertY`/`mirrorX`/`mirrorY`/`delta` y el tratamiento del SVG
(`svgDots`, `svgStep`, filtro de puntos). Solo cambia qué celdas se dibujan y
dónde.

## Pruebas

```sh
npm test                        # o: node tests/test-layout.js
```

Son 85 casos y no necesitan dependencias: 28 celdas por línea, palabra que baja
entera (medida con sus prefijos), palabra más larga que la línea, comparación
con y sin `wordWrap`, signo de número (`1234`, `1.000`, `3,5`, `12 34`),
`Ñandú` y `Árbol`, barra de dos celdas, no soportados, paginación sin pérdida,
saltos y líneas en blanco, espacios dobles y sangría, tabla francesa, tablas de
8 puntos y devanagari, signo igual, mayúsculas agrupadas (palabra y tipográfico) y modo matemáticas con los ejemplos del CMU.

`tests/e2e-chrome.js` abre la página en Chrome headless (35 casos). Necesita
`puppeteer-core` instalado **fuera** del repo; las instrucciones están en la
cabecera del archivo. Comprueba: cero errores de consola, cambio de idioma de
interfaz y de tabla, paginación y descarga, golpes en el G-code (`ñu` = 8,
`Ñu` = 10, `12` = 7 `M3 S1`) y la igualdad con el G-code del original.

## Pendientes conocidos

- En **modo literatura**, una letra de la `a` a la `j` justo después de una
  cifra sigue sin prefijo: `3a` se lee como `31`. En modo matemáticas ya lleva
  el **prefijo de latina minúscula, punto 5** (CMU 1.1); los puntos 5-6 que
  decía esta nota son el prefijo de variante tipográfica (CMU 2.5 c), no el de
  minúscula. La regla del B 2 para literatura falta verificarla.
- Las **dimensiones de celda** siguen siendo las del original. Ajustarlas al
  Documento técnico B 1 (parámetros dimensionales) requiere medir contra la
  máquina.
- El **SVG importado se dibuja en todas las páginas**. Habría que fijarlo a una.

## Licencia

BrailleRap es MIT (Copyright 2014 Matt Montag). Hay que conservar el aviso de
copyright y `LICENSE.txt` en cualquier distribución del fork.
