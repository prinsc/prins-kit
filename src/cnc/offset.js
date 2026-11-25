/**
 * Décalage d'un contour (compensation d'outil pour le G-code). Pur, testé. Origine : SlatShape
 * (`engine/offset.js`), code du kit depuis le 2026-11-24.
 *
 * `offsetPolygon(pts, d)` : contour parallèle à distance |d|, À L'EXTÉRIEUR de la surface
 * qu'il entoure si d > 0, à l'intérieur si d < 0 (quel que soit son sens). Méthode : chaque
 * arête est poussée de |d| le long de sa normale ; aux sommets où les arêtes poussées
 * s'écartent, un arc (le centre de la fraise tourne autour du coin) ; là où elles se croisent,
 * leur intersection. Les boucles qui restent (un os de chien de rayon = fraise s'écrase en un
 * point, une arête plus courte que la fraise…) sont ensuite coupées : on garde le grand
 * contour, celui qui ne mord jamais la pièce.
 */
import { signedArea } from './geometry.js';

const cross = (ax, ay, bx, by) => ax * by - ay * bx;

/** Intersection des segments [p1,p2] et [p3,p4] (paramètres t, u dans [0, 1]) ou null. */
function segX(p1, p2, p3, p4) {
	const rx = p2[0] - p1[0];
	const ry = p2[1] - p1[1];
	const sx = p4[0] - p3[0];
	const sy = p4[1] - p3[1];
	const den = cross(rx, ry, sx, sy);
	if (Math.abs(den) < 1e-12) return null;
	const qx = p3[0] - p1[0];
	const qy = p3[1] - p1[1];
	const t = cross(qx, qy, sx, sy) / den;
	const u = cross(qx, qy, rx, ry) / den;
	if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
	return { t, u, p: [p1[0] + t * rx, p1[1] + t * ry] };
}

function dedupe(pts, eps = 1e-6) {
	const out = [];
	for (const p of pts) {
		const q = out[out.length - 1];
		if (!q || Math.abs(q[0] - p[0]) > eps || Math.abs(q[1] - p[1]) > eps) out.push(p);
	}
	while (out.length > 2) {
		const a = out[0];
		const b = out[out.length - 1];
		if (Math.abs(a[0] - b[0]) > eps || Math.abs(a[1] - b[1]) > eps) break;
		out.pop();
	}
	return out;
}

/**
 * @param {number[][]} pts contour fermé (dernier point non répété)
 * @param {number} d distance (> 0 : dehors)
 * @param {{ arcStep?: number }} [opts] pas angulaire des arcs (radians)
 */
export function offsetPolygon(pts, d, opts = {}) {
	let poly = dedupe(pts);
	if (poly.length < 3 || d === 0) return poly.slice();
	if (signedArea(poly) < 0) poly = poly.slice().reverse(); // anti-horaire : normale extérieure = (dy, -dx)
	const n = poly.length;
	const r = Math.abs(d);
	const s = Math.sign(d);
	const step = opts.arcStep ?? 0.3;
	// arêtes poussées
	const E = [];
	for (let i = 0; i < n; i++) {
		const a = poly[i];
		const b = poly[(i + 1) % n];
		const dx = b[0] - a[0];
		const dy = b[1] - a[1];
		const L = Math.hypot(dx, dy) || 1e-12;
		const nx = (s * dy) / L;
		const ny = (-s * dx) / L;
		E.push({ a: [a[0] + nx * r, a[1] + ny * r], b: [b[0] + nx * r, b[1] + ny * r], nx, ny });
	}
	const out = [];
	for (let i = 0; i < n; i++) {
		const e0 = E[(i - 1 + n) % n];
		const e1 = E[i];
		const v = poly[i];
		// sens du virage au sommet, vu du côté décalé : > 0 = les arêtes poussées s'écartent
		const turn = cross(e0.nx, e0.ny, e1.nx, e1.ny) * s;
		if (turn > 1e-9) {
			// arc autour du sommet, de la normale de e0 à celle de e1
			let a0 = Math.atan2(e0.ny, e0.nx);
			let a1 = Math.atan2(e1.ny, e1.nx);
			let da = a1 - a0;
			if (s > 0) while (da < 0) da += 2 * Math.PI;
			else while (da > 0) da -= 2 * Math.PI;
			const k = Math.max(1, Math.ceil(Math.abs(da) / step));
			for (let j = 0; j <= k; j++) {
				const ang = a0 + (da * j) / k;
				out.push([v[0] + Math.cos(ang) * r, v[1] + Math.sin(ang) * r]);
			}
		} else {
			// les arêtes poussées se croisent : leur intersection si elle existe, sinon les deux bouts
			// (la boucle minuscule ainsi créée part au nettoyage)
			const x = segX(e0.a, e0.b, e1.a, e1.b);
			if (x) out.push(x.p);
			else out.push(e0.b, e1.a);
		}
	}
	return removeLoops(dedupe(out), 1);
}

/**
 * Coupe les boucles d'un contour qui se recoupe : à chaque croisement, on garde la partie
 * dont l'aire a le bon signe et la plus grande (le grand contour), on jette l'autre.
 */
export function removeLoops(pts, sign = 1) {
	let p = pts.slice();
	for (let guard = 0; guard < 4000 && p.length > 3; guard++) {
		const hit = firstCrossing(p);
		if (!hit) break;
		const { i, j, x } = hit;
		// deux parties : (i+1 … j) et (j+1 … i) ; le point de croisement les ferme
		const inner = [x, ...p.slice(i + 1, j + 1)];
		const outer = [x, ...p.slice(j + 1), ...p.slice(0, i + 1)];
		const ai = signedArea(inner) * sign;
		const ao = signedArea(outer) * sign;
		// garder la partie « dehors » : aire de bon signe, et la plus grande
		p = ao >= ai ? outer : inner;
		p = dedupe(p);
	}
	return p;
}

/** Premier croisement entre deux arêtes non voisines (grille de cases pour aller vite). */
function firstCrossing(p) {
	const n = p.length;
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const [x, y] of p) {
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}
	const size = Math.max(1e-6, Math.max(maxX - minX, maxY - minY) / Math.max(4, Math.sqrt(n) * 2));
	const cells = new Map();
	const key = (cx, cy) => cx * 73856093 + cy * 19349663;
	const segCells = (i) => {
		const a = p[i];
		const b = p[(i + 1) % n];
		const x0 = Math.floor((Math.min(a[0], b[0]) - minX) / size);
		const x1 = Math.floor((Math.max(a[0], b[0]) - minX) / size);
		const y0 = Math.floor((Math.min(a[1], b[1]) - minY) / size);
		const y1 = Math.floor((Math.max(a[1], b[1]) - minY) / size);
		const out = [];
		for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) out.push(key(cx, cy));
		return out;
	};
	const owner = [];
	for (let i = 0; i < n; i++) {
		owner[i] = segCells(i);
		for (const k of owner[i]) {
			let list = cells.get(k);
			if (!list) cells.set(k, (list = []));
			list.push(i);
		}
	}
	let best = null;
	for (let i = 0; i < n; i++) {
		const seen = new Set();
		for (const k of owner[i]) {
			for (const j of cells.get(k)) {
				if (j <= i + 1 || seen.has(j)) continue;
				if (i === 0 && j === n - 1) continue; // voisines par la fermeture
				seen.add(j);
				const x = segX(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n]);
				if (!x) continue;
				// croisement au sommet partagé (contact sans croisement) : ignoré
				if ((x.t > 1 - 1e-9 && x.u < 1e-9 && j === i + 1) || (x.t < 1e-9 && x.u > 1 - 1e-9)) continue;
				if (!best || i < best.i || (i === best.i && j < best.j)) best = { i, j, x: x.p };
			}
		}
		if (best && best.i === i) return best;
	}
	return best;
}

/** Distance d'un point à un contour fermé. */
export function distToPolygon(pt, poly) {
	let m = Infinity;
	for (let i = 0, n = poly.length; i < n; i++) {
		const a = poly[i];
		const b = poly[(i + 1) % n];
		const vx = b[0] - a[0];
		const vy = b[1] - a[1];
		const l2 = vx * vx + vy * vy || 1e-12;
		const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * vx + (pt[1] - a[1]) * vy) / l2));
		const dd = Math.hypot(pt[0] - a[0] - t * vx, pt[1] - a[1] - t * vy);
		if (dd < m) m = dd;
	}
	return m;
}
