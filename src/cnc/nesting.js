/**
 * Imbrication des pièces sur des plaques (MDF, contreplaqué…). Trois temps :
 *
 * 1. « Ligne d'horizon » (skyline) : les pièces sont couchées le long de la grande longueur
 *    de la plaque et empilées en travers. Chaque pièce est décrite par ses bords bas et haut
 *    échantillonnés (`lb`, `ub`) ; on essaie 4 variantes (telle quelle, miroir en long,
 *    retournée, tournée de 180°) et, si elle tient en travers, les mêmes DEBOUT (quart de
 *    tour), à plusieurs positions, et on garde celle qui gaspille le moins. Deux lamelles
 *    voisines ont des profils proches : l'une posée dos en bas, la suivante retournée, leurs
 *    fronts ondulés s'emboîtent.
 * 2. COMBLEMENT (demande du 2026-11-16 : « une lamelle seule sur une plaque alors qu'elle
 *    tient debout dans une autre », « le moins de perte possible ») : chaque plaque devient une
 *    grille d'occupation (5 mm) ; les pièces des DERNIÈRES plaques sont recasées dans les vides
 *    des précédentes (y compris sous la ligne d'horizon), dans 8 poses (4 quarts de tour ×
 *    miroir), au plus bas puis au plus à gauche. Une plaque vidée disparaît.
 * 3. Plusieurs essais (ordres, fenêtres) : on garde le moins de plaques, puis la dernière
 *    plaque la moins remplie (la chute la plus grande).
 *
 * Retourner une pièce est sans conséquence quand la matière a la même épaisseur partout et pas
 * de « bonne face » : une lamelle découpée « à l'envers » est la même lamelle vue de l'autre face.
 * Sinon, par pièce (ajout du kit, 2026-11-24, pour les marches de Blondel) :
 *  - `flip: false` : jamais de miroir (face finie, poches d'un seul côté) ;
 *  - `turn: false` : jamais de quart de tour (bois massif : le fil reste le long de la plaque,
 *    donc le x de la pièce le long du grand côté).
 *
 * Origine : SlatShape (`engine/nesting.js`), devenu le code du kit le 2026-11-24 ; plaques en
 * stock et chutes réutilisables portées depuis SlatShape le même jour (groupes de pièces d'un mur,
 * `designGroups` / `skippedParts`, restés dans SlatShape).
 *
 * 2026-11-24 :
 * 4. PLAQUES EN STOCK (« si on a en stock plusieurs plaques, on peut les lui donner ») : chaque
 *    plaque a SES dimensions ; les plaques du stock (`stock`, les plus petites d'abord) passent
 *    avant les neuves. Une plaque du stock où rien ne tient est laissée de côté. Le classement
 *    compte les plaques NEUVES (celles du stock sont déjà payées).
 * 5. CHUTES RÉUTILISABLES (`offcuts`, « une pièce à la verticale en plein milieu, la plaque est
 *    bonne à jeter ») : chaque plaque est re-posée en tassant ses pièces en bas ou à gauche
 *    (chaque pièce prend la pose qui monte le moins), et on garde la pose dont le PLUS GRAND
 *    RECTANGLE LIBRE (histogramme sur la grille d'occupation) est le plus grand. Chaque plaque
 *    porte sa chute (`offcut`).
 */
import { bbox, perimeter, signedArea } from './geometry.js';

// `stock` : plaques en stock [{ w, h, n, mat, t }] (matière / épaisseur vides = toutes) ; `useStock` :
// les utiliser ; `offcuts` : tasser les pièces pour garder des chutes réutilisables (2026-11-24)
export const SHEET_DEFAULTS = { width: 2440, height: 1220, margin: 10, spacing: 10, stock: [], useStock: true, offcuts: false };

/** Plus petit côté d'une chute utile (mm) : en dessous, c'est un déchet. */
export const MIN_OFFCUT = 150;

/** Stock validé (fichier, formulaire) : au plus 60 lignes, dimensions et quantités bornées. */
export function normStock(list) {
	if (!Array.isArray(list)) return [];
	const out = [];
	for (const e of list) {
		if (!e || typeof e !== 'object') continue;
		const w = Math.round(Number(e.w));
		const h = Math.round(Number(e.h));
		const n = Math.round(Number(e.n ?? 1));
		if (!(w >= 50 && w <= 10000 && h >= 50 && h <= 10000 && n >= 0 && n <= 999)) continue;
		const t = Number(e.t) > 0 && Number(e.t) <= 200 ? Math.round(Number(e.t) * 100) / 100 : 0;
		const mat = typeof e.mat === 'string' && e.mat.length <= 32 ? e.mat : '';
		out.push({ w, h, n, mat, t, ...(typeof e.note === 'string' && e.note ? { note: e.note.slice(0, 40) } : {}) });
		if (out.length >= 60) break;
	}
	return out;
}

/** Lignes du stock qui conviennent à un groupe (matière ET épaisseur, vides = toutes). */
export function stockMatches(e, material, thickness) {
	return (!e.mat || e.mat === material) && (!(e.t > 0) || Math.abs(e.t - thickness) < 0.05);
}

export const SHEET_PRESETS = [
	{ id: '2440x1220', label: '2440 × 1220', width: 2440, height: 1220 },
	{ id: '2500x1250', label: '2500 × 1250', width: 2500, height: 1250 },
	{ id: '2800x2070', label: '2800 × 2070', width: 2800, height: 2070 },
	{ id: '3050x1530', label: '3050 × 1530', width: 3050, height: 1530 }
];

/**
 * Bords bas / haut d'un contour, par tranches de `res` mm le long de x.
 * @param {number[][]} pts contour (x ≥ 0, y ≥ 0)
 * @param {number} len longueur de la pièce
 * @param {number} res
 */
export function profileBins(pts, len, res) {
	const n = Math.max(1, Math.ceil(len / res - 1e-9));
	const ub = new Float64Array(n).fill(-Infinity);
	const lb = new Float64Array(n).fill(Infinity);
	const put = (k, y) => {
		if (k < 0 || k >= n) return;
		if (y > ub[k]) ub[k] = y;
		if (y < lb[k]) lb[k] = y;
	};
	for (let i = 0; i < pts.length; i++) {
		const [x1, y1] = pts[i];
		const [x2, y2] = pts[(i + 1) % pts.length];
		const xa = Math.min(x1, x2);
		const xb = Math.max(x1, x2);
		const ka = Math.floor(xa / res);
		const kb = Math.min(n - 1, Math.floor(xb / res));
		for (let k = ka; k <= kb; k++) {
			// portion du segment dans la tranche [k*res, (k+1)*res]
			const ca = Math.max(xa, k * res);
			const cb = Math.min(xb, (k + 1) * res);
			if (cb < ca - 1e-9) continue;
			if (Math.abs(x2 - x1) < 1e-9) {
				put(k, y1);
				put(k, y2);
			} else {
				const ya = y1 + ((ca - x1) / (x2 - x1)) * (y2 - y1);
				const yb = y1 + ((cb - x1) / (x2 - x1)) * (y2 - y1);
				put(k, ya);
				put(k, yb);
			}
		}
	}
	for (let k = 0; k < n; k++) {
		if (ub[k] === -Infinity) {
			ub[k] = 0;
			lb[k] = 0;
		}
	}
	return { lb, ub };
}

/**
 * Les 4 poses d'une pièce, chacune avec ses bords recalculés sur le contour TRANSFORMÉ
 * (inverser simplement les tableaux décalerait les tranches quand la longueur n'est pas
 * un multiple de la résolution).
 */
function variants(outline, len, D, res, flip = true) {
	return (flip ? ['id', 'r180', 'my', 'mx'] : ['id', 'r180']).map((name) => {
		const m = placementMatrix(name, 0, 0, len, D);
		const pts = outline.map((p) => applyMatrix(m, p));
		const { lb, ub } = profileBins(pts, len, res);
		return { name, lb, ub };
	});
}

export function applyMatrix(m, [x, y]) {
	return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}

/** M ∘ B : applique B puis M. */
export function compose(M, B) {
	return {
		a: M.a * B.a + M.c * B.b,
		b: M.b * B.a + M.d * B.b,
		c: M.a * B.c + M.c * B.d,
		d: M.b * B.c + M.d * B.d,
		e: M.a * B.e + M.c * B.f + M.e,
		f: M.b * B.e + M.d * B.f + M.f
	};
}

/** Matrice pièce → plaque pour une variante posée en (X, Y). */
export function placementMatrix(name, X, Y, len, D) {
	switch (name) {
		case 'mx':
			return { a: -1, b: 0, c: 0, d: 1, e: X + len, f: Y };
		case 'my':
			return { a: 1, b: 0, c: 0, d: -1, e: X, f: Y + D };
		case 'r180':
			return { a: -1, b: 0, c: 0, d: -1, e: X + len, f: Y + D };
		default:
			return { a: 1, b: 0, c: 0, d: 1, e: X, f: Y };
	}
}

const translate = (x, y) => ({ a: 1, b: 0, c: 0, d: 1, e: x, f: y });

/** Aire nette d'une pièce (trous et contours intérieurs déduits). */
function netArea(part) {
	return Math.abs(signedArea(part.outline)) - (part.holes ?? []).reduce((a, h) => a + Math.PI * h.r * h.r, 0) - (part.inner ?? []).reduce((a, q) => a + Math.abs(signedArea(q)), 0);
}

// --- 1. ligne d'horizon -------------------------------------------------------------------

/**
 * Cadres d'une pièce pour le skyline : couchée (le long de la plaque) et, si elle tient en
 * travers, debout (quart de tour). Chaque cadre porte ses 4 variantes.
 */
function framesOf(part, usableL, usableW, res) {
	const b = bbox(part.outline);
	const frames = [];
	const add = (base, len, D) => {
		if (len > usableL + 1e-6 || D > usableW + 1e-6) return;
		const pts = part.outline.map((p) => applyMatrix(base, p));
		const vars = variants(pts, len, D, res, part.flip !== false);
		frames.push({ base, len, D, nbins: vars[0].lb.length, vars });
	};
	add({ a: 1, b: 0, c: 0, d: 1, e: -b.minX, f: -b.minY }, b.w, b.h);
	// debout (x' = maxY - y, y' = x - minX) : si elle ne tient pas couchée, ou si elle est
	// profonde (peu de rangées couchées : les lamelles d'un relief de 700 mm) ou courte. Pour
	// une lamelle ordinaire, la pose debout ne gagne rien et double le calcul ; le comblement
	// (étape 2) l'essaie de toute façon.
	if (part.turn !== false && (!frames.length || b.h > 0.28 * usableW || b.w <= 0.5 * usableW)) add({ a: 0, b: 1, c: -1, d: 0, e: b.maxY, f: -b.minX }, b.h, b.w);
	return frames;
}

/** Format d'une plaque : grande longueur, petite, marges ; `stock` = l'index de la ligne du stock. */
function specOf(w, h, sh, stock = -1) {
	return { long: Math.max(w, h), short: Math.min(w, h), margin: sh.margin, spacing: sh.spacing, stock };
}
const specKey = (sp) => `${sp.long}x${sp.short}`;

/**
 * Remplissage par ligne d'horizon. `prepared` : pièces préparées dans l'ordre d'essai ; `specs` :
 * plaques du stock à remplir d'abord (consommées une fois chacune), puis `std` à volonté.
 * @returns {{ sheets: { spec: any, placements: any[] }[], oversize: any[] }}
 */
function skyline(prepared, std, specs, opts) {
	const res = opts.res;
	const gap = Math.max(0, std.spacing);
	const gb = Math.ceil(gap / res);
	const lowW = opts.lowWeight ?? 0.1;
	const sheets = [];
	const oversize = [];
	// cadres d'une pièce par format de plaque (mémorisés)
	const framesFor = (pp, sp) => {
		const k = specKey(sp);
		pp.byFormat ??= new Map();
		if (!pp.byFormat.has(k)) pp.byFormat.set(k, framesOf(pp.part, sp.long - 2 * sp.margin, sp.short - 2 * sp.margin, res));
		return pp.byFormat.get(k);
	};
	const newSheet = (sp) => {
		const nb = Math.max(1, Math.floor((sp.long - 2 * sp.margin) / res));
		const sheet = { spec: sp, nb, usableW: sp.short - 2 * sp.margin, sky: new Float64Array(nb).fill(-gap), placements: [] };
		sheets.push(sheet);
		return sheet;
	};

	/**
	 * Meilleure pose d'une pièce sur une plaque. Score = part de VIDE perdu sous la pièce
	 * (entre la ligne d'horizon et son bord bas), plus une légère préférence pour le bas :
	 * c'est ce qui fait choisir une lamelle au profil complémentaire de la précédente.
	 */
	const tryPlace = (sheet, pp) => {
		let best = null;
		const { nb, usableW } = sheet;
		for (const fr of framesFor(pp, sheet.spec)) {
			if (fr.nbins > nb) continue;
			const maxIx = nb - fr.nbins;
			// au plus ~16 positions par pièce (pas d'au moins 25 mm) : au-delà, le gain est nul
			const step = Math.max(1, Math.round(25 / res), Math.ceil(maxIx / 16));
			const xs = [];
			for (let ix = 0; ix <= maxIx; ix += step) xs.push(ix);
			if (xs[xs.length - 1] !== maxIx) xs.push(maxIx);
			for (const v of fr.vars) {
				for (const ix of xs) {
					let base = -Infinity;
					for (let k = 0; k < fr.nbins; k++) {
						const req = sheet.sky[ix + k] + gap - v.lb[k];
						if (req > base) base = req;
					}
					const top = base + fr.D;
					if (top > usableW + 1e-6) continue;
					let waste = 0;
					for (let k = 0; k < fr.nbins; k++) waste += Math.max(0, base + v.lb[k] - sheet.sky[ix + k] - gap);
					waste *= res;
					const score = waste / (waste + pp.area) + lowW * (top / usableW) + ix * 1e-9;
					if (!best || score < best.score) best = { score, fr, v, ix, base };
				}
			}
		}
		return best;
	};

	const commit = (sheet, pp, best) => {
		const { fr, v, ix, base } = best;
		const { nb } = sheet;
		for (let k = -gb; k < fr.nbins + gb; k++) {
			const idx = ix + k;
			if (idx < 0 || idx >= nb) continue;
			let m = -Infinity;
			for (let j = Math.max(0, k - gb); j <= Math.min(fr.nbins - 1, k + gb); j++) if (v.ub[j] > m) m = v.ub[j];
			if (m === -Infinity) continue;
			const top = base + m;
			if (top > sheet.sky[idx]) sheet.sky[idx] = top;
		}
		const X = sheet.spec.margin + ix * res;
		const Y = sheet.spec.margin + base;
		const turned = fr.base.b !== 0;
		sheet.placements.push({ part: pp.part, variant: turned ? `q${v.name}` : v.name, X, Y, matrix: compose(placementMatrix(v.name, X, Y, fr.len, fr.D), fr.base) });
	};

	let remaining = [];
	for (const pp of prepared) {
		// trop grande pour TOUT format (neuf ou stock)
		if (!framesFor(pp, std).length && !specs.some((sp) => framesFor(pp, sp).length)) oversize.push(pp.part);
		else remaining.push(pp);
	}
	const queue = [...specs];
	let stdPhase = false;
	// plaque par plaque : à chaque pas, la pièce (parmi les prochaines) qui gaspille le moins
	while (remaining.length) {
		const fromStock = queue.length > 0;
		if (!fromStock && !stdPhase) {
			// fin du stock : ce qui ne tient pas sur une plaque neuve est trop grand
			stdPhase = true;
			const keep = [];
			for (const pp of remaining) {
				if (framesFor(pp, std).length) keep.push(pp);
				else oversize.push(pp.part);
			}
			remaining = keep;
			if (!remaining.length) break;
		}
		const sheet = newSheet(fromStock ? queue.shift() : std);
		for (;;) {
			let pick = null;
			// fenêtre des prochaines pièces (dans l'ordre) : les voisines ont des profils proches, la
			// complémentaire est presque toujours dedans. Chercher dans TOUTES coûtait N² (7 s pour
			// 130 lamelles) pour un gain de quelques pour cent. Sur une plaque du stock (petite), on
			// regarde plus loin : peu de pièces y tiennent.
			const win = Math.min(remaining.length, fromStock ? Math.max(opts.window ?? 16, 64) : (opts.window ?? 16));
			for (let i = 0; i < win; i++) {
				const b = tryPlace(sheet, remaining[i]);
				if (b && (!pick || b.score < pick.best.score)) pick = { i, best: b };
			}
			if (!pick) break;
			commit(sheet, remaining[pick.i], pick.best);
			remaining.splice(pick.i, 1);
		}
		if (!sheet.placements.length) {
			sheets.pop();
			if (fromStock) continue; // rien ne tient sur cette chute : on la laisse
			oversize.push(...remaining.map((pp) => pp.part));
			break;
		}
	}
	return { sheets: sheets.map((s) => ({ spec: s.spec, placements: s.placements })), oversize };
}

// --- 2. comblement sur grille d'occupation -----------------------------------------------------

/**
 * Plages occupées d'un contour, rangée par rangée de `r` mm : intervalles [a, b] (cellules,
 * bornes comprises) à trois hauteurs par rangée, réunis, élargis de `pad` cellules (et aux
 * rangées voisines). Prudent : une pièce ne mord jamais sur une cellule occupée.
 */
function rasterSpans(pts, r, pad) {
	const b = bbox(pts);
	const rows = Math.max(1, Math.ceil((b.maxY - b.minY) / r - 1e-9));
	const cols = Math.max(1, Math.ceil((b.maxX - b.minX) / r - 1e-9));
	const n = pts.length;
	// croisements des arêtes avec les lignes d'échantillonnage (3 par rangée), rangés par ligne :
	// O(points + croisements) au lieu de O(rangées × points)
	const F = [0.02, 0.5, 0.98];
	const lines = Array.from({ length: rows * 3 }, () => []);
	for (let i = 0; i < n; i++) {
		const [x1, y1] = pts[i];
		const [x2, y2] = pts[(i + 1) % n];
		if (y1 === y2) continue;
		const lo = Math.min(y1, y2) - b.minY;
		const hi = Math.max(y1, y2) - b.minY;
		for (let fi = 0; fi < 3; fi++) {
			// lignes y = (j + f) r avec lo < y ≤ hi (demi-ouvert : chaque sommet compté une fois)
			const j0 = Math.max(0, Math.floor(lo / r - F[fi]) + 1);
			const j1 = Math.min(rows - 1, Math.floor(hi / r - F[fi]));
			for (let j = j0; j <= j1; j++) {
				const y = (j + F[fi]) * r + b.minY;
				lines[j * 3 + fi].push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
			}
		}
	}
	const vert = Array.from({ length: rows }, () => []);
	for (const [x, y] of pts) {
		const j = Math.min(rows - 1, Math.max(0, Math.floor((y - b.minY) / r)));
		const c = Math.min(cols - 1, Math.max(0, Math.floor((x - b.minX) / r)));
		vert[j].push([c, c]);
	}
	const base = [];
	for (let j = 0; j < rows; j++) {
		const ivs = vert[j];
		for (let fi = 0; fi < 3; fi++) {
			const xs = lines[j * 3 + fi].sort((p, q) => p - q);
			for (let k = 0; k + 1 < xs.length; k += 2) ivs.push([Math.max(0, Math.floor((xs[k] - b.minX) / r)), Math.min(cols - 1, Math.floor((xs[k + 1] - b.minX) / r))]);
		}
		base.push(mergeIvs(ivs));
	}
	if (!pad) return { spans: base, rows, cols, pad: 0, minX: b.minX, minY: b.minY };
	const out = [];
	for (let j = -pad; j < rows + pad; j++) {
		const ivs = [];
		// repère élargi : la cellule 0 est `pad` cellules avant la pièce (cf. `minX` ci-dessous), donc
		// une plage [a, c] de la pièce devient [a, c + 2·pad] (avant le 2026-11-24 : [a − pad, c + pad],
		// décalée d'un `pad` : la pièce posée perdait son écart à DROITE et touchait sa voisine)
		for (let k = Math.max(0, j - pad); k <= Math.min(rows - 1, j + pad); k++) for (const [a, c] of base[k]) ivs.push([a, c + 2 * pad]);
		out.push(mergeIvs(ivs));
	}
	return { spans: out, rows: rows + 2 * pad, cols: cols + 2 * pad, pad, minX: b.minX - pad * r, minY: b.minY - pad * r };
}

function mergeIvs(ivs) {
	if (!ivs.length) return [];
	ivs.sort((p, q) => p[0] - q[0]);
	const out = [ivs[0].slice()];
	for (let i = 1; i < ivs.length; i++) {
		const last = out[out.length - 1];
		if (ivs[i][0] <= last[1] + 1) last[1] = Math.max(last[1], ivs[i][1]);
		else out.push(ivs[i].slice());
	}
	return out;
}

/** Grille d'une plaque : occupation et « prochaine cellule occupée » par rangée. */
function makeGrid(cols, rows) {
	const occ = Array.from({ length: rows }, () => new Uint8Array(cols));
	const next = Array.from({ length: rows }, () => new Int32Array(cols + 1).fill(cols));
	// plus longue suite de cellules libres de chaque rangée : écarte d'un coup les hauteurs où la
	// rangée la plus large de la pièce ne passe pas
	const run = new Int32Array(rows).fill(cols);
	return { cols, rows, occ, next, run, filled: 0 };
}

function refreshRow(g, y) {
	const o = g.occ[y];
	const n = g.next[y];
	n[g.cols] = g.cols;
	let best = 0;
	let cur = 0;
	for (let x = g.cols - 1; x >= 0; x--) {
		n[x] = o[x] ? x : n[x + 1];
		cur = o[x] ? 0 : cur + 1;
		if (cur > best) best = cur;
	}
	g.run[y] = best;
}

/** Marque des plages (repère de la grille, décalées de (ox, oy) cellules). */
function stamp(g, spans, ox, oy) {
	for (let j = 0; j < spans.length; j++) {
		const y = oy + j;
		if (y < 0 || y >= g.rows) continue;
		const o = g.occ[y];
		for (const [a, b] of spans[j]) for (let x = Math.max(0, ox + a); x <= Math.min(g.cols - 1, ox + b); x++) if (!o[x]) {
			o[x] = 1;
			g.filled++;
		}
		refreshRow(g, y);
	}
}

/**
 * Première position libre (au plus bas, puis au plus à gauche). Une collision dans une
 * rangée fait sauter directement après la cellule occupée trouvée. La marge d'écart (`pad`)
 * peut déborder de la grille (la plaque n'a pas de voisine), la pièce elle-même jamais.
 */
function findFit(g, cand) {
	const { spans, rows, cols, pad } = cand;
	if (rows - 2 * pad > g.rows || cols - 2 * pad > g.cols) return null;
	// rangées les plus larges d'abord : elles échouent le plus vite
	const widths = spans.map((s) => s.reduce((a, [p, q]) => Math.max(a, q - p + 1), 0));
	const order = widths.map((w, j) => [j, w]).filter(([, w]) => w > 0).sort((p, q) => q[1] - p[1]).map(([j]) => j);
	const jw = order[0] ?? 0;
	const need = Math.max(1, widths[jw] - 2 * pad);
	for (let y = -pad; y + rows - pad <= g.rows; y++) {
		const yw = y + jw;
		if (yw >= 0 && yw < g.rows && g.run[yw] < need) continue;
		let x = -pad;
		while (x + cols - pad <= g.cols) {
			// toutes les rangées : le saut retenu est le plus grand qu'elles imposent (chacune
			// interdit toute position avant sa première cellule occupée)
			let jump = 0;
			for (const j of order) {
				const yy = y + j;
				if (yy < 0 || yy >= g.rows) continue;
				const nx = g.next[yy];
				for (const [a, b] of spans[j]) {
					const lo = Math.max(0, x + a);
					const hi = Math.min(g.cols - 1, x + b);
					if (lo > hi) continue;
					const c = nx[lo];
					if (c <= hi) {
						if (c - a + 1 - x > jump) jump = c - a + 1 - x;
						break;
					}
				}
			}
			if (!jump) return { x, y };
			x += jump;
		}
	}
	return null;
}

/** Les 8 poses d'une pièce pour le comblement (4 quarts de tour × miroir), dédoublonnées. */
const POSES = [0, 1, 2, 3].flatMap((k) => [false, true].map((m) => ({ k, m })));
function poseMatrix({ k, m }) {
	const cos = [1, 0, -1, 0][k];
	const sin = [0, 1, 0, -1][k];
	const R = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
	return m ? compose(R, { a: -1, b: 0, c: 0, d: 1, e: 0, f: 0 }) : R;
}

/** Grille d'occupation d'une plaque déjà posée (pièces marquées telles quelles, sans écart). */
function gridOf(sheet, r) {
	const sp = sheet.spec;
	const g = makeGrid(Math.floor((sp.long - 2 * sp.margin) / r), Math.floor((sp.short - 2 * sp.margin) / r));
	for (const pl of sheet.placements) stampPlaced(g, pl, sp, r);
	return g;
}
function stampPlaced(g, pl, sp, r) {
	const pts = pl.part.outline.map((p) => applyMatrix(pl.matrix, p)).map(([x, y]) => [x - sp.margin, y - sp.margin]);
	const rs = rasterSpans(pts, r, 0);
	stamp(g, rs.spans, Math.floor(rs.minX / r), Math.floor(rs.minY / r));
}

/** Les poses (rastérisées, élargies de l'écart) d'une pièce, mémorisées par pièce et format. */
function poseCandidates(cache, part, usableL, usableW, r, pad) {
	const key = `${part.id}|${usableL}|${usableW}`;
	if (cache.has(key)) return cache.get(key);
	const seen = new Set();
	const list = [];
	const pb = bbox(part.outline);
	for (const pose of POSES) {
		if (part.turn === false && pose.k % 2) continue;
		if (part.flip === false && pose.m) continue;
		const [w, h] = pose.k % 2 ? [pb.h, pb.w] : [pb.w, pb.h];
		if (w > usableL + 1e-6 || h > usableW + 1e-6) continue;
		const M = poseMatrix(pose);
		const pts = part.outline.map((p) => applyMatrix(M, p));
		const rs = rasterSpans(pts, r, pad);
		const k2 = rs.spans.map((sx) => sx.map((iv) => iv.join(':')).join(',')).join('|');
		if (seen.has(k2)) continue;
		seen.add(k2);
		list.push({ ...rs, M });
	}
	cache.set(key, list);
	return list;
}

/**
 * Recase les pièces des dernières plaques dans les vides des précédentes.
 * @param {{ spec: any, placements: any[] }[]} sheets plaques (modifiées) ; seules les NEUVES (`spec.stock < 0`) se vident
 */
function backfill(sheets, opts) {
	const r = opts.gridRes ?? 5;
	const grids = sheets.map((sh) => gridOf(sh, r));
	const cache = new Map();
	const tryInto = (gi, part) => {
		const sp = sheets[gi].spec;
		const usableL = sp.long - 2 * sp.margin;
		const usableW = sp.short - 2 * sp.margin;
		const pad = Math.ceil(Math.max(0, sp.spacing) / r) + 1;
		let best = null;
		for (const c of poseCandidates(cache, part, usableL, usableW, r, pad)) {
			const f = findFit(grids[gi], c);
			if (f && (!best || f.y < best.f.y || (f.y === best.f.y && f.x < best.f.x))) best = { f, c };
		}
		if (!best) return null;
		const { f, c } = best;
		// coin bas-gauche de la cellule (x, y) = coin bas-gauche de la boîte élargie
		const X = sp.margin + f.x * r - c.minX;
		const Y = sp.margin + f.y * r - c.minY;
		// l'élargissement (pad) a servi à l'écart : on marque la pièce telle quelle
		const placed = { part, variant: `g${c.M.a}${c.M.b}${c.M.c}${c.M.d}`, X, Y, matrix: compose(translate(X, Y), c.M) };
		stampPlaced(grids[gi], placed, sp, r);
		return placed;
	};

	// des dernières plaques vers les premières, les plus grandes pièces d'abord
	const passes = opts.backfillSheets ?? 3;
	const deadline = performance.now() + (opts.backfillMs ?? 2500);
	for (let pass = 0; pass < passes && sheets.length > 1; pass++) {
		const last = sheets.length - 1;
		const moving = [...sheets[last].placements].sort((p, q) => netArea(q.part) - netArea(p.part));
		const kept = [];
		for (const pl of moving) {
			let moved = null;
			const need = netArea(pl.part);
			// plaques les plus vides d'abord : la place y est la plus probable
			const targets = [];
			for (let gi = 0; gi < last; gi++) {
				const free = (grids[gi].cols * grids[gi].rows - grids[gi].filled) * r * r;
				if (free >= need * 1.05) targets.push([gi, free]);
			}
			targets.sort((p, q) => q[1] - p[1]);
			for (const [gi] of targets) {
				if (performance.now() > deadline) break;
				moved = tryInto(gi, pl.part);
				if (moved) {
					sheets[gi].placements.push(moved);
					break;
				}
			}
			if (!moved) kept.push(pl);
		}
		if (!kept.length) {
			sheets.pop();
			grids.pop();
			continue;
		}
		if (kept.length === sheets[last].placements.length) break; // rien n'a bougé : inutile d'insister
		// la dernière plaque garde ses pièces restantes, recasées au plus bas - TOUTES ou aucune :
		// une pièce qui ne retrouvait pas de place gardait son ancienne position, où une autre
		// venait parfois d'être posée (chevauchement, constaté le 2026-11-24)
		const sp = sheets[last].spec;
		grids[last] = makeGrid(Math.floor((sp.long - 2 * sp.margin) / r), Math.floor((sp.short - 2 * sp.margin) / r));
		const again = [];
		for (const pl of [...kept].sort((p, q) => netArea(q.part) - netArea(p.part))) {
			const a = tryInto(last, pl.part);
			if (!a) break;
			again.push(a);
		}
		if (again.length === kept.length) sheets[last].placements = again;
		else {
			sheets[last].placements = kept;
			grids[last] = gridOf(sheets[last], r);
		}
		break;
	}
	return sheets;
}

// --- 2 bis. chutes réutilisables ------------------------------------------------------------------

/**
 * Plus grand rectangle libre d'une grille (histogramme par rangée, pile), côtés ≥ `minCells`.
 * @returns {{ x: number, y: number, w: number, h: number, area: number } | null} en cellules
 */
export function largestFree(g, minCells = 1) {
	const H = new Int32Array(g.cols);
	let best = null;
	const stack = new Int32Array(g.cols + 1);
	for (let y = 0; y < g.rows; y++) {
		const o = g.occ[y];
		for (let x = 0; x < g.cols; x++) H[x] = o[x] ? 0 : H[x] + 1;
		let top = 0;
		for (let x = 0; x <= g.cols; x++) {
			const h = x < g.cols ? H[x] : 0;
			while (top > 0 && H[stack[top - 1]] >= h) {
				const hh = H[stack[--top]];
				const left = top > 0 ? stack[top - 1] + 1 : 0;
				const w = x - left;
				if (hh >= minCells && w >= minCells && (!best || hh * w > best.area)) best = { x: left, y: y - hh + 1, w, h: hh, area: hh * w };
			}
			stack[top++] = x;
		}
	}
	return best;
}

const SWAP = { a: 0, b: 1, c: 1, d: 0, e: 0, f: 0 };

/**
 * Re-pose les pièces d'UNE plaque par la ligne d'horizon (elle garde l'emboîtement des profils,
 * qu'une grille de 5 mm perd) en tassant fort vers le bas : `transposed` = sur la plaque couchée
 * (les pièces s'empilent depuis la GAUCHE, la chute est à droite sur toute la hauteur).
 * @returns {any[] | null} placements, ou null si tout ne tient plus sur une plaque
 */
function repack(sheet, order, transposed) {
	const sp = sheet.spec;
	const v = transposed ? { ...sp, long: sp.short, short: sp.long } : sp;
	const prepared = order.map((pl) => ({ part: pl.part, area: netArea(pl.part) }));
	const run = skyline(prepared, v, [], { res: 4, window: prepared.length, lowWeight: 0.6 });
	if (run.sheets.length !== 1 || run.oversize.length) return null;
	const pls = run.sheets[0].placements;
	if (!transposed) return pls;
	// repère couché → plaque : échanger x et y (SWAP ∘ SWAP = identité)
	return pls.map((pl) => {
		const matrix = compose(SWAP, pl.matrix);
		return { part: pl.part, variant: `t${pl.variant}`, X: matrix.e, Y: matrix.f, matrix };
	});
}

/** Chute (plus grand rectangle libre, en mm sur la plaque, écart déduit) d'une plaque posée. */
export function offcutOf(sheet, r = 5) {
	const sp = sheet.spec;
	const g = gridOf(sheet, r);
	const m = largestFree(g, Math.ceil(MIN_OFFCUT / r));
	if (!m) return null;
	// la chute touche des pièces : on retire l'écart de coupe de ce côté-là (pas du côté du bord)
	const gap = Math.max(0, sp.spacing);
	let x = sp.margin + m.x * r;
	let y = sp.margin + m.y * r;
	let w = m.w * r;
	let h = m.h * r;
	if (m.x > 0) ((x += gap), (w -= gap));
	if (m.x + m.w < g.cols) w -= gap;
	if (m.y > 0) ((y += gap), (h -= gap));
	if (m.y + m.h < g.rows) h -= gap;
	// bord de plaque : la chute va jusqu'au bord (la marge n'est pas perdue pour une chute)
	if (m.x === 0) ((w += x), (x = 0));
	if (m.x + m.w >= g.cols) w = sp.long - x;
	if (m.y === 0) ((h += y), (y = 0));
	if (m.y + m.h >= g.rows) h = sp.short - y;
	return w >= MIN_OFFCUT && h >= MIN_OFFCUT ? { x, y, w: Math.floor(w), h: Math.floor(h) } : null;
}

/**
 * Pour chaque plaque, garde la pose (actuelle, tassée en bas ou à gauche, deux ordres) dont la
 * chute est la plus grande. Ne change jamais le nombre de plaques ni le contenu d'une plaque.
 */
function keepOffcuts(sheets, opts) {
	const r = opts.gridRes ?? 5;
	const deadline = performance.now() + (opts.offcutMs ?? 1500);
	const areaOf = (sh) => {
		const o = offcutOf(sh, r);
		return o ? o.w * o.h : 0;
	};
	const fill = (sh) => sh.placements.reduce((a, pl) => a + netArea(pl.part), 0) / (sh.spec.long * sh.spec.short);
	// la DERNIÈRE plaque d'abord (c'est elle qui garde une vraie chute), puis les moins remplies ;
	// une plaque presque pleine n'a rien à gagner
	const order = sheets.map((sh, i) => ({ sh, i, f: fill(sh) })).filter((o) => o.f < 0.85);
	order.sort((a, b) => (b.i === sheets.length - 1) - (a.i === sheets.length - 1) || a.f - b.f);
	for (const { sh: sheet } of order) {
		if (performance.now() > deadline) break;
		let bestArea = areaOf(sheet);
		let best = null;
		const lenOf = (pl) => {
			const b = bbox(pl.part.outline);
			return Math.max(b.w, b.h);
		};
		const asIs = sheet.placements;
		const byLen = [...asIs].sort((p, q) => lenOf(q) - lenOf(p) || netArea(q.part) - netArea(p.part));
		const bySize = [...asIs].sort((p, q) => netArea(q.part) - netArea(p.part));
		// la plaque couchée échange x et y : un MIROIR et un quart de tour ; interdit si une pièce
		// a une bonne face (`flip: false`) ou un fil à respecter (`turn: false`)
		const canTranspose = asIs.every((pl) => pl.part.flip !== false && pl.part.turn !== false);
		for (const transposed of canTranspose ? [false, true] : [false]) {
			for (const ord of [asIs, byLen, bySize]) {
				const pls = repack(sheet, ord, transposed);
				if (!pls) continue;
				const a = areaOf({ spec: sheet.spec, placements: pls });
				if (a > bestArea * 1.02) {
					bestArea = a;
					best = pls;
				}
			}
		}
		if (best) sheet.placements = best;
	}
	return sheets;
}

// --- 3. essais, bilan ------------------------------------------------------------------------

/** Plaques du stock d'un réglage, une par exemplaire, en gardant l'index de la ligne. */
function stockSpecs(s0) {
	if (s0.useStock === false || !Array.isArray(s0.stock)) return [];
	const specs = [];
	s0.stock.forEach((e, i) => {
		const v = normStock([e])[0];
		if (v) for (let k = 0; k < v.n; k++) specs.push(specOf(v.w, v.h, s0, i));
	});
	// les plus petites d'abord : on vide les chutes
	return specs.sort((a, b) => a.long * a.short - b.long * b.short);
}

/**
 * @param {{ id: string, kind: string, outline: number[][], holes: {x:number,y:number,r:number}[], inner?: number[][][], label?: any }[]} parts
 * @param {Partial<typeof SHEET_DEFAULTS>} sheetParams
 * @param {{ res?: number, window?: number, tries?: number, backfill?: boolean, gridRes?: number }} [opts]
 */
export function nest(parts, sheetParams, opts = {}) {
	const s0 = { ...SHEET_DEFAULTS, ...sheetParams };
	const std = specOf(s0.width, s0.height, s0);
	const specs = stockSpecs(s0);
	const res = opts.res ?? 4;
	const prepared = parts.map((part) => ({ part, area: netArea(part) }));
	const lenOf = (pp) => {
		const b = bbox(pp.part.outline);
		return Math.max(b.w, b.h);
	};
	// essais : ordre du design (voisines = profils proches), puis les plus longues d'abord
	const orders = [prepared];
	if ((opts.tries ?? 2) > 1 && parts.length <= 400) {
		const byLen = [...prepared].sort((a, b) => lenOf(b) - lenOf(a) || b.area - a.area);
		orders.push(byLen);
	}
	const windows = (opts.tries ?? 2) > 2 && parts.length <= 200 ? [opts.window ?? 16, 40] : [opts.window ?? 16];
	// budget : les essais suivants ne partent que s'il reste du temps (la page relance
	// l'imbrication à chaque réglage)
	const t0 = performance.now();
	const budget = opts.budgetMs ?? 2500;
	let best = null;
	for (const order of orders) {
		for (const window of windows) {
			if (best && performance.now() - t0 > budget * 0.45) break;
			const run = skyline(order, std, specs, { ...opts, res, window });
			const score0 = rank(run.sheets);
			// le comblement ne sert qu'à l'essai le plus prometteur (autant de plaques neuves ou moins)
			if (opts.backfill !== false && run.sheets.length > 1 && (!best || newCount(run.sheets) <= newCount(best.sheets))) backfill(run.sheets, { ...opts, backfillMs: Math.max(300, budget - (performance.now() - t0)) });
			const score = Math.min(score0, rank(run.sheets));
			if (!best || score < best.score) best = { ...run, score };
		}
	}
	if (s0.offcuts) keepOffcuts(best.sheets, opts);
	return summarize(best.sheets, best.oversize, std);
}

const newCount = (sheets) => sheets.filter((sh) => sh.spec.stock < 0).length;

/**
 * Moins de plaques NEUVES d'abord (celles du stock sont déjà là), puis la dernière plaque neuve la
 * moins remplie (la plus grande chute), puis le moins de plaques du stock entamées.
 */
function rank(sheets) {
	if (!sheets.length) return 0;
	const fresh = sheets.filter((sh) => sh.spec.stock < 0);
	const last = fresh[fresh.length - 1];
	const fill = last ? last.placements.reduce((a, pl) => a + netArea(pl.part), 0) / (last.spec.long * last.spec.short) : 0;
	return fresh.length + fill * 0.99 + (sheets.length - fresh.length) * 1e-4;
}

function summarize(sheetList, oversize, std) {
	const sheets = sheetList.map(({ spec, placements }, index) => {
		let area = 0;
		let cut = 0;
		let used = 0;
		for (const pl of placements) {
			const inner = pl.part.inner ?? [];
			area += netArea(pl.part);
			cut += perimeter(pl.part.outline) + (pl.part.holes ?? []).reduce((a, h) => a + 2 * Math.PI * h.r, 0) + inner.reduce((a, q) => a + perimeter(q), 0);
			for (const p of pl.part.outline) used = Math.max(used, applyMatrix(pl.matrix, p)[1]);
		}
		return {
			index,
			width: spec.long,
			height: spec.short,
			placements,
			// plaque du stock : index de sa ligne dans `sheet.stock` ; neuve : null
			stock: spec.stock >= 0 ? spec.stock : null,
			utilization: area / (spec.long * spec.short),
			cutLength: cut / 1000,
			usedHeight: Math.max(0, used - spec.margin) + spec.margin,
			// plus grande chute réutilisable (mm, sur la plaque), null si rien d'utile
			offcut: offcutOf({ spec, placements })
		};
	});
	return { sheets, oversize, sheet: { width: std.long, height: std.short, margin: std.margin, spacing: std.spacing } };
}

/**
 * Imbrication par GROUPE de matière / épaisseur (fixations dans une autre matière, demande du
 * 2026-11-16) : chaque groupe a ses plaques. `sheets` = toutes les plaques, numérotées à la
 * suite, chacune avec son `group`. Le stock est partagé : une plaque prise par un groupe ne
 * sert plus aux suivants ; une ligne ne sert qu'aux groupes de sa matière / épaisseur.
 * @param {{ key: string, material: string, thickness: number, parts: any[], sheet?: object }[]} groups
 */
export function nestGroups(groups, sheetParams, opts = {}) {
	const s0 = { ...SHEET_DEFAULTS, ...sheetParams };
	const raw = s0.useStock === false || !Array.isArray(s0.stock) ? [] : s0.stock;
	const left = raw.map((e) => normStock([e])[0]?.n ?? 0);
	const out = [];
	const sheets = [];
	const oversize = [];
	for (const g of groups) {
		if (!g.parts.length) continue;
		const base = g.sheet ?? s0;
		const mine = raw.map((e, i) => {
			const v = normStock([e])[0];
			return v && stockMatches(v, g.material, g.thickness) ? { ...v, n: left[i] } : { w: 0, h: 0, n: 0 };
		});
		const r = nest(g.parts, { ...base, stock: mine, useStock: true }, opts);
		const first = sheets.length;
		for (const s of r.sheets) {
			if (s.stock != null) left[s.stock]--;
			sheets.push({ ...s, index: sheets.length, group: g.key });
		}
		oversize.push(...r.oversize);
		out.push({ key: g.key, material: g.material, thickness: g.thickness, kinds: g.kinds, first, count: r.sheets.length, fresh: r.sheets.filter((s) => s.stock == null).length, oversize: r.oversize, sheet: r.sheet });
	}
	const stockUsed = raw.map((e, i) => (normStock([e])[0]?.n ?? 0) - left[i]);
	return { sheets, oversize, groups: out, stockUsed, sheet: out[0]?.sheet ?? { ...SHEET_DEFAULTS, ...sheetParams } };
}

/**
 * Pièces RETIRÉES des plaques (2026-11-18 : « pouvoir retirer des pièces si on ne veut pas les
 * découper ») : `skip` = ids (`C1`, `L12`…) ou familles (`kind:cale`, `kind:batten`…).
 * @returns {(part: { id: string, kind: string }) => boolean}
 */
export function skipTest(skip) {
	const ids = new Set();
	const kinds = new Set();
	for (const x of Array.isArray(skip) ? skip : []) {
		if (typeof x !== 'string') continue;
		if (x.startsWith('kind:')) kinds.add(x.slice(5));
		else ids.add(x);
	}
	return (p) => ids.has(p.id) || kinds.has(p.kind);
}
