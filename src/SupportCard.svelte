<script>
	// Encart de soutien Buy Me a Coffee, commun aux outils. Seule touche de jaune : c'est la
	// couleur de la marque BMC, elle doit se reconnaître d'un coup d'œil.
	// Assets officiels BMC embarqués dans le kit (src/assets) : Vite les émet hachés.
	// Aucun texte en dur : chaque outil passe les siens (le kit n'a pas d'i18n).
	// Le texte de l'outil dit que les équivalents sont payants SANS nommer de concurrent.
	import logo from './assets/bmc-logo.svg';
	import button from './assets/bmc-button.svg';
	import { BMC_URL } from './support.js';

	let { title, text, alt, url = BMC_URL, id = 'kit-bmc-h' } = $props();
</script>

<section class="bmc" aria-labelledby={id}>
	<a class="cup" href={url} target="_blank" rel="noopener" aria-hidden="true" tabindex="-1">
		<img src={logo} alt="" width="34" height="49" />
	</a>
	<div class="body">
		<h3 {id}>{title}</h3>
		<p>{text}</p>
		<a class="btn" href={url} target="_blank" rel="noopener">
			<img src={button} {alt} width="178" height="50" />
		</a>
	</div>
</section>

<style>
	.bmc {
		display: flex;
		gap: 18px;
		padding: 22px;
		border: 1px solid var(--kit-border);
		border-radius: 10px;
		background:
			radial-gradient(120% 140% at 0% 0%, rgba(255, 221, 0, 0.07), transparent 55%),
			var(--kit-surface);
	}
	.cup {
		display: grid;
		place-items: center;
		flex: none;
		width: 64px;
		height: 64px;
		border-radius: 14px;
		background: #ffdd00;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08) inset;
		transform: rotate(-4deg);
		transition: transform 0.2s ease;
	}
	.bmc:hover .cup {
		transform: rotate(0deg);
	}
	.cup img {
		width: 30px;
		height: auto;
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
		.bmc {
			flex-direction: column;
			gap: 14px;
			padding: 18px;
		}
	}
</style>
