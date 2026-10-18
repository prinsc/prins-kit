<script>
	// Marque de Blondel (un profil d'escalier), même tracé que dans sa barre du haut.
	let { size = 15 } = $props();
</script>

<svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
	<path d="M3 17h4v-4h4V9h4V5h2" />
</svg>

<style>
	svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
</style>
