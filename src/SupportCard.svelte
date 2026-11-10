<script>
	// Encart de soutien Ko-fi, commun aux outils. Seule touche de bleu Ko-fi : c'est la couleur
	// des boutons officiels, elle doit se reconnaître d'un coup d'œil.
	// Assets officiels Ko-fi embarqués dans le kit (src/assets, AVIF tels que publiés par
	// more.ko-fi.com/brand-assets) : Vite les émet hachés.
	// Aucun texte en dur : chaque outil passe les siens (le kit n'a pas d'i18n). `alt` doit dire
	// ce que l'image de bouton écrit (« Support me on Ko-fi »), traduit.
	// Le texte de l'outil dit que les équivalents sont payants SANS nommer de concurrent.
	import button from './assets/kofi-button.avif';
	import KofiCup from './KofiCup.svelte';
	import { KOFI_URL, KOFI_BLUE } from './support.js';

	let { title, text, alt, url = KOFI_URL, id = 'kit-kofi-h' } = $props();
</script>

<section class="kofi" aria-labelledby={id} style:--kofi-blue={KOFI_BLUE}>
	<a class="cup" href={url} target="_blank" rel="noopener" aria-hidden="true" tabindex="-1">
		<KofiCup size={38} />
	</a>
	<div class="body">
		<h3 {id}>{title}</h3>
		<p>{text}</p>
		<a class="btn" href={url} target="_blank" rel="noopener">
			<img src={button} {alt} width="218" height="44" />
		</a>
	</div>
</section>

<style>
	.kofi {
		display: flex;
		gap: 18px;
		padding: 22px;
		border: 1px solid var(--kit-border);
		border-radius: 10px;
		background:
			radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--kofi-blue) 9%, transparent), transparent 55%),
			var(--kit-surface);
	}
	.cup {
		display: grid;
		place-items: center;
		flex: none;
		width: 64px;
		height: 64px;
		border-radius: 14px;
		background: var(--kofi-blue);
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08) inset;
		transform: rotate(-4deg);
		transition: transform 0.2s ease;
	}
	.kofi:hover .cup {
		transform: rotate(0deg);
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
	}
	h3 {
		margin: 0;
		font: 600 17px/1.25 var(--kit-sans);
		color: var(--kit-ink);
		text-wrap: balance;
	}
	p {
		margin: 0;
		font-size: 13.5px;
		line-height: 1.55;
		color: var(--kit-ink-2);
	}
	.btn {
		align-self: flex-start;
		margin-top: 4px;
		border-radius: 9px;
		line-height: 0;
		transition: transform 0.12s ease;
	}
	.btn:hover {
		transform: translateY(-1px);
	}
	.btn:focus-visible {
		outline: 2px solid var(--kit-accent);
		outline-offset: 3px;
	}
	.btn img {
		height: 44px;
		width: auto;
	}
	@media (prefers-reduced-motion: reduce) {
		.cup,
		.btn {
			transition: none;
		}
	}
	@media (max-width: 480px) {
		.kofi {
			flex-direction: column;
			gap: 14px;
			padding: 18px;
		}
	}
</style>
