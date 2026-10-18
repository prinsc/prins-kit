// Action Svelte `use:tooltip={'texte'}` : infobulle stylée au survol.
// Fusion des deux copies qui vivaient dans Blondel (`tip`) et Gen-Schema (`tooltip`) : base
// Blondel, la plus robuste (élément recréé s'il a été détaché, rien au toucher - le doigt n'a
// pas de survol). Placement auto : au-dessus, ou en dessous si la place manque ; borné à
// l'écran. Styles : `.kit-tooltip` dans studio.css.
let el;

function ensure(node) {
	if (!el || !el.isConnected) {
		el = document.createElement('div');
		el.className = 'kit-tooltip';
		(node.closest('.kit-root') ?? document.body).appendChild(el);
	}
	return el;
}

export function tooltip(node, text) {
	let cur = text;
	function show(e) {
		if (!cur || e?.pointerType === 'touch') return;
		const t = ensure(node);
		t.textContent = cur;
		t.style.opacity = '1'; // rendu visible → mesurable
		const r = node.getBoundingClientRect();
		const M = 8;
		const half = t.offsetWidth / 2;
		const below = r.top - t.offsetHeight - 10 < M;
		t.classList.toggle('below', below);
		// centre horizontal borné pour ne jamais sortir de l'écran (transform: translateX(-50%))
		const cx = Math.max(M + half, Math.min(r.left + r.width / 2, window.innerWidth - M - half));
		t.style.left = `${cx}px`;
		t.style.top = below ? `${r.bottom + 8}px` : `${r.top - 8}px`;
	}
	function hide() {
		if (el) el.style.opacity = '0';
	}
	node.addEventListener('pointerenter', show);
	node.addEventListener('pointerleave', hide);
	node.addEventListener('pointerdown', hide);
	return {
		update(t) {
			cur = t;
			if (el && el.style.opacity === '1') el.textContent = t;
		},
		destroy() {
			hide();
			node.removeEventListener('pointerenter', show);
			node.removeEventListener('pointerleave', hide);
			node.removeEventListener('pointerdown', hide);
		}
	};
}
