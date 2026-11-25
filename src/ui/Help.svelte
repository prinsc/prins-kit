<script>
	// Bulle d'aide « ? » (Blondel, puis SlatShape, puis le kit) : survol à la souris, toucher au
	// doigt (le toucher l'épingle, un second toucher ou un clic ailleurs la ferme). En
	// `position: fixed` : les panneaux qui défilent ne la coupent pas.
	// `title` / `body` : textes de l'outil (`body` peut contenir <b>) ; `aria` : nom du bouton.
	import { CircleHelp } from 'lucide-svelte';
	import { pop } from './motion.js';

	let { title = '', body = '', aria = '' } = $props();
	const h = $derived({ t: title, b: body });

	let btn = $state(null);
	let open = $state(false);
	let pinned = false;
	let pos = $state({ left: 0, top: 0, below: true });
	let timer = 0;
	const W = 290;

	function place() {
		if (!btn) return;
		const r = btn.getBoundingClientRect();
		const vw = window.innerWidth;
		const below = window.innerHeight - r.bottom > 220 || r.top < 220;
		pos = { left: Math.max(8, Math.min(r.left + r.width / 2 - W / 2, vw - W - 8)), top: below ? r.bottom + 8 : r.top - 8, below };
	}
	function show() {
		clearTimeout(timer);
		place();
		open = true;
	}
	function hide() {
		if (pinned) return;
		clearTimeout(timer);
		timer = setTimeout(() => (open = false), 120);
	}
	function toggle(e) {
		e.preventDefault();
		e.stopPropagation();
		if (open && pinned) {
			pinned = false;
			open = false;
		} else {
			pinned = true;
			show();
		}
	}
	function onWindowDown(e) {
		if (open && btn && !btn.contains(e.target)) {
			pinned = false;
			open = false;
		}
	}
</script>

<svelte:window onpointerdown={onWindowDown} onkeydown={(e) => e.key === 'Escape' && open && ((pinned = false), (open = false))} onscroll={() => open && place()} />

<button
	bind:this={btn}
	type="button"
	class="hb"
	class:on={open}
	aria-label={aria || h.t}
	aria-expanded={open}
	onpointerdown={(e) => e.stopPropagation()}
	onpointerenter={(e) => e.pointerType === 'mouse' && show()}
	onpointerleave={(e) => e.pointerType === 'mouse' && hide()}
	onclick={toggle}
>
	<CircleHelp size={12} />
</button>
{#if open}
	<div class="pop" class:below={pos.below} style="left:{pos.left}px; top:{pos.top}px; width:{W}px" role="tooltip" transition:pop={{ origin: pos.below ? 'top center' : 'bottom center', base: pos.below ? '' : 'translateY(-100%)', y: pos.below ? -4 : 4, duration: 150 }}>
		<strong>{h.t}</strong>
		<p>{@html h.b}</p>
	</div>
{/if}

<style>
	.hb {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 16px;
		height: 16px;
		margin-left: 4px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--kit-faint);
		border-radius: 50%;
		cursor: help;
		vertical-align: -3px;
	}
	.hb:hover,
	.hb.on {
		color: var(--kit-accent);
	}
	.hb:focus-visible {
		outline: 2px solid var(--kit-accent);
	}
	.pop {
		position: fixed;
		z-index: 70;
		transform: translateY(-100%);
		padding: 10px 12px;
		border: 1px solid var(--kit-border-2);
		border-radius: var(--kit-radius);
		background: var(--kit-surface);
		box-shadow: var(--kit-shadow);
		text-align: left;
		pointer-events: none;
	}
	.pop.below {
		transform: none;
	}
	strong {
		display: block;
		margin-bottom: 4px;
		font: 600 12.5px/1.3 var(--kit-sans);
		color: var(--kit-ink);
	}
	p {
		margin: 0;
		font: 12px/1.5 var(--kit-sans);
		color: var(--kit-ink-2);
		white-space: normal;
	}
	p :global(b) {
		color: var(--kit-ink);
		font-weight: 600;
	}
</style>
