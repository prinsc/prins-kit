// Entrée navigateur / composants. Le serveur a la sienne (`@prinsc/prins-kit/server`),
// pour qu'un `+server.js` ne tire jamais de composant Svelte.
export { tooltip, tooltip as tip } from './tooltip.js';
export { KOFI_URL, KOFI_BLUE } from './support.js';
export { TOOLS, SWITCHER_TEXT, pick, toolById, toolHref } from './tools.js';
export { default as SupportCard } from './SupportCard.svelte';
export { default as KofiCup } from './KofiCup.svelte';
export { default as ToolSwitcher } from './ToolSwitcher.svelte';
export { default as BlondelLogo } from './BlondelLogo.svelte';
