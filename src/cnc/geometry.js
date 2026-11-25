/**
 * Outils géométriques 2D (mm). Origine : SlatShape (`engine/geometry.js`), code du kit depuis
 * le 2026-11-24. Un point = [x, y]. Polygones fermés implicites
 * (le dernier point n'est pas répété), sens anti-horaire pour l'extérieur d'une pièce.
 */

/** Aire signée (positive = anti-horaire). */
export function signedArea(pts) {
	let a = 0;
	for (let i = 0, n = pts.length; i < n; i++) {
		const [x1, y1] = pts[i];
		const [x2, y2] = pts[(i + 1) % n];
		a += x1 * y2 - x2 * y1;
	}
	return a / 2;
}

export function perimeter(pts) {
	let l = 0;
	for (let i = 0, n = pts.length; i < n; i++) {
		const [x1, y1] = pts[i];
		const [x2, y2] = pts[(i + 1) % n];
		l += Math.hypot(x2 - x1, y2 - y1);
	}
	return l;
}

export function bbox(pts) {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const [x, y] of pts) {
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}
	return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/**
 * Ramer-Douglas-Peucker sur une polyligne ouverte (les extrémités sont gardées).
 * Itératif : un profil de 3 000 points ne fait pas déborder la pile.
 * @param {number[][]} pts
 * @param {number} eps tolérance (mm)
 */
export function simplify(pts, eps) {
	if (pts.length < 3 || !(eps > 0)) return pts.slice();
	const keep = new Uint8Array(pts.length);
	keep[0] = 1;
	keep[pts.length - 1] = 1;
	const stack = [[0, pts.length - 1]];
	while (stack.length) {
		const [a, b] = stack.pop();
		const [ax, ay] = pts[a];
		const [bx, by] = pts[b];
		const dx = bx - ax;
		const dy = by - ay;
		const len = Math.hypot(dx, dy) || 1e-12;
		let maxD = -1;
		let idx = -1;
		for (let i = a + 1; i < b; i++) {
			const [px, py] = pts[i];
			const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
			if (d > maxD) {
				maxD = d;
				idx = i;
			}
		}
		if (maxD > eps && idx > 0) {
			keep[idx] = 1;
			stack.push([a, idx], [idx, b]);
		}
	}
	return pts.filter((_, i) => keep[i]);
}

/**
 * Fermeture morphologique d'un profil z(u) par un disque de rayon r (la fraise) :
 * ce qui reste de la matière quand l'outil, qui passe DEVANT le profil, ne peut pas
 * descendre dans un creux plus étroit que lui. Dilatation puis érosion par demi-disque.
 * @param {Float64Array | number[]} z valeurs régulièrement espacées
 * @param {number} step pas entre deux valeurs (mm)
 * @param {number} r rayon de l'outil (mm)
 */
export function closeProfile(z, step, r) {
	const n = z.length;
	if (!(r > 0) || n < 3) return Float64Array.from(z);
	const k = Math.max(1, Math.ceil(r / step));
	const off = new Float64Array(2 * k + 1);
	for (let j = -k; j <= k; j++) {
		const s = j * step;
		off[j + k] = s * s <= r * r ? Math.sqrt(r * r - s * s) : -Infinity;
	}
	const dil = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		let m = -Infinity;
		for (let j = -k; j <= k; j++) {
			const o = off[j + k];
			if (o === -Infinity) continue;
			const ii = Math.min(n - 1, Math.max(0, i + j));
			const v = z[ii] + o;
			if (v > m) m = v;
		}
		dil[i] = m;
	}
	const out = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		let m = Infinity;
		for (let j = -k; j <= k; j++) {
			const o = off[j + k];
			if (o === -Infinity) continue;
			const ii = Math.min(n - 1, Math.max(0, i + j));
			const v = dil[ii] - o;
			if (v < m) m = v;
		}
		// la fermeture n'enlève jamais de matière : elle ne fait que combler
		out[i] = Math.max(z[i], m);
	}
	return out;
}

/**
 * Remplace un coin RENTRANT (concave) d'un contour anti-horaire par un « os de chien » :
 * un arc du rayon de la fraise qui passe par le coin, pour qu'une pièce emboîtée
 * descende jusqu'au fond de l'encoche malgré le rayon laissé par l'outil.
 * @param {number[]} prev point précédent
 * @param {number[]} v coin
 * @param {number[]} next point suivant
 * @param {number} r rayon de l'outil
 * @param {number} [segments] subdivisions de l'arc
 * @returns {number[][]} points qui remplacent `v`
 */
export function dogbone(prev, v, next, r, segments = 10) {
	if (!(r > 0)) return [v];
	const ax = v[0] - prev[0];
	const ay = v[1] - prev[1];
	const bx = next[0] - v[0];
	const by = next[1] - v[1];
	const la = Math.hypot(ax, ay);
	const lb = Math.hypot(bx, by);
	if (la < 1e-9 || lb < 1e-9) return [v];
	const a = [ax / la, ay / la];
	const b = [bx / lb, by / lb];
	// coin rentrant d'un contour anti-horaire = virage à droite
	if (a[0] * b[1] - a[1] * b[0] > -1e-9) return [v];
	// bissectrice vers l'extérieur de la matière (côté droit des deux arêtes)
	let nx = a[1] + b[1];
	let ny = -a[0] - b[0];
	const nl = Math.hypot(nx, ny);
	if (nl < 1e-9) return [v];
	nx /= nl;
	ny /= nl;
	const cx = v[0] + r * nx;
	const cy = v[1] + r * ny;
	const ta = -2 * r * (a[0] * nx + a[1] * ny);
	const tb = 2 * r * (b[0] * nx + b[1] * ny);
	// l'arc ne doit pas dépasser les arêtes voisines
	if (ta <= 0 || tb <= 0 || ta > la + 1e-6 || tb > lb + 1e-6) return [v];
	const A = [v[0] - ta * a[0], v[1] - ta * a[1]];
	const B = [v[0] + tb * b[0], v[1] + tb * b[1]];
	const thA = Math.atan2(A[1] - cy, A[0] - cx);
	const thB = Math.atan2(B[1] - cy, B[0] - cx);
	const thV = Math.atan2(v[1] - cy, v[0] - cx);
	const TAU = Math.PI * 2;
	const mod = (x) => ((x % TAU) + TAU) % TAU;
	const ccw = mod(thB - thA);
	let sweep = mod(thV - thA) < ccw ? ccw : ccw - TAU;
	const pts = [A];
	for (let i = 1; i < segments; i++) {
		const th = thA + (sweep * i) / segments;
		pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
	}
	pts.push(B);
	return pts;
}

/** Applique une transformation affine { a, b, c, d, e, f } : x' = a x + c y + e, y' = b x + d y + f. */
export function transformPoint(m, [x, y]) {
	return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}

export function transformPoints(m, pts) {
	return pts.map((p) => transformPoint(m, p));
}

/** Retire les points consécutifs confondus. */
export function dedupe(pts, eps = 1e-6) {
	const out = [];
	for (const p of pts) {
		const q = out[out.length - 1];
		if (!q || Math.abs(q[0] - p[0]) > eps || Math.abs(q[1] - p[1]) > eps) out.push(p);
	}
	if (out.length > 1) {
		const f = out[0];
		const l = out[out.length - 1];
		if (Math.abs(f[0] - l[0]) <= eps && Math.abs(f[1] - l[1]) <= eps) out.pop();
	}
	return out;
}
