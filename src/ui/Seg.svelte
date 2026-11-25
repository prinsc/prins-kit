<script>
	// Contrôle segmenté compact (onglets de choix exclusif). `wrap` : trop d'options pour la
	// largeur → à la ligne (SlatShape) ; `wrap={false}` : une seule ligne, libellés resserrés.
	let { options = [], value = $bindable(), label = '', size = 'md', wrap = true, onchange = () => {} } = $props();
</script>

<div class="seg {size}" class:nowrap={!wrap} role="radiogroup" aria-label={label}>
	{#each options as o (o.value)}
		<button
			type="button"
			role="radio"
			aria-checked={value === o.value}
			class:on={value === o.value}
			title={o.title}
			disabled={o.disabled}
			onclick={() => {
				if (value !== o.value) {
					value = o.value;
					onchange(o.value);
				}
			}}
		>
			{#if o.icon}<o.icon size={13} />{/if}
			{#if o.label}<span>{o.label}</span>{/if}
		</button>
	{/each}
</div>

<style>
	.seg {
		display: flex;
		flex-wrap: wrap; /* trop d'options pour la largeur : à la ligne, jamais hors du panneau */
		padding: 2px;
		gap: 2px;
		background: var(--kit-surface-2);
		border: 1px solid var(--kit-border);
		border-radius: var(--kit-radius);
	}
	button {
		flex: 1 1 auto;
		min-width: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		height: 24px;
		padding: 0 10px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--kit-muted);
		font: 500 12px/1 var(--kit-sans);
		border-radius: 4px;
		cursor: pointer;
		white-space: nowrap;
	}
	.nowrap {
		flex-wrap: nowrap;
	}
	.nowrap button {
		flex: 1 1 0;
		padding: 0 6px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	button:hover {
		color: var(--kit-ink);
	}
	button.on {
		background: var(--kit-surface-3);
		border-color: var(--kit-border-2);
		color: var(--kit-ink);
	}
	button:disabled {
		opacity: 0.38;
		cursor: not-allowed;
	}
	button:focus-visible {
		outline: 2px solid var(--kit-accent);
		outline-offset: 1px;
	}
	.sm button {
		height: 22px;
		padding: 0 8px;
		font-size: 11.5px;
	}
</style>
