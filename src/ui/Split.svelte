<script>
	// Deux panneaux séparés par une poignée (SlatShape, 2026-11-18 : « la disposition doit être
	// totalement modifiable, arranger mon espace comme je le souhaite »). Glisser la poignée =
	// redimensionner ; double-clic = taille d'origine ; ses boutons : agrandir un côté (l'autre se
	// replie), échanger les côtés. Retenu par navigateur (`storageKey`). Imbricable.
	import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowLeftRight, ArrowUpDown } from 'lucide-svelte';
	import { untrack } from 'svelte';
	import { tooltip } from '../tooltip.js';

	/**
	 * `dir` : 'row' (côte à côte) ou 'col' (l'un sous l'autre) ; `init` : part du premier (0..1).
	 * `solo` : le premier seul, en entier (le second n'est pas monté) ; le premier reste LE MÊME
	 * élément quand `solo` change (la vue 3D garde son canevas : studio vidéo, 2026-11-19).
	 * `storageKey` : clé du navigateur (null = rien retenu) ; `labels` : textes des infobulles.
	 */
	let {
		storageKey = null,
		dir = 'row',
		init = 0.6,
		min = 120,
		swappable = true,
		solo = false,
		labels = { drag: 'Drag to resize · double-click: original size', maxFar: 'Enlarge this side', maxNear: 'Enlarge the other side', restore: 'Restore', swap: 'Swap sides' },
		first,
		second
	} = $props();

	const KEY = untrack(() => storageKey);
	let f = $state(untrack(() => init));
	let max = $state(null); // null | 'a' | 'b' : un côté occupe tout
	let swap = $state(false);
	try {
		const s = KEY && typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem(KEY) || 'null') : null;
		if (s && s.f >= 0.05 && s.f <= 0.95) f = s.f;
		if (s?.max === 'a' || s?.max === 'b') max = s.max;
		if (typeof s?.swap === 'boolean') swap = s.swap;
	} catch {
		/* stockage bloqué */
	}
	function save() {
		if (!KEY) return;
		try {
			localStorage.setItem(KEY, JSON.stringify({ f, max, swap }));
		} catch {
			/* stockage bloqué */
		}
	}

	let box = $state(null);
	let drag = $state(false);
	const row = $derived(dir === 'row');
	function down(e) {
		if (e.target.closest('.gb')) return;
		e.preventDefault();
		drag = true;
		max = null;
		e.currentTarget.setPointerCapture(e.pointerId);
	}
	function move(e) {
		if (!drag || !box) return;
		const r = box.getBoundingClientRect();
		const size = row ? r.width : r.height;
		let p = row ? (e.clientX - r.left) / size : (e.clientY - r.top) / size;
		if (swap) p = 1 - p;
		const lo = Math.min(0.45, min / Math.max(1, size));
		f = Math.min(1 - lo, Math.max(lo, p));
	}
	function up() {
		if (!drag) return;
		drag = false;
		save();
	}
	function toggleMax(side) {
		max = max === side ? null : side;
		save();
	}
	function reset() {
		f = untrack(() => init);
		max = null;
		save();
	}
	// côté visuel (gauche / haut) → panneau 'a' ou 'b'
	const near = $derived(swap ? 'b' : 'a');
	const far = $derived(swap ? 'a' : 'b');
</script>

<div class="split" class:row class:col={!row} class:drag class:swap bind:this={box}>
	<div class="pane a" class:gone={!solo && max === 'b'} class:full={solo || max === 'a'} style:flex-basis={solo || max ? undefined : `${f * 100}%`}>
		{@render first()}
	</div>
	{#if !solo}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="gutter" class:edge={!!max} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} ondblclick={reset} use:tooltip={labels.drag}>
		<span class="grip"></span>
		<span class="gbs">
			<!-- agrandir le côté proche (gauche / haut), puis le côté lointain -->
			<button type="button" class="gb" class:on={max === far} aria-label={labels.maxFar} use:tooltip={max === far ? labels.restore : labels.maxFar} onclick={() => toggleMax(far)}>
				{#if row}<ChevronLeft size={11} />{:else}<ChevronUp size={11} />{/if}
			</button>
			{#if swappable}
				<button type="button" class="gb" aria-label={labels.swap} use:tooltip={labels.swap} onclick={() => ((swap = !swap), save())}>
					{#if row}<ArrowLeftRight size={11} />{:else}<ArrowUpDown size={11} />{/if}
				</button>
			{/if}
			<button type="button" class="gb" class:on={max === near} aria-label={labels.maxNear} use:tooltip={max === near ? labels.restore : labels.maxNear} onclick={() => toggleMax(near)}>
				{#if row}<ChevronRight size={11} />{:else}<ChevronDown size={11} />{/if}
			</button>
		</span>
	</div>
	<div class="pane b" class:gone={max === 'a'} class:full={max === 'b'}>
		{@render second()}
	</div>
	{/if}
</div>

<style>
	.split {
		display: flex;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
	}
	.split.row {
		flex-direction: row;
	}
	.split.col {
		flex-direction: column;
	}
	.split.drag {
		user-select: none;
		cursor: col-resize;
	}
	.split.col.drag {
		cursor: row-resize;
	}
	.pane {
		position: relative;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.pane.a {
		flex: 0 0 auto;
		order: 0;
	}
	.pane.b {
		flex: 1 1 0;
		order: 2;
	}
	.swap .pane.a {
		order: 2;
		flex: 0 0 auto;
	}
	.swap .pane.b {
		order: 0;
	}
	.pane.full {
		flex: 1 1 0 !important;
	}
	.pane.gone {
		display: none;
	}
	.gutter {
		position: relative;
		order: 1;
		flex: none;
		display: grid;
		place-items: center;
		touch-action: none;
		z-index: 3;
	}
	.row > .gutter {
		width: 8px;
		cursor: col-resize;
	}
	.col > .gutter {
		height: 8px;
		cursor: row-resize;
	}
	.grip {
		position: absolute;
		background: var(--kit-border);
		transition: background 0.12s ease;
	}
	.row > .gutter .grip {
		top: 0;
		bottom: 0;
		left: 3px;
		width: 2px;
	}
	.col > .gutter .grip {
		left: 0;
		right: 0;
		top: 3px;
		height: 2px;
	}
	.gutter:hover .grip,
	.drag > .gutter .grip {
		background: var(--kit-accent);
	}
	.gbs {
		position: relative;
		display: flex;
		gap: 2px;
		padding: 2px;
		border: 1px solid var(--kit-border-2);
		background: var(--kit-surface);
		border-radius: 6px;
		box-shadow: var(--kit-shadow);
		opacity: 0;
		transition: opacity 0.12s ease;
		pointer-events: none;
	}
	.row > .gutter .gbs {
		flex-direction: column;
	}
	.gutter:hover .gbs,
	.gutter.edge .gbs {
		opacity: 1;
		pointer-events: auto;
	}
	.gb {
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--kit-muted);
		border-radius: 3px;
		cursor: pointer;
	}
	.gb:hover {
		color: var(--kit-ink);
		background: var(--kit-surface-2);
	}
	.gb.on {
		color: var(--kit-accent);
	}
</style>
