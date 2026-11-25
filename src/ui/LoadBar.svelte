<script>
	// Barre de chargement (2026-11-17 : « s'il y a une erreur, l'afficher en rouge dessous ; si
	// tu sais ce qu'il charge, le dire ; une barre qui évolue, c'est encore mieux »).
	// `pct` : 0 → 1 ; `label` : ce qui se charge ; `detail` : à droite (3/8, 1,2 Mo…) ;
	// `errors` : lignes en rouge. Pas d'animation infinie (elle affamait les calculs, cf. IA).
	let { label = '', detail = '', pct = 0, errors = [], compact = false } = $props();
	const w = $derived(`${Math.round(Math.min(1, Math.max(0, pct)) * 100)}%`);
</script>

<div class="lb" class:compact role="status" aria-live="polite">
	<div class="row">
		<span class="lab">{label}</span>
		{#if detail}<span class="det">{detail}</span>{/if}
	</div>
	<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(pct * 100)}><span style:width={w}></span></div>
	{#each errors as e, i (i)}
		<p class="err">{e}</p>
	{/each}
</div>

<style>
	.lb {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: min(360px, 100%);
	}
	.row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		font-size: 12.5px;
		color: var(--kit-ink-2);
	}
	.lab {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.det {
		flex: none;
		font: 11px var(--kit-mono);
		color: var(--kit-muted);
	}
	.bar {
		height: 4px;
		border-radius: 2px;
		background: var(--kit-surface-3);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		border-radius: 2px;
		background: var(--kit-accent);
		transition: width 0.25s ease;
	}
	.err {
		margin: 0;
		font-size: 12px;
		line-height: 1.4;
		color: var(--kit-err);
	}
	.compact .row {
		font-size: 11.5px;
	}
	.compact .bar {
		height: 3px;
	}
</style>
