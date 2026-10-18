# @prinsc/prins-kit

Kit partagé des outils gratuits de [kltk.be](https://kltk.be) : jetons « studio », polices,
infobulle, sélecteur d'outils, encart de soutien, relais serveur vers l'admin studio.

```bash
npm i @prinsc/prins-kit
```

```svelte
<!-- +layout.svelte -->
<script>
	import '@prinsc/prins-kit/fonts.css';
	import '@prinsc/prins-kit/studio.css';
	let { children } = $props();
</script>

<div class="kit-root" data-theme="dark">{@render children()}</div>
```

```svelte
<script>
	import { ToolSwitcher, SupportCard, tooltip } from '@prinsc/prins-kit';
</script>

<ToolSwitcher current="blondel" lang="fr" />
<button use:tooltip={'Thème'}>…</button>
<SupportCard title="…" text="…" alt="Buy me a coffee" />
```

```js
// src/routes/api/lead/+server.js
import { env } from '$env/dynamic/private';
import { createLeadHandler } from '@prinsc/prins-kit/server';

export const POST = createLeadHandler({ apiKey: () => env.API_KLTK_KEY });
```

Svelte 5 requis. Voir `CLAUDE.md` pour les règles du kit et la procédure de publication.

MIT
