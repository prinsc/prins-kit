<script>
	let { label, aria = '', checked = $bindable(false), onchange = () => {} } = $props();
</script>

<label class="sw">
	{#if label}<span class="name">{label}</span>{/if}
	<button
		type="button"
		role="switch"
		aria-checked={checked}
		aria-label={aria || label}
		class:on={checked}
		onclick={() => {
			checked = !checked;
			onchange(checked);
		}}
	>
		<span class="knob"></span>
	</button>
</label>

<style>
	.sw {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		min-height: 30px;
		cursor: pointer;
	}
	.name {
		color: var(--kit-ink-2);
		font-size: 12.5px;
	}
	button {
		position: relative;
		flex: none;
		width: 30px;
		height: 17px;
		padding: 0;
		border: 1px solid var(--kit-border-2);
		background: var(--kit-surface-3);
		border-radius: 999px;
		cursor: pointer;
		transition: background 0.15s ease, border-color 0.15s ease;
	}
	.knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 11px;
		height: 11px;
		background: var(--kit-muted);
		border-radius: 50%;
		transition: transform 0.15s ease, background 0.15s ease;
	}
	button.on {
		background: var(--kit-accent-soft-strong, color-mix(in srgb, var(--kit-accent) 22%, transparent));
		border-color: var(--kit-accent-line);
	}
	button.on .knob {
		transform: translateX(13px);
		background: var(--kit-accent);
	}
	button:focus-visible {
		outline: 2px solid var(--kit-accent);
		outline-offset: 2px;
	}
</style>
