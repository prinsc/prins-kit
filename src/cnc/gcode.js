/**
 * G-code pour Mach3 (`.tap`) : une plaque = un fichier. Pur, testé. Origine : SlatShape (qui
 * ne l'importe que côté SERVEUR : le navigateur n'y a jamais les trajectoires exactes) ; code du
 * kit depuis le 2026-11-24.
 *
 * - Compensation d'outil faite ici (`offset.js`) : contours extérieurs décalés de r vers
 *   l'extérieur, fentes et trous vers l'intérieur. Aucun G41/G42 (souvent désactivé sur les
 *   machines, et capricieux à l'entrée).
 * - Ordre par plaque : petites pièces d'abord ; dans une pièce, perçages, poches, contours
 *   intérieurs (fentes de la plaque de fond), puis le contour extérieur.
 * - Poches (`part.pockets: [{ poly, depth }]`, entailles de limon, rainures) : vidées par
 *   anneaux concentriques (pas latéral `stepover` × diamètre), du centre vers le bord, palier
 *   par palier ; la paroi est finie par le dernier anneau (fraise à l'intérieur du trait).
 * - Perçages borgnes : `holes[].depth` (sinon traversants).
 * - Passes de `passDepth` jusqu'à l'épaisseur + `overcut` (dans le martyr) ; entrée en rampe ;
 *   attaches (ponts) sur le contour extérieur aux dernières passes, pour que la pièce ne
 *   bouge pas une fois libérée.
 * - Avalant (climb) par défaut avec une broche horaire : extérieur parcouru en sens horaire,
 *   intérieur en sens anti-horaire. Commentaires sans accents (Mach3).
 */
import { applyMatrix } from './nesting.js';
import { offsetPolygon, distToPolygon } from './offset.js';
import { signedArea } from './geometry.js';
import { CAM_DEFAULTS } from './cam.js';

export { CAM_DEFAULTS };

const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[()]/g, '').replace(/[^\x20-\x7e]/g, '?');
const f3 = (v) => (Math.abs(v) < 5e-4 ? '0' : v.toFixed(3).replace(/\.?0+$/, ''));

function cumLengths(path) {
	const L = [0];
	for (let i = 1; i <= path.length; i++) {
		const a = path[i - 1];
		const b = path[i % path.length];
		L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
	}
	return L;
}

/** Point à l'abscisse curviligne s (boucle fermée). */
function pointAt(path, L, s) {
	const total = L[L.length - 1];
	s = ((s % total) + total) % total;
	let i = 1;
	while (i < L.length - 1 && L[i] < s) i++;
	const a = path[i - 1];
	const b = path[i % path.length];
	const t = (s - L[i - 1]) / Math.max(1e-12, L[i] - L[i - 1]);
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Parcours d'une boucle de s0 à s1 (s1 peut dépasser la longueur) : points [x, y, prof],
 * coupés aux changements de profondeur (`depthAt`, constante par morceaux ou linéaire).
 */
function walk(path, L, s0, s1, breaks, depthAt) {
	const total = L[L.length - 1];
	const cuts = new Set([s0, s1]);
	for (let k = Math.floor(s0 / total); k <= Math.ceil(s1 / total); k++) {
		for (let i = 0; i < L.length; i++) {
			const s = L[i] + k * total;
			if (s > s0 && s < s1) cuts.add(s);
		}
		for (const b of breaks) {
			const s = b + k * total;
			if (s > s0 && s < s1) cuts.add(s);
		}
	}
	const ss = [...cuts].sort((a, b) => a - b);
	const out = [];
	for (let i = 0; i < ss.length; i++) {
		const s = ss[i];
		const p = pointAt(path, L, s);
		// aux bords d'une attache, deux profondeurs au même point : descente / montée verticale
		const before = depthAt(s - 1e-6, true);
		const after = depthAt(s + 1e-6, false);
		if (i > 0 && Math.abs(before - after) > 1e-6) out.push([p[0], p[1], before], [p[0], p[1], after]);
		else out.push([p[0], p[1], i === 0 ? after : before]);
	}
	return out;
}

/** Intervalles d'attaches [a, b] (abscisses) régulièrement répartis sur la boucle. */
function tabRanges(total, count, width) {
	if (count <= 0 || width * count > total * 0.6) return [];
	const out = [];
	for (let k = 0; k < count; k++) {
		const c = ((k + 0.5) * total) / count;
		out.push([c - width / 2, c + width / 2]);
	}
	return out;
}

/**
 * Anneaux d'usinage d'une poche : décalages de `-r`, `-r - pas`, … vers l'intérieur, tant que
 * l'anneau reste un vrai contour (même sens, aire qui diminue, à la bonne distance du bord).
 * Rend [] si la fraise ne passe pas (poche plus étroite que la fraise).
 * @param {number[][]} poly contour de la poche
 * @param {number} r rayon de la fraise
 * @param {number} step pas latéral (mm)
 */
export function pocketRings(poly, r, step) {
	const rings = [];
	let base = poly.slice();
	if (signedArea(base) < 0) base = base.reverse();
	let prevArea = Math.abs(signedArea(base));
	for (let d = r, k = 0; k < 400; d += Math.max(0.2, step), k++) {
		const ring = offsetPolygon(base, -d);
		const a = signedArea(ring);
		if (ring.length < 3 || !(a > 1e-3) || a >= prevArea) break;
		// anneau dégénéré (décalage plus grand que la demi-largeur) : un sommet trop près du bord
		if (ring.some((p) => distToPolygon(p, base) < d - 0.05 || !inside(p, base))) break;
		rings.push(ring);
		prevArea = a;
	}
	return rings;
}

function inside([x, y], poly) {
	let c = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const [xi, yi] = poly[i];
		const [xj, yj] = poly[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
	}
	return c;
}

/**
 * G-code d'une plaque.
 * @param {{ width: number, height: number, placements: any[], index: number }} sheet
 * @param {{ thickness: number, toolDiameter: number, passDepth: number, feed: number, cam?: Partial<typeof CAM_DEFAULTS>, title?: string, material?: string, app?: string }} o
 * @returns {{ text: string, stats: { cutLength: number, minutes: number, passes: number, lines: number } }}
 */
export function sheetGcode(sheet, o) {
	const cam = { ...CAM_DEFAULTS, ...(o.cam ?? {}) };
	const T = o.thickness;
	const r = o.toolDiameter / 2;
	const feed = cam.feed > 0 ? cam.feed : o.feed;
	const total = T + Math.max(0, cam.overcut);
	const passes = Math.max(1, Math.ceil(total / Math.max(0.2, o.passDepth) - 1e-9));
	const depths = Array.from({ length: passes }, (_, k) => Math.min(total, ((k + 1) * total) / passes));
	const tabDepth = Math.max(0, T - Math.max(0, cam.tabHeight));
	const ox = cam.origin === 'center' ? -sheet.width / 2 : 0;
	const oy = cam.origin === 'center' ? -sheet.height / 2 : 0;
	const Z = (depth) => (cam.zZero === 'bed' ? T - depth : -depth);
	const zSafe = Z(0) + cam.safeZ;
	const zNear = Z(0) + 1;
	const lines = [];
	let len = 0;
	let rapid = 0;
	let zTravel = 0;
	let cur = [0, 0, zSafe];
	const emit = (s) => lines.push(s);
	const g0 = (x, y, z) => {
		const parts = ['G0'];
		if (x != null) parts.push(`X${f3(x + ox)}`, `Y${f3(y + oy)}`);
		if (z != null) parts.push(`Z${f3(z)}`);
		emit(parts.join(' '));
		if (x != null) rapid += Math.hypot(x - cur[0], y - cur[1]);
		if (z != null) zTravel += Math.abs(z - cur[2]);
		cur = [x ?? cur[0], y ?? cur[1], z ?? cur[2]];
	};
	let lastF = 0;
	const g1 = (x, y, z, F) => {
		const parts = ['G1', `X${f3(x + ox)}`, `Y${f3(y + oy)}`, `Z${f3(z)}`];
		if (F !== lastF) {
			parts.push(`F${Math.round(F)}`);
			lastF = F;
		}
		emit(parts.join(' '));
		len += Math.hypot(x - cur[0], y - cur[1], z - cur[2]);
		cur = [x, y, z];
	};

	// boucle fermée en passes successives (rampe, attaches)
	const cutLoop = (path, withTabs, levels = depths) => {
		const L = cumLengths(path);
		const P = L[L.length - 1];
		if (P < 1e-6) return;
		const tabs = withTabs && cam.tabs ? tabRanges(P, Math.max(2, Math.min(6, Math.round(P / 500))), cam.tabLength + 2 * r) : [];
		const breaks = tabs.flat();
		const inTab = (s) => tabs.some(([a, b]) => s > a && s < b);
		const rampLen = cam.ramp ? Math.min(40, P / 3) : 0;
		g0(null, null, zSafe);
		g0(path[0][0], path[0][1]);
		g0(null, null, zNear);
		let prev = 0;
		// chaque passe repart d'où la précédente s'est arrêtée (jamais de corde à travers la pièce)
		let s0 = 0;
		for (const depth of levels) {
			const clamp = (s, d) => (inTab(((s % P) + P) % P) ? Math.min(d, tabDepth) : d);
			if (rampLen > 0) {
				const pts = walk(path, L, s0, s0 + P + rampLen, [...breaks, rampLen + s0], (s) => clamp(s, s < s0 + rampLen ? prev + ((depth - prev) * Math.max(0, s - s0)) / rampLen : depth));
				pts.forEach(([x, y, d], i) => g1(x, y, Z(d), i === 0 ? cam.plunge : feed));
				s0 = (s0 + rampLen) % P;
			} else {
				g1(path[0][0], path[0][1], Z(clamp(0, depth)), cam.plunge);
				const pts = walk(path, L, 0, P, breaks, (s) => clamp(s, depth));
				pts.forEach(([x, y, d]) => g1(x, y, Z(d), feed));
			}
			prev = depth;
		}
		g0(null, null, zSafe);
	};

	const orient = (path, cw) => (signedArea(path) < 0 === cw ? path : path.slice().reverse());
	// paliers jusqu'à une profondeur donnée (poches, perçages borgnes) : pas de passe dans le martyr
	const levelsTo = (d) => {
		const k = Math.max(1, Math.ceil(d / Math.max(0.2, o.passDepth) - 1e-9));
		return Array.from({ length: k }, (_, i) => Math.min(d, ((i + 1) * d) / k));
	};
	const stepover = Math.max(0.2, (cam.stepover ?? 0.45) * o.toolDiameter);
	let pocketSkipped = 0;
	// poche : palier par palier, anneaux du centre vers le bord (le dernier finit la paroi)
	const cutPocket = (poly, depth) => {
		const rings = pocketRings(poly, r, stepover).map((q) => orient(q, !cam.climb));
		if (!rings.length) {
			pocketSkipped++;
			emit('(Poche plus etroite que la fraise : ignoree)');
			return;
		}
		const order = rings.slice().reverse();
		g0(null, null, zSafe);
		g0(order[0][0][0], order[0][0][1]);
		g0(null, null, zNear);
		for (const d of levelsTo(depth)) {
			g1(order[0][0][0], order[0][0][1], Z(d), cam.plunge);
			for (const ring of order) {
				g1(ring[0][0], ring[0][1], Z(d), feed);
				for (let i = 1; i <= ring.length; i++) g1(ring[i % ring.length][0], ring[i % ring.length][1], Z(d), feed);
			}
			g0(null, null, zNear);
			g0(order[0][0][0], order[0][0][1]);
		}
		g0(null, null, zSafe);
	};

	emit('%');
	emit(`(${ascii(o.app ?? 'kltk')} - ${ascii(o.title ?? 'plaque')})`);
	emit(`(Plaque ${sheet.width} x ${sheet.height} mm - ${ascii(o.material ?? '')} ${f3(T)} mm)`);
	emit(`(Fraise D${f3(o.toolDiameter)} mm - ${passes} passes de ${f3(total / passes)} mm - broche ${cam.spindle} tr/min - avance ${feed} mm/min)`);
	emit(`(Origine : ${cam.origin === 'center' ? 'centre de la plaque' : 'coin bas gauche de la plaque'} - Z0 : ${cam.zZero === 'bed' ? 'dessus du martyr' : 'dessus de la plaque'})`);
	emit(`(Compensation d outil incluse - attaches ${cam.tabs ? `${cam.tabLength} x ${cam.tabHeight} mm` : 'aucune'})`);
	emit('G21 G90 G17 G40 G49 G80 G94');
	emit(`G0 Z${f3(zSafe)}`);
	emit(`M3 S${Math.round(cam.spindle)}`);

	const parts = [...sheet.placements].sort((a, b) => Math.abs(signedArea(a.part.outline)) - Math.abs(signedArea(b.part.outline)));
	for (const pl of parts) {
		const m = pl.matrix;
		const tf = (pts) => pts.map((p) => applyMatrix(m, p));
		emit(`(Piece ${ascii(pl.part.id)})`);
		// perçages : plongée en paliers si le trou est plus petit que la fraise, sinon hélice
		for (const h of pl.part.holes ?? []) {
			const [cx, cy] = applyMatrix(m, [h.x, h.y]);
			const hl = h.depth > 0 && h.depth < T ? levelsTo(h.depth) : depths;
			if (h.r <= r + 0.05) {
				g0(null, null, zSafe);
				g0(cx, cy);
				g0(null, null, zNear);
				for (const depth of hl) {
					g1(cx, cy, Z(depth), cam.plunge);
					g0(null, null, zNear);
				}
				g0(null, null, zSafe);
			} else {
				const rr = h.r - r;
				const seg = Math.max(12, Math.ceil((2 * Math.PI * rr) / 2));
				const circle = Array.from({ length: seg }, (_, k) => {
					const a = ((cam.climb ? 1 : -1) * 2 * Math.PI * k) / seg;
					return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
				});
				cutLoop(circle, false, hl);
			}
		}
		for (const k of pl.part.pockets ?? []) cutPocket(tf(k.poly), Math.min(k.depth, T));
		for (const q of pl.part.inner ?? []) cutLoop(orient(offsetPolygon(tf(q), -r), !cam.climb), false);
		cutLoop(orient(offsetPolygon(tf(pl.part.outline), r), cam.climb), true);
	}

	g0(null, null, zSafe);
	emit('M5');
	g0(0 - ox, 0 - oy);
	emit('M30');
	emit('%');
	const minutes = (len / Math.max(1, feed) + (rapid + zTravel) / 6000) * 1.05;
	return { text: lines.join('\r\n') + '\r\n', stats: { cutLength: len / 1000, minutes, passes, lines: lines.length, pocketSkipped } };
}
