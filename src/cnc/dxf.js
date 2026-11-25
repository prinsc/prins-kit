/**
 * Sorties atelier : DXF (R12, le plus lu : VCarve/Aspire, Fusion, LightBurn, RDWorks…) et
 * SVG en millimètres (découpe laser). Origine : SlatShape (`engine/export.js`), code du kit
 * depuis le 2026-11-24 (la liste CSV, propre à chaque outil, est restée dans l'outil).
 *
 * Couches DXF :
 *  - DECOUPE    contours extérieurs (couleur 1, rouge)
 *  - DECOUPE_INT contours intérieurs : fentes de la plaque de fond (couleur 6, magenta) -
 *               à usiner AVANT les contours extérieurs, fraise à l'intérieur du trait
 *  - PERCAGE    trous de vis (couleur 5, bleu)
 *  - GRAVURE    repères des pièces, texte (couleur 3, vert) - à graver en surface ou ignorer
 *  - PLAQUE     bord de la plaque, information seulement (couleur 8, gris) - ne pas usiner
 *  - POCHE_<p>  poches (entailles, rainures) à la profondeur p mm, ex. `POCHE_12` ou `POCHE_2_5`
 *               (couleur 4, cyan) - à vider AVANT les contours ; une couche par profondeur
 *  - PERCAGE_<p> perçages BORGNES de profondeur p mm (couleur 5) ; `PERCAGE` = traversants
 *
 * Pièce = `{ id, outline, inner?, holes?: [{ x, y, r, depth? }], pockets?: [{ poly, depth }],
 * label?: { x, y, h, text } }` (mm, contour anti-horaire, dernier point non répété).
 *
 * Les contours sont la géométrie RÉELLE des pièces : la compensation d'outil (fraise à
 * l'extérieur du contour) se règle dans le logiciel de FAO.
 */
import { transformPoint } from './geometry.js';

export const LAYERS = [
	{ name: 'DECOUPE', color: 1 },
	{ name: 'DECOUPE_INT', color: 6 },
	{ name: 'PERCAGE', color: 5 },
	{ name: 'GRAVURE', color: 3 },
	{ name: 'PLAQUE', color: 8 }
];

const f = (n) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(3));

/** Nom de couche d'une profondeur : 12 → `12`, 2,5 → `2_5` (DXF : pas de virgule ni de point). */
const depthTag = (d) => String(Math.round(d * 10) / 10).replace('.', '_');
export const pocketLayer = (depth) => `POCHE_${depthTag(depth)}`;
export const drillLayer = (depth) => (depth > 0 ? `PERCAGE_${depthTag(depth)}` : 'PERCAGE');

/** Couches présentes dans un document : les fixes, puis les poches et perçages borgnes. */
function layersOf(entities) {
	const out = [...LAYERS];
	const seen = new Set(out.map((l) => l.name));
	for (const e of entities) {
		if (seen.has(e.layer)) continue;
		seen.add(e.layer);
		out.push({ name: e.layer, color: e.layer.startsWith('POCHE') ? 4 : e.layer.startsWith('PERCAGE') ? 5 : 7 });
	}
	return out;
}

/** Texte DXF R12 : ASCII seulement. */
function asciiText(s) {
	return String(s)
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^\x20-\x7e]/g, '?');
}

/**
 * @param {{ type: 'polyline' | 'circle' | 'text', layer: string, [k: string]: any }[]} entities
 */
export function dxfDocument(entities) {
	const L = [];
	const g = (code, value) => {
		L.push(String(code), String(value));
	};
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	const ext = (x, y) => {
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	};
	for (const e of entities) {
		if (e.type === 'polyline') e.points.forEach(([x, y]) => ext(x, y));
		else if (e.type === 'circle') {
			ext(e.x - e.r, e.y - e.r);
			ext(e.x + e.r, e.y + e.r);
		} else ext(e.x, e.y);
	}
	if (!Number.isFinite(minX)) minX = minY = maxX = maxY = 0;

	g(0, 'SECTION');
	g(2, 'HEADER');
	g(9, '$ACADVER');
	g(1, 'AC1009');
	g(9, '$INSUNITS');
	g(70, 4); // millimètres
	g(9, '$MEASUREMENT');
	g(70, 1);
	g(9, '$EXTMIN');
	g(10, f(minX));
	g(20, f(minY));
	g(30, 0);
	g(9, '$EXTMAX');
	g(10, f(maxX));
	g(20, f(maxY));
	g(30, 0);
	g(0, 'ENDSEC');

	g(0, 'SECTION');
	g(2, 'TABLES');
	g(0, 'TABLE');
	g(2, 'LTYPE');
	g(70, 1);
	g(0, 'LTYPE');
	g(2, 'CONTINUOUS');
	g(70, 0);
	g(3, 'Solid line');
	g(72, 65);
	g(73, 0);
	g(40, '0.0');
	g(0, 'ENDTAB');
	g(0, 'TABLE');
	g(2, 'LAYER');
	const layers = layersOf(entities);
	g(70, layers.length);
	for (const l of layers) {
		g(0, 'LAYER');
		g(2, l.name);
		g(70, 0);
		g(62, l.color);
		g(6, 'CONTINUOUS');
	}
	g(0, 'ENDTAB');
	g(0, 'ENDSEC');

	g(0, 'SECTION');
	g(2, 'ENTITIES');
	for (const e of entities) {
		if (e.type === 'polyline') {
			g(0, 'POLYLINE');
			g(8, e.layer);
			g(66, 1);
			g(10, 0);
			g(20, 0);
			g(30, 0);
			g(70, e.closed === false ? 0 : 1);
			for (const [x, y] of e.points) {
				g(0, 'VERTEX');
				g(8, e.layer);
				g(10, f(x));
				g(20, f(y));
				g(30, 0);
			}
			g(0, 'SEQEND');
			g(8, e.layer);
		} else if (e.type === 'circle') {
			g(0, 'CIRCLE');
			g(8, e.layer);
			g(10, f(e.x));
			g(20, f(e.y));
			g(30, 0);
			g(40, f(e.r));
		} else if (e.type === 'text') {
			g(0, 'TEXT');
			g(8, e.layer);
			g(10, f(e.x));
			g(20, f(e.y));
			g(30, 0);
			g(40, f(e.h));
			g(1, asciiText(e.text));
			if (e.rot) g(50, f(e.rot));
			g(72, 1); // centré
			g(11, f(e.x));
			g(21, f(e.y));
			g(31, 0);
			g(73, 2); // milieu
		}
	}
	g(0, 'ENDSEC');
	g(0, 'EOF');
	return L.join('\r\n') + '\r\n';
}

/** Entités d'une plaque imbriquée (coordonnées plaque, origine en bas à gauche). */
export function sheetEntities(sheet, { labels = true, outline = true } = {}) {
	const ents = [];
	if (outline) {
		ents.push({
			type: 'polyline',
			layer: 'PLAQUE',
			points: [
				[0, 0],
				[sheet.width, 0],
				[sheet.width, sheet.height],
				[0, sheet.height]
			]
		});
	}
	for (const pl of sheet.placements) ents.push(...partEntities(pl.part, pl.matrix, { labels }));
	return ents;
}

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Entités d'une pièce, posée par la matrice `m` (poches d'abord : elles s'usinent avant). */
export function partEntities(part, m = IDENTITY, { labels = true } = {}) {
	const ents = [];
	const tf = (pts) => pts.map((p) => transformPoint(m, p));
	for (const k of part.pockets ?? []) ents.push({ type: 'polyline', layer: pocketLayer(k.depth), points: tf(k.poly) });
	for (const q of part.inner ?? []) ents.push({ type: 'polyline', layer: 'DECOUPE_INT', points: tf(q) });
	ents.push({ type: 'polyline', layer: 'DECOUPE', points: tf(part.outline) });
	for (const h of part.holes ?? []) {
		const [x, y] = transformPoint(m, [h.x, h.y]);
		ents.push({ type: 'circle', layer: drillLayer(h.depth ?? 0), x, y, r: h.r });
	}
	if (labels && part.label) {
		const [x, y] = transformPoint(m, [part.label.x, part.label.y]);
		ents.push({ type: 'text', layer: 'GRAVURE', x, y, h: part.label.h, text: part.label.text });
	}
	return ents;
}

export function sheetDXF(sheet, opts) {
	return dxfDocument(sheetEntities(sheet, opts));
}

/** SVG en mm, y vers le haut ramené au repère SVG (y vers le bas). */
export function sheetSVG(sheet, { labels = true, outline = true, title = '' } = {}) {
	const H = sheet.height;
	const pt = ([x, y]) => `${f(x)},${f(H - y)}`;
	const parts = [];
	for (const e of sheetEntities(sheet, { labels, outline })) {
		if (e.type === 'polyline') {
			const stroke = e.layer === 'PLAQUE' ? '#9a9a9a' : e.layer === 'DECOUPE_INT' ? '#c026d3' : e.layer.startsWith('POCHE') ? '#0891b2' : '#e5222b';
			parts.push(`<polygon data-layer="${e.layer}" points="${e.points.map(pt).join(' ')}" fill="none" stroke="${stroke}" stroke-width="0.2"/>`);
		} else if (e.type === 'circle') {
			parts.push(`<circle data-layer="${e.layer}" cx="${f(e.x)}" cy="${f(H - e.y)}" r="${f(e.r)}" fill="none" stroke="#1f5fe0" stroke-width="0.2"/>`);
		} else {
			parts.push(
				`<text data-layer="${e.layer}" x="${f(e.x)}" y="${f(H - e.y)}" font-family="Arial, sans-serif" font-size="${f(e.h)}" text-anchor="middle" dominant-baseline="middle" fill="#1a9e4b">${escapeXml(e.text)}</text>`
			);
		}
	}
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${f(sheet.width)}mm" height="${f(H)}mm" viewBox="0 0 ${f(sheet.width)} ${f(H)}">
${title ? `<title>${escapeXml(title)}</title>\n` : ''}${parts.join('\n')}
</svg>
`;
}

function escapeXml(s) {
	return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
}

/** DXF d'une pièce seule, à l'origine (contrôle, recoupe d'une pièce cassée). */
export function partDXF(part) {
	return dxfDocument(partEntities(part));
}
