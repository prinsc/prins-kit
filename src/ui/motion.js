/**
 * Micro-animations partagées (origine : SlatShape, 2026-11-18 : « les popups doivent s'afficher
 * avec un scale et un fade, avec comme origine la partie survolée »). Transitions Svelte.
 *
 * `motion.enabled` : réglage de l'outil (« Animations » dans ses paramètres) ; le système
 * (« réduire les animations ») l'emporte toujours. Un outil le pose quand sa préférence change :
 * `motion.enabled = ui.motion`.
 */
import { cubicOut } from 'svelte/easing';

export const motion = { enabled: true };

/** Durée réelle d'une animation : 0 si les animations sont coupées. */
export function motionMs(ms) {
	if (!motion.enabled) return 0;
	if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 0;
	return ms;
}

/**
 * Apparition « pop » : fondu + légère échelle, depuis `origin` (le déclencheur : 'top right'…),
 * avec un petit glissé `y` (px). `base` : transformation déjà posée sur l'élément (centrage).
 */
export function pop(node, { duration = 170, start = 0.94, y = -6, origin = null, base = '' } = {}) {
	if (origin) node.style.transformOrigin = origin;
	return {
		duration: motionMs(duration),
		easing: cubicOut,
		css: (t, u) => `opacity:${t};transform:${base} translateY(${(u * y).toFixed(2)}px) scale(${(start + (1 - start) * t).toFixed(4)})`
	};
}

/** Voile d'une fenêtre : fondu simple. */
export function veil(node, { duration = 160 } = {}) {
	return { duration: motionMs(duration), css: (t) => `opacity:${t}` };
}
