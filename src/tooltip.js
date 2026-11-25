/**
 * Infobulle des outils kltk : `use:tooltip={'texte'}` (alias `tip`). Version de SlatShape
 * (2026-11-18 : « les popups doivent s'afficher avec une animation, scale et fade avec comme
 * origine la partie survolée ; si on survole un bouton à côté, le popup slide vers le nouvel
 * endroit et le contenu change »), devenue celle du kit le 2026-11-24 (elle remplace la bulle
 * fixe d'avant, même usage).
 *
 * UNE seule bulle pour la page :
 *  - première apparition après 280 ms : fondu + échelle 0,92 → 1, depuis le côté du bouton ;
 *  - bulle visible (ou cachée il y a moins de 450 ms) et on passe à un voisin : elle GLISSE jusqu'à
 *    lui, sa taille s'anime et le texte change en fondu croisé ;
 *  - au-dessus du bouton, en dessous si la place manque ; bornée à l'écran ;
 *  - rien au toucher ; « Animations » coupées ou « réduire les animations » : sans mouvement.
 */
import { motion } from './ui/motion.js';

const DELAY = 280;
const WARM = 450;
const HIDE = 90;
const M = 8;

let el = null;
let txt = null;
let ruler = null;
const st = { node: null, visible: false, lastHide: 0, showTimer: 0, hideTimer: 0, fadeTimer: 0 };

const CSS = `
.kit-tip{position:fixed;left:0;top:0;z-index:80;pointer-events:none;box-sizing:border-box;width:max-content;max-width:260px;padding:5px 8px;overflow:hidden;
border:1px solid var(--kit-border-2,#444);border-radius:7px;background:var(--kit-surface,#222);box-shadow:var(--kit-shadow,0 8px 24px rgba(0,0,0,.25));
color:var(--kit-ink,#eee);font:500 11.5px/1.35 var(--kit-sans,system-ui);opacity:0;transform-origin:50% 100%;will-change:transform,opacity}
.kit-tip.below{transform-origin:50% 0}
.kit-tip.anim{transition:transform .2s cubic-bezier(.2,.8,.2,1),opacity .14s ease,width .2s cubic-bezier(.2,.8,.2,1),height .2s cubic-bezier(.2,.8,.2,1)}
.kit-tip>span{display:block;transition:opacity .1s ease}
.kit-tip.kit-ruler{visibility:hidden;transition:none;left:-9999px;top:-9999px;height:auto}
`;

function moving() {
	try {
		return motion.enabled && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	} catch {
		return false;
	}
}

function ensure(node) {
	if (el?.isConnected) return;
	const host = node.closest('.kit-root') ?? document.body;
	el = document.createElement('div');
	el.className = 'kit-tip';
	el.setAttribute('role', 'tooltip');
	txt = document.createElement('span');
	el.appendChild(txt);
	ruler = document.createElement('div');
	ruler.className = 'kit-tip kit-ruler';
	ruler.setAttribute('aria-hidden', 'true');
	host.append(el, ruler);
	if (!document.getElementById('kit-tip-css')) {
		const s = document.createElement('style');
		s.id = 'kit-tip-css';
		s.textContent = CSS;
		document.head.appendChild(s);
	}
}

/** Taille du texte et place de la bulle pour `node`. */
function layout(node, text) {
	ruler.textContent = text;
	// taille EXACTE arrondie au-dessus : `offsetWidth` arrondit parfois en dessous, le texte passait
	// alors à la ligne dans la bulle et la hauteur, mesurée pour une ligne, coupait la seconde
	const rr = ruler.getBoundingClientRect();
	const w = Math.ceil(rr.width) + 1;
	const h = Math.ceil(rr.height);
	const r = node.getBoundingClientRect();
	const below = r.top - h - 10 < M;
	const cx = Math.max(M + w / 2, Math.min(r.left + r.width / 2, window.innerWidth - M - w / 2));
	return { w, h, x: Math.round(cx - w / 2), y: Math.round(below ? r.bottom + 8 : r.top - 8 - h), below };
}

function show(node, text, enter) {
	ensure(node);
	const anim = moving();
	const p = layout(node, text);
	el.classList.toggle('below', p.below);
	clearTimeout(st.fadeTimer);
	if (enter || !anim) {
		// arrivée : posée sans transition, un peu réduite, puis elle s'ouvre vers sa place
		el.classList.remove('anim');
		txt.textContent = text;
		txt.style.opacity = '1';
		el.style.width = `${p.w}px`;
		el.style.height = `${p.h}px`;
		el.style.opacity = anim ? '0' : '1';
		el.style.transform = anim ? `translate(${p.x}px, ${p.y + (p.below ? -4 : 4)}px) scale(0.92)` : `translate(${p.x}px, ${p.y}px)`;
		if (anim) {
			void el.offsetWidth;
			el.classList.add('anim');
			el.style.opacity = '1';
			el.style.transform = `translate(${p.x}px, ${p.y}px) scale(1)`;
		}
	} else {
		// d'un bouton au voisin : elle glisse, sa taille suit, le texte change en fondu croisé
		el.classList.add('anim');
		if (txt.textContent !== text) {
			txt.style.opacity = '0';
			st.fadeTimer = setTimeout(() => {
				txt.textContent = text;
				txt.style.opacity = '1';
			}, 80);
		}
		el.style.width = `${p.w}px`;
		el.style.height = `${p.h}px`;
		el.style.opacity = '1';
		el.style.transform = `translate(${p.x}px, ${p.y}px) scale(1)`;
	}
	st.visible = true;
	// filet de sécurité : si le texte dépasse quand même (police chargée entre-temps…), la bulle grandit
	requestAnimationFrame(() => {
		if (!el || !txt) return;
		const cs = getComputedStyle(el);
		const need = txt.scrollHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
		if (need > el.offsetHeight + 0.5) el.style.height = `${Math.ceil(need)}px`;
	});
}

function hide() {
	clearTimeout(st.showTimer);
	clearTimeout(st.hideTimer);
	st.node = null;
	if (!st.visible || !el) return;
	st.visible = false;
	st.lastHide = performance.now();
	el.classList.toggle('anim', moving());
	el.style.opacity = '0';
	el.style.transform = `${el.style.transform.replace(/scale\([^)]*\)/, '')} scale(0.96)`;
}

if (typeof window !== 'undefined') window.addEventListener('scroll', () => st.visible && hide(), { capture: true, passive: true });

export function tooltip(node, text) {
	let cur = text;
	function enter(e) {
		if (!cur || e?.pointerType === 'touch') return;
		clearTimeout(st.hideTimer);
		clearTimeout(st.showTimer);
		st.node = node;
		if (st.visible) return show(node, cur, false);
		if (performance.now() - st.lastHide < WARM) return show(node, cur, true);
		st.showTimer = setTimeout(() => st.node === node && show(node, cur, true), DELAY);
	}
	function leave() {
		if (st.node !== node) return;
		clearTimeout(st.showTimer);
		st.hideTimer = setTimeout(hide, HIDE);
	}
	function down() {
		if (st.node === node) hide();
	}
	node.addEventListener('pointerenter', enter);
	node.addEventListener('pointerleave', leave);
	node.addEventListener('pointerdown', down);
	return {
		update(t) {
			cur = t;
			if (st.node !== node) return;
			if (!t) return hide();
			if (st.visible) show(node, t, false);
		},
		destroy() {
			if (st.node === node) hide();
			node.removeEventListener('pointerenter', enter);
			node.removeEventListener('pointerleave', leave);
			node.removeEventListener('pointerdown', down);
		}
	};
}
