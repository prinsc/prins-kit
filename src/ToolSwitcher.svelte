<script>
	// Sélecteur « Outils kltk » : le lien visible entre les outils, posé dans la barre du haut
	// de chacun. Menu déroulant, mais les liens restent dans le DOM (crawlables).
	// Données : registre `TOOLS` (src/tools.js). L'outil courant est marqué, pas masqué.
	import { LayoutGrid, Network, Check } from 'lucide-svelte';
	import StairsIcon from './StairsIcon.svelte';
	import { TOOLS, SWITCHER_TEXT, pick, toolHref } from './tools.js';

	/** `current` = id du registre de l'outil qui affiche le menu. */
	let { current, lang = 'fr' } = $props();

	const tx = $derived(SWITCHER_TEXT[lang] ?? SWITCHER_TEXT.en);
	let open = $state(false);
	let root = $state(null);

	function onDown(e) {
		if (open && root && !root.contains(e.target)) open = false;
	}
</script>

<svelte:window onpointerdown={onDown} onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<div class="kit-sw" bind:this={root}>
	<button
		type="button"
		class="kit-sw-btn"
		class:on={open}
		aria-haspopup="true"
		aria-expanded={open}
		aria-label={tx.title}
		title={tx.title}
		onclick={() => (open = !open)}
	>
		<LayoutGrid size={14} />
	</button>
	<nav class="kit-sw-menu" class:open aria-label={tx.title}>
		<p class="head">{tx.title}</p>
		{#each TOOLS as t (t.id)}
			<a
				href={toolHref(t.id, lang)}
				class:cur={t.id === current}
				aria-current={t.id === current ? 'page' : undefined}
			>
				<span class="ico">
					{#if t.icon === 'stairs'}<StairsIcon />{:else}<Network size={14} />{/if}
				</span>
				<span class="txt">
					<span class="nm">{pick(t.name, lang)}</span>
					<span class="tg">{pick(t.tagline, lang)}</span>
				</span>
				{#if t.id === current}<span class="ck" title={tx.current}><Check size={12} /></span>{/if}
			</a>
		{/each}
		<a class="foot" href="https://kltk.be">{tx.all} · kltk.be</a>
	</nav>
</div>

<style>
	.kit-sw {
		position: relative;
		flex: none;
	}
	.kit-sw-btn {
		display: inline-grid;
		place-items: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 1px solid var(--kit-border-2);
		background: var(--kit-surface-2);
		color: var(--kit-ink-2);
		border-radius: var(--kit-radius);
		cursor: pointer;
	}
	.kit-sw-btn:hover,
	.kit-sw-btn.on {
		color: var(--kit-ink);
		border-color: var(--kit-faint);
	}
	.kit-sw-menu {
		position: absolute;
		right: 0;
		top: calc(100% + 6px);
		z-index: 40;
		display: none;
		flex-direction: column;
		width: 252px;
		padding: 4px;
		background: var(--kit-surface);
		border: 1px solid var(--kit-border-2);
		border-radius: var(--kit-radius);
		box-shadow: var(--kit-shadow);
		font-family: var(--kit-sans);
	}
	.kit-sw-menu.open {
		display: flex;
	}
	.head {
		margin: 0;
		padding: 6px 8px 4px;
		font: 500 11px/1.2 var(--kit-sans);
		color: var(--kit-faint);
	}
	.kit-sw-menu a {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 8px;
		border-radius: 4px;
		color: var(--kit-ink-2);
		text-decoration: none;
	}
	.kit-sw-menu a:hover {
		background: var(--kit-surface-2);
		color: var(--kit-ink);
	}
	.ico {
		display: grid;
		place-items: center;
		flex: none;
		width: 26px;
		height: 26px;
		border-radius: 6px;
		background: var(--kit-accent-soft);
		border: 1px solid var(--kit-accent-line);
		color: var(--kit-accent);
	}
	.txt {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-width: 0;
	}
	.nm {
		font: 500 12.5px/1.25 var(--kit-sans);
		color: var(--kit-ink);
	}
	.tg {
		font-size: 11.5px;
		line-height: 1.25;
		color: var(--kit-muted);
	}
	.ck {
		display: inline-grid;
		color: var(--kit-accent);
	}
	.kit-sw-menu a.foot {
		margin-top: 2px;
		padding: 7px 8px 6px;
		border-top: 1px solid var(--kit-border);
		border-radius: 0 0 4px 4px;
		font-size: 11.5px;
		color: var(--kit-muted);
	}
	.kit-sw-btn:focus-visible,
	.kit-sw-menu a:focus-visible {
		outline: 2px solid var(--kit-accent);
		outline-offset: 1px;
	}
</style>
