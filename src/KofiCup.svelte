<script>
	// Tasse Ko-fi officielle (more.ko-fi.com/brand-assets, fichier « favicon » : tasse + cœur
	// avec liseré blanc), pour les boutons de soutien des barres d'outils. Image, pas dessin :
	// la marque ne se redessine pas. Décorative par défaut - le lien qui l'entoure porte le nom.
	import cup from './assets/kofi-cup.avif';

	let { size = 16, alt = '' } = $props();
</script>

<img class="kofi-cup" src={cup} {alt} width={size} height={size} draggable="false" />

<style>
	.kofi-cup {
		display: block;
		flex: none;
		object-fit: contain;
	}
</style>
