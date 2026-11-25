<script>
	// Champ numérique compact des outils kltk (Blondel, puis SlatShape, puis le kit) : on « gratte »
	// la valeur au glissé horizontal (sur le libellé ou la poignée ‹›), Maj ×10, Alt ×0,1, flèches ↑↓.
	// Le trait DANS le champ situe la valeur dans sa PLAGE CONSEILLÉE (`min`…`max`) ; on peut en
	// sortir jusqu'aux bornes dures `hardMin`/`hardMax` : point orange au bout concerné.
	// `def` : valeur par défaut, une petite flèche ↺ y ramène quand la valeur en diffère.
	// `compact` : libellé court collé au champ ; `mixed` : plusieurs valeurs derrière (« mixte »).
	// Gratter alors que le texte est sélectionné : le champ lâche le focus, la valeur suit en direct.
	//
	// L'outil fournit ce qui lui est propre : `format(v)` / `parse(texte)` (unités, pouces…),
	// `texts` (infobulles traduites), snippets `help` (bulle « ? ») et `eye` (voir dans la 3D),
	// `eyeColor` (couleur de l'œil allumé), `onscrub(actif)` (le grattage commence / finit).
	import { RotateCcw } from 'lucide-svelte';
	let {
		label,
		value = $bindable(),
		suffix = '',
		min = 0,
		max = 100000,
		hardMin = undefined,
		hardMax = undefined,
		step = 1,
		decimals = 0,
		hint = '',
		title = '',
		def = undefined,
		disabled = false,
		compact = false,
		mixed = false,
		locale = undefined,
		format = null,
		parse = null,
		texts = {},
		eyeColor = null,
		help = undefined,
		eye = undefined,
		onchange = () => {},
		onscrub = () => {}
	} = $props();

	let focused = $state(false);
	let text = $state('');
	let inputEl = $state(null);
	const lo = $derived(hardMin ?? min);
	const hi = $derived(hardMax ?? max);
	const fmt = (v) => (format ? format(v) : Number.isFinite(v) ? v.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false }) : '');
	const shown = $derived(fmt(value));
	$effect(() => {
		if (!focused || scrubbing) text = mixed && !scrubbing ? '' : shown;
	});
	const clamp = (v) => Math.min(hi, Math.max(lo, v));
	const round = (v) => {
		const k = 10 ** decimals;
		return Math.round(v * k) / k;
	};

	function commit(v) {
		if (v == null || !Number.isFinite(v)) return;
		const next = clamp(round(v));
		if (next !== value) {
			value = next;
			onchange(next);
		}
	}

	function read(str) {
		if (parse) return parse(str);
		const v = Number(String(str).replace(/\s/g, '').replace(',', '.').replace(/[^0-9.+-]/g, ''));
		return Number.isFinite(v) && String(str).trim() !== '' ? v : null;
	}

	function onInput(e) {
		text = e.currentTarget.value;
		const v = read(text);
		if (v != null && v >= lo && v <= hi) commit(v);
	}

	function onKey(e) {
		if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			e.preventDefault();
			const k = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
			commit((value ?? 0) + k * step);
			text = shown;
		} else if (e.key === 'Enter') {
			e.currentTarget.blur();
		}
	}

	let scrub = null;
	let scrubbing = $state(false);
	function scrubStart(e) {
		if (disabled || e.button !== 0) return;
		scrub = { x: e.clientX, v: value, moved: false };
		e.currentTarget.setPointerCapture(e.pointerId);
	}
	function scrubMove(e) {
		if (!scrub) return;
		const dx = e.clientX - scrub.x;
		if (Math.abs(dx) > 2 && !scrub.moved) {
			scrub.moved = scrubbing = true;
			onscrub(true);
			// texte sélectionné (souvent sans le vouloir) : on lâche le champ, la valeur s'affiche en direct
			if (inputEl && document.activeElement === inputEl) inputEl.blur();
		}
		if (!scrub.moved) return;
		const k = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
		commit(scrub.v + Math.round(dx / 4) * step * k);
	}
	function scrubEnd() {
		if (scrub?.moved) onscrub(false);
		scrubbing = false;
		scrub = null;
	}
	const ranged = $derived(Number.isFinite(min) && Number.isFinite(max) && max > min && max - min < 1e6);
	const ratio = $derived(ranged ? Math.min(1, Math.max(0, (value - min) / (max - min))) : null);
	const low = $derived(ranged && Number.isFinite(value) && value < min - 1e-9);
	const high = $derived(ranged && Number.isFinite(value) && value > max + 1e-9);
	const outside = $derived(low || high);
	const rangeTip = $derived(ranged && texts.range ? texts.range(fmt(min), fmt(max), suffix) : '');
	const canReset = $derived(typeof def === 'number' && Number.isFinite(def) && Number.isFinite(value) && Math.abs(value - def) > 1e-9 && !disabled);
	const resetTip = $derived(canReset ? (texts.reset ? texts.reset(`${fmt(def)} ${suffix}`.trim()) : `↺ ${fmt(def)} ${suffix}`.trim()) : '');
	function reset() {
		commit(def);
		text = shown;
	}
</script>

<div class="nf" class:compact class:mixed class:disabled class:scrubbing class:outside class:with-eye={!!eye} class:eyed={!!eyeColor} style:--eye={eyeColor} title={[title || hint, rangeTip].filter(Boolean).join(' · ') || undefined}>
	<span
		class="lbl"
		role="slider"
		tabindex="-1"
		aria-valuenow={value}
		aria-label={label}
		onpointerdown={scrubStart}
		onpointermove={scrubMove}
		onpointerup={scrubEnd}
		onpointercancel={scrubEnd}
	>
		<span class="name">{label}{#if help}{@render help()}{/if}</span>
		{#if hint}<span class="hint">{hint}</span>{/if}
	</span>
	<label class="box">
		{#if canReset}
			<button type="button" class="rst" aria-label={resetTip} title={resetTip} onpointerdown={(e) => e.stopPropagation()} onclick={(e) => (e.preventDefault(), reset())}><RotateCcw size={10} /></button>
		{/if}
		<span
			class="grip"
			aria-hidden="true"
			onpointerdown={(e) => {
				e.preventDefault();
				scrubStart(e);
			}}
			onpointermove={scrubMove}
			onpointerup={scrubEnd}
			onpointercancel={scrubEnd}
			onclick={(e) => e.preventDefault()}
		>
			<svg viewBox="0 0 10 10"><path d="M3.6 2 L1 5 L3.6 8 M6.4 2 L9 5 L6.4 8" /></svg>
		</span>
		<input
			type="text"
			inputmode="decimal"
			autocomplete="off"
			spellcheck="false"
			{disabled}
			value={text}
			placeholder={mixed ? (texts.mixed ?? '-') : undefined}
			bind:this={inputEl}
			aria-label={label}
			oninput={onInput}
			onkeydown={onKey}
			onfocus={(e) => {
				focused = true;
				e.currentTarget.select();
			}}
			onblur={() => {
				focused = false;
				text = mixed ? '' : shown;
			}}
		/>
		{#if suffix}<span class="unit">{suffix}</span>{/if}
		<!-- position dans la plage conseillée : DANS le champ, jamais au-delà de son bord ; hors plage,
		     un point orange au bout concerné (2026-11-18 : « au minimum, jaune et la ligne va jusqu'au
		     bout, ça déborde : pas logique ») -->
		{#if ratio != null}<span class="rail" class:low class:high><span class="fill" style:width={`${(ratio * 100).toFixed(2)}%`}></span></span>{/if}
	</label>
	{#if eye}{@render eye()}{/if}
</div>

<style>
	.nf {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 112px;
		--eye-col: 0px;
		align-items: center;
		gap: 10px;
		min-height: 30px;
	}
	.nf.compact {
		grid-template-columns: auto minmax(0, 1fr);
		gap: 5px;
		min-height: 26px;
	}
	.nf.compact .name {
		font-size: 11.5px;
		color: var(--kit-muted);
	}
	.nf.compact .hint {
		display: none;
	}
	.nf.compact .box {
		height: 26px;
		min-width: 0;
	}
	.nf.compact .grip {
		width: 12px;
	}
	.nf.compact input {
		padding: 0 4px;
		font-size: 12px;
	}
	.nf.compact .unit {
		padding-right: 5px;
		font-size: 10.5px;
	}
	.nf.mixed input::placeholder {
		color: var(--kit-faint);
		font-style: italic;
	}
	.nf.with-eye {
		grid-template-columns: minmax(0, 1fr) 112px 22px;
		gap: 6px 8px;
	}
	.lbl {
		display: flex;
		flex-direction: column;
		min-width: 0;
		cursor: ew-resize;
		user-select: none;
		touch-action: none;
	}
	.name {
		color: var(--kit-ink-2);
		font-size: 12.5px;
		line-height: 1.25;
	}
	.hint {
		color: var(--kit-faint);
		font-size: 11px;
		line-height: 1.25;
	}
	.box {
		position: relative;
		display: flex;
		align-items: center;
		height: 28px;
		border: 1px solid var(--kit-border-2);
		background: var(--kit-surface-2);
		border-radius: var(--kit-radius);
		transition: border-color 0.12s ease, box-shadow 0.12s ease;
	}
	.box:hover {
		border-color: var(--kit-faint);
	}
	.eyed .box {
		border-color: color-mix(in srgb, var(--eye) 70%, transparent);
	}
	.eyed .name {
		color: var(--eye);
	}
	.box:focus-within,
	.scrubbing .box {
		border-color: var(--kit-accent);
		box-shadow: 0 0 0 2px var(--kit-accent-soft);
	}
	/* ↺ : revenir à la valeur par défaut, à gauche du champ */
	.rst {
		position: absolute;
		left: -19px;
		top: 50%;
		display: grid;
		place-items: center;
		width: 16px;
		height: 16px;
		margin-top: -8px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		color: var(--kit-faint);
		opacity: 0.6;
		cursor: pointer;
	}
	.rst:hover {
		opacity: 1;
		color: var(--kit-accent);
		background: var(--kit-accent-soft);
	}
	.grip {
		display: grid;
		place-items: center;
		flex: none;
		width: 16px;
		height: 100%;
		border-right: 1px solid var(--kit-border);
		color: var(--kit-faint);
		cursor: ew-resize;
		touch-action: none;
		user-select: none;
		border-radius: var(--kit-radius) 0 0 var(--kit-radius);
	}
	.grip:hover,
	.scrubbing .grip {
		color: var(--kit-accent);
		background: var(--kit-accent-soft);
	}
	.grip svg {
		width: 9px;
		height: 9px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.rail {
		position: absolute;
		left: 20px;
		right: 7px;
		bottom: 3px;
		height: 2px;
		border-radius: 2px;
		pointer-events: none;
	}
	.fill {
		display: block;
		height: 100%;
		border-radius: 2px;
		background: var(--kit-accent);
		opacity: 0.35;
		transition: width 0.08s ease-out, opacity 0.12s ease;
	}
	.box:hover .fill,
	.scrubbing .fill {
		opacity: 0.85;
	}
	/* sous le minimum conseillé : point orange à gauche ; au-dessus du maximum : trait orange plein */
	.rail.low::before,
	.rail.high::after {
		content: '';
		position: absolute;
		top: -1.5px;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--kit-warn);
	}
	.rail.low::before {
		left: -3px;
	}
	.rail.high::after {
		right: -3px;
	}
	.rail.high .fill {
		background: var(--kit-warn);
		opacity: 0.9;
	}
	.outside .box {
		border-color: color-mix(in srgb, var(--kit-warn) 55%, var(--kit-border-2));
	}
	input {
		width: 100%;
		min-width: 0;
		height: 100%;
		border: 0;
		background: transparent;
		color: var(--kit-ink);
		font: 500 12.5px/1 var(--kit-mono);
		padding: 0 8px;
		text-align: right;
		outline: none;
	}
	.unit {
		flex: none;
		padding-right: 8px;
		color: var(--kit-faint);
		font: 11.5px/1 var(--kit-mono);
	}
	.disabled {
		opacity: 0.45;
		pointer-events: none;
	}
</style>
