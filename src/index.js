// Entrée navigateur / composants. Le serveur a la sienne (`@prinsc/prins-kit/server`),
// pour qu'un `+server.js` ne tire jamais de composant Svelte.
export { tooltip, tooltip as tip } from './tooltip.js';
export { KOFI_URL, KOFI_BLUE } from './support.js';
export { TOOLS, SWITCHER_TEXT, pick, toolById, toolHref } from './tools.js';
export { default as SupportCard } from './SupportCard.svelte';
export { default as KofiCup } from './KofiCup.svelte';
export { default as ToolSwitcher } from './ToolSwitcher.svelte';
export { default as BlondelLogo } from './BlondelLogo.svelte';
// Briques d'interface communes (origine : SlatShape, la plus aboutie ; kit 0.6.0). Textes en props,
// jetons --kit-* seulement.
export { motion, motionMs, pop, veil } from './ui/motion.js';
export { default as Seg } from './ui/Seg.svelte';
export { default as Switch } from './ui/Switch.svelte';
export { default as Check } from './ui/Check.svelte';
export { default as NumField } from './ui/NumField.svelte';
export { default as Help } from './ui/Help.svelte';
export { default as Split } from './ui/Split.svelte';
export { default as LoadBar } from './ui/LoadBar.svelte';
