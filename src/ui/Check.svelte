<script>
	// Case à cocher MAISON (2026-11-18 : « les input checkbox doivent être les nôtres, pas un truc
	// natif, même dans la bannière cookie ») : une case arrondie qui se remplit, la coche se trace.
	// `children` : le libellé (texte ou balisage) ; tout le libellé est cliquable.
	let { checked = $bindable(false), disabled = false, onchange = (v) => {}, children, label = '' } = $props();
	function toggle() {
		if (disabled) return;
		checked = !checked;
		onchange(checked);
	}
</script>

<button type="button" class="ck" class:on={checked} role="checkbox" aria-checked={checked} aria-disabled={disabled} aria-label={label || undefined} {disabled} onclick={toggle}>
	<span class="box" aria-hidden="true">
		<svg viewBox="0 0 12 12"><path d="M2.5 6.3 L5 8.7 L9.6 3.6" /></svg>
	</span>
	{#if children}<span class="lb">{@render children()}</span>{:else if label}<span class="lb">{label}</span>{/if}
</button>

<style>
	.ck {
		display: inline-flex;
		align-items: flex-start;
		gap: 8px;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.ck:disabled {
		cursor: default;
		opacity: 0.7;
	}
	.box {
		display: grid;
		place-items: center;
		flex: none;
		width: 16px;
		height: 16px;
		margin-top: 1px;
		border: 1.5px solid var(--kit-border-2);
		border-radius: 5px;
		background: var(--kit-surface);
		transition: background 0.15s ease, border-color 0.15s ease, transform 0.12s ease;
	}
	.ck:hover:not(:disabled) .box {
		border-color: var(--kit-accent);
	}
	.ck:active:not(:disabled) .box {
		transform: scale(0.9);
	}
	.on .box {
		border-color: var(--kit-accent);
		background: var(--kit-accent);
	}
	svg {
		width: 11px;
		height: 11px;
		fill: none;
		stroke: var(--kit-accent-ink, #0b1f16);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-dasharray: 12;
		stroke-dashoffset: 12;
		transition: stroke-dashoffset 0.18s ease 0.04s;
	}
	.on svg {
		stroke-dashoffset: 0;
	}
	.ck:focus-visible .box {
		outline: 2px solid var(--kit-accent);
		outline-offset: 2px;
	}
	.lb {
		min-width: 0;
	}
</style>
