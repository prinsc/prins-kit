/**
 * Lecture d'un G-code du kit (`gcode.js` : `.tap`, G0 / G1, en-tête commenté) pour la simulation
 * d'usinage. Pur (testé contre le générateur) : aucun calcul de trajectoire ici, le navigateur
 * ne fait que relire le fichier exact (SlatShape : reçu du serveur).
 */
export const RAPID = 6000; // mm/min, déplacements rapides (estimation)
export const PASS_COLORS = ['#ffd166', '#f4a261', '#e76f51', '#d1495b', '#9c4dcc', '#5c6bc0', '#26a69a', '#8bc34a'];

/** G-code → programme : mouvements chronométrés, infos d'en-tête, passes. */
export function parseGcode(text) {
	const lines = text.split(/\r?\n/);
	const info = { w: 2440, h: 1220, t: 18, tool: 6, passes: 1, passDepth: 18, center: false, bed: false };
	for (const l of lines.slice(0, 16)) {
		let m;
		if ((m = /Plaque ([\d.]+) x ([\d.]+) mm - .*?([\d.]+) mm\)/.exec(l))) [info.w, info.h, info.t] = [+m[1], +m[2], +m[3]];
		if ((m = /Fraise D([\d.]+)/.exec(l))) info.tool = +m[1];
		if ((m = /(\d+) passes de ([\d.]+) mm/.exec(l))) [info.passes, info.passDepth] = [+m[1], +m[2]];
		if (/centre de la plaque/.test(l)) info.center = true;
		if (/dessus du martyr/.test(l)) info.bed = true;
	}
	const top = info.bed ? info.t : 0; // Z du dessus de la plaque
	const moves = [];
	let x = 0;
	let y = 0;
	let z = null;
	let f = 1000;
	let mode = 0;
	let t = 0;
	let cut = 0;
	let rapid = 0;
	for (let i = 0; i < lines.length; i++) {
		const l = lines[i].replace(/\(.*?\)/g, '').replace(/;.*$/, '').trim().toUpperCase();
		if (!l) continue;
		const words = l.match(/[A-Z][+-]?\d*\.?\d+/g);
		if (!words) continue;
		let nx = x;
		let ny = y;
		let nz = z;
		let has = false;
		for (const w of words) {
			const c = w[0];
			const v = parseFloat(w.slice(1));
			if (c === 'G' && (v === 0 || v === 1)) mode = v;
			else if (c === 'X') [nx, has] = [v, true];
			else if (c === 'Y') [ny, has] = [v, true];
			else if (c === 'Z') [nz, has] = [v, true];
			else if (c === 'F') f = v;
		}
		if (!has) continue;
		if (z === null) {
			// premier mouvement : la position de départ
			[x, y, z] = [nx, ny, nz ?? top + 10];
			continue;
		}
		const len = Math.hypot(nx - x, ny - y, nz - z);
		if (len < 1e-9) continue;
		const speed = mode === 0 ? RAPID : Math.max(1, f);
		const dt = (len / speed) * 60;
		const depth = top - Math.min(z, nz);
		const layer = mode === 0 || depth <= 1e-3 ? 0 : Math.max(1, Math.min(info.passes, Math.ceil(depth / Math.max(0.1, info.passDepth) - 1e-3)));
		moves.push({ x0: x, y0: y, z0: z, x1: nx, y1: ny, z1: nz, rapid: mode === 0, f: speed, line: i, t0: t, t1: t + dt, len, layer });
		if (mode === 0) rapid += len;
		else cut += len;
		t += dt;
		[x, y, z] = [nx, ny, nz];
	}
	return { info, top, moves, lines, duration: t, cut, rapid };
}

