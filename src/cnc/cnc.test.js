// Fabrication numérique du kit : imbrication (fil du bois, miroir), poches, perçages borgnes,
// DXF et G-code. Pièces synthétiques : les outils testent leurs propres pièces chez eux.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nest, nestGroups, applyMatrix, skipTest } from './nesting.js';
import { offsetPolygon, distToPolygon } from './offset.js';
import { signedArea, dogbone, bbox } from './geometry.js';
import { sheetDXF, sheetSVG, partDXF, pocketLayer, drillLayer } from './dxf.js';
import { sheetGcode, pocketRings, CAM_DEFAULTS } from './gcode.js';
import { parseGcode } from './gcode-parse.js';
import * as all from './index.js';

const rect = (w, h, x = 0, y = 0) => [
	[x, y],
	[x + w, y],
	[x + w, y + h],
	[x, y + h]
];
const part = (id, w, h, extra = {}) => ({ id, kind: 'p', outline: rect(w, h), holes: [], ...extra });

/** Lecteur minimal : positions successives (modal). */
function run(text) {
	const pos = { X: 0, Y: 0, Z: 0 };
	const moves = [];
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.replace(/\(.*?\)/g, '').trim();
		const g = /^G([01])\b/.exec(line);
		if (!g) continue;
		const next = { ...pos };
		for (const m of line.matchAll(/([XYZ])(-?\d+(?:\.\d+)?)/g)) next[m[1]] = Number(m[2]);
		moves.push({ rapid: g[1] === '0', from: { ...pos }, to: next });
		Object.assign(pos, next);
	}
	return moves;
}

const placedBox = (pl) => bbox(pl.part.outline.map((p) => applyMatrix(pl.matrix, p)));
const overlap = (a, b) => a.minX < b.maxX - 1e-6 && b.minX < a.maxX - 1e-6 && a.minY < b.maxY - 1e-6 && b.minY < a.maxY - 1e-6;

test("l'entrée `cnc` expose tout", () => {
	for (const k of ['nest', 'nestGroups', 'offsetPolygon', 'dogbone', 'sheetDXF', 'sheetGcode', 'parseGcode', 'CAM_DEFAULTS', 'pocketRings']) assert.equal(typeof all[k] !== 'undefined', true, k);
});

test('imbrication : aucun chevauchement, marges tenues', () => {
	const parts = Array.from({ length: 30 }, (_, i) => part(`P${i}`, 300 + (i % 5) * 90, 120 + (i % 3) * 60));
	const res = nest(parts, { width: 2440, height: 1220, margin: 10, spacing: 8 });
	const placed = res.sheets.flatMap((s) => s.placements.map((pl) => ({ s: s.index, b: placedBox(pl) })));
	assert.equal(placed.length, 30);
	for (const p of placed) assert.ok(p.b.minX >= 10 - 1e-6 && p.b.minY >= 10 - 1e-6 && p.b.maxX <= 2430 + 1e-6 && p.b.maxY <= 1210 + 1e-6, 'dans les marges');
	for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) if (placed[i].s === placed[j].s) assert.ok(!overlap(placed[i].b, placed[j].b), `chevauchement ${i}/${j}`);
});

test('fil du bois : `turn: false` garde le x de la pièce le long de la plaque, `flip: false` sans miroir', () => {
	// pièces étroites et longues en travers : sans contrainte, certaines passeraient debout
	const parts = Array.from({ length: 24 }, (_, i) => part(`M${i}`, 900, 300 + (i % 4) * 20, { turn: false, flip: false }));
	const res = nest(parts, { width: 3000, height: 1250, margin: 10, spacing: 10 });
	let n = 0;
	for (const s of res.sheets) {
		for (const pl of s.placements) {
			const m = pl.matrix;
			// x de la pièce → x de la plaque (±), jamais y : pas de quart de tour
			assert.ok(Math.abs(m.b) < 1e-9 && Math.abs(m.c) < 1e-9, `quart de tour sur ${pl.part.id}`);
			// déterminant positif : pas de miroir
			assert.ok(m.a * m.d - m.b * m.c > 0, `miroir sur ${pl.part.id}`);
			n++;
		}
	}
	assert.equal(n, 24);
	// une pièce plus longue que la plaque et interdite de quart de tour : hors format
	const big = nest([part('X', 1100, 2900, { turn: false })], { width: 3000, height: 1250 });
	assert.equal(big.oversize.length, 1);
	const free = nest([part('Y', 1100, 2900)], { width: 3000, height: 1250 });
	assert.equal(free.oversize.length, 0, 'sans contrainte, elle passe debout');
});

test('groupes : une série de plaques par matière / épaisseur ; skipTest', () => {
	const g = nestGroups(
		[
			{ key: 'a', material: 'chene', thickness: 40, parts: [part('A1', 800, 300), part('A2', 800, 300)] },
			{ key: 'b', material: 'chene', thickness: 18, parts: [part('B1', 800, 170)] }
		],
		{ width: 3000, height: 1250 }
	);
	assert.deepEqual(
		g.sheets.map((s) => s.group),
		['a', 'b']
	);
	const off = skipTest(['A2', 'kind:x']);
	assert.equal(off({ id: 'A2', kind: 'p' }), true);
	assert.equal(off({ id: 'Z', kind: 'x' }), true);
	assert.equal(off({ id: 'A1', kind: 'p' }), false);
});

test('anneaux de poche : à r du bord, du bord vers le centre, vides si la fraise ne passe pas', () => {
	const poly = rect(300, 40, 50, 50);
	const r = 3;
	const rings = pocketRings(poly, r, 2.7);
	assert.ok(rings.length >= 6, `${rings.length} anneaux`);
	for (const q of rings[0]) assert.ok(Math.abs(distToPolygon(q, poly) - r) < 0.05, 'premier anneau à r du bord');
	for (const ring of rings) for (const q of ring) assert.ok(distToPolygon(q, poly) >= r - 0.05, 'jamais à moins de r');
	// la matière au centre est atteinte : le dernier anneau est à moins de r + pas de la ligne médiane
	const last = rings[rings.length - 1];
	assert.ok(Math.max(...last.map((q) => Math.abs(q[1] - 70))) <= r + 2.7 + 1e-6, 'centre vidé');
	assert.deepEqual(pocketRings(rect(5, 40), r, 2.7), [], 'rainure de 5 mm : fraise de 6 trop large');
});

test('G-code : poche à sa profondeur, perçage borgne, contour traversant, ordre poche → contour', () => {
	const p = part('L1', 600, 300, {
		pockets: [{ poly: rect(200, 40, 100, 100), depth: 12 }],
		holes: [
			{ x: 450, y: 150, r: 6, depth: 20 },
			{ x: 520, y: 150, r: 2 }
		]
	});
	const res = nest([p], { width: 2440, height: 1220, margin: 10, spacing: 10 });
	const T = 40;
	const { text, stats } = sheetGcode(res.sheets[0], { thickness: T, toolDiameter: 6, passDepth: 6, feed: 5000, app: 'Blondel', title: 'essai' });
	assert.match(text, /^%\r\n\(Blondel - essai\)/);
	assert.ok(!/[^\x00-\x7e]/.test(text), 'ASCII seulement');
	assert.equal(stats.pocketSkipped, 0);
	const moves = run(text);
	const cuts = moves.filter((m) => !m.rapid);
	const zs = cuts.map((m) => m.to.Z);
	assert.ok(Math.abs(Math.min(...zs) + T + CAM_DEFAULTS.overcut) < 1e-3, 'le contour traverse');
	// mouvements dans la poche (repérée dans la plaque) : jamais sous -12
	const pl = res.sheets[0].placements[0];
	const pk = bbox(p.pockets[0].poly.map((q) => applyMatrix(pl.matrix, q)));
	const inPocket = cuts.filter((m) => m.to.X > pk.minX + 3.5 && m.to.X < pk.maxX - 3.5 && m.to.Y > pk.minY + 3.5 && m.to.Y < pk.maxY - 3.5);
	assert.ok(inPocket.length > 10, 'la poche est vidée');
	assert.ok(Math.abs(Math.min(...inPocket.map((m) => m.to.Z)) + 12) < 1e-3, 'poche à 12 mm');
	// perçage borgne Ø12 à 20 mm (hélice : fraise de 6)
	const [hx, hy] = applyMatrix(pl.matrix, [450, 150]);
	const nearHole = cuts.filter((m) => Math.hypot(m.to.X - hx, m.to.Y - hy) < 3.5);
	assert.ok(nearHole.length && Math.abs(Math.min(...nearHole.map((m) => m.to.Z)) + 20) < 1e-3, 'perçage borgne à 20 mm');
	// ordre : la poche avant le contour extérieur
	const firstPocket = moves.findIndex((m) => !m.rapid && Math.abs(m.to.Z + 12) < 1e-3);
	// (le petit trou traversant, lui, est percé avant : perçages d'abord)
	const [tx, ty] = applyMatrix(pl.matrix, [520, 150]);
	const firstThrough = moves.findIndex((m) => !m.rapid && m.to.Z < -T + 1e-3 && Math.hypot(m.to.X - tx, m.to.Y - ty) > 10);
	assert.ok(firstPocket >= 0 && firstPocket < firstThrough, 'poche usinée avant de libérer la pièce');
	// relecture pour la simulation
	const prog = parseGcode(text);
	assert.equal(prog.info.t, T);
});

test('DXF / SVG : couches de poche et de perçage borgne', () => {
	const p = part('M3', 800, 300, { pockets: [{ poly: rect(780, 18, 10, 200), depth: 2.5 }], holes: [{ x: 40, y: 40, r: 6, depth: 20 }], label: { x: 400, y: 150, h: 20, text: 'M3' } });
	assert.equal(pocketLayer(2.5), 'POCHE_2_5');
	assert.equal(drillLayer(20), 'PERCAGE_20');
	assert.equal(drillLayer(0), 'PERCAGE');
	const res = nest([p], { width: 2440, height: 1220 });
	const dxf = sheetDXF(res.sheets[0]);
	for (const l of ['POCHE_2_5', 'PERCAGE_20', 'DECOUPE', 'GRAVURE', 'PLAQUE']) assert.ok(dxf.includes(`\r\n${l}\r\n`), l);
	assert.ok(dxf.startsWith('0\r\nSECTION') && dxf.endsWith('EOF\r\n'));
	const svg = sheetSVG(res.sheets[0]);
	assert.match(svg, /data-layer="POCHE_2_5"/);
	assert.match(partDXF(p), /POCHE_2_5/);
});

test('os de chien et décalage : repris tels quels de SlatShape', () => {
	const pts = dogbone([10, 0], [10, 20], [30, 20], 3);
	assert.ok(pts.length > 2);
	const out = offsetPolygon(rect(100, 50), 3);
	assert.ok(signedArea(out) > 100 * 50);
});

test('plaques en stock d’abord, chutes réutilisables (portés de SlatShape le 2026-11-24)', async () => {
	const { nest: n2, largestFree, offcutOf } = await import('./nesting.js');
	const parts = Array.from({ length: 6 }, (_, i) => ({ id: `P${i}`, kind: 'x', outline: [[0, 0], [700, 0], [700, 300], [0, 300]], holes: [] }));
	const r = n2(parts, { width: 2440, height: 1220, stock: [{ w: 1500, h: 700, n: 1 }] }, { budgetMs: 1e9 });
	assert.equal(r.sheets[0].stock, 0, 'la chute du stock passe avant la plaque neuve');
	assert.equal(r.sheets[0].width, 1500);
	assert.equal(r.sheets.reduce((k, s) => k + s.placements.length, 0), 6);
	const last = r.sheets[r.sheets.length - 1];
	assert.ok(last.offcut && last.offcut.w >= 150 && last.offcut.h >= 150);
	const g = { cols: 4, rows: 3, occ: [new Uint8Array([0, 0, 1, 0]), new Uint8Array([0, 0, 1, 0]), new Uint8Array([0, 0, 0, 0])] };
	assert.equal(largestFree(g).area, 6);
	assert.equal(typeof offcutOf, 'function');
});
