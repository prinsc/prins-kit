# prins-kit - kit partagé des outils kltk

Paquet npm **`@prinsc/prins-kit`**, consommé par les outils gratuits de kltk.be, chacun dans
son repo et sur son sous-domaine :

| Outil | Repo | Déploiement |
|---|---|---|
| Blondel (calcul d'escalier) | `../blondel` | `blondel.kltk.be` (Coolify) |
| Gen-Schema (schémas électriques) | `../gen-schema` | `gen-schema.kltk.be` (Coolify) |

Design d'ensemble : `eleazar-portfolio-v2/docs/superpowers/specs/2026-10-18-outils-repos-separes-design.md`.

## Ce que contient le kit (et rien d'autre)

| Export | Rôle |
|---|---|
| `@prinsc/prins-kit/studio.css` | jetons `--kit-*` sur `.kit-root`, clair via `data-theme="light"` ; styles `.kit-tooltip` |
| `@prinsc/prins-kit/fonts.css` | Inter (variable) + IBM Plex Mono 400/500/700, fichiers dans `src/fonts/` |
| `tooltip` (alias `tip`) | action `use:tooltip={'texte'}` |
| `SupportCard` + `BMC_URL` | encart Buy Me a Coffee, assets BMC dans `src/assets/` |
| `ToolSwitcher` + `TOOLS`, `toolHref`, `pick`, `toolById` | menu « Outils kltk », registre des outils |
| `BlondelLogo` | logo de Blondel (en couleurs, faces sombres en `currentColor`) |
| `@prinsc/prins-kit/server` | `createLeadHandler`, `createFeedbackHandler` (relais vers admin.kltk.be) |
| `@prinsc/prins-kit/auth` | contrat `Viewer`, `viewerHandle` (`locals.viewer = null`), `loginUrl` |

Règles :
- **Pas d'i18n propre.** Tout texte visible arrive en prop. Seules exceptions : noms/taglines
  du registre `TOOLS` et textes du sélecteur (`SWITCHER_TEXT`), qui n'appartiennent à aucun outil.
- **Les composants ne lisent QUE des `--kit-*`.** Les outils aliasent leurs anciens noms
  (`--panel: var(--kit-surface)`), jamais l'inverse.
- **Le kit ne lit jamais l'environnement.** Les handlers serveur reçoivent `apiKey` en fonction.
- `src/server/` et `src/auth/` sont du **Node pur** (aucun import SvelteKit, aucun `.svelte`) :
  testés par `node --test`, importables depuis un `+server.js` sans tirer de composant.
- **Paquet source, sans build** : on publie `src/` tel quel (JS + `.svelte` + CSS). Le champ
  `svelte` / la condition d'export `svelte` laissent vite-plugin-svelte compiler dans l'outil.
  Ne pas introduire de TypeScript ni d'étape de build sans raison.
- `svelte` et `lucide-svelte` en `peerDependencies`. Pas d'icône Zap/éclair.
- Ajouter un outil = une entrée dans `TOOLS` (`id`, `url`, `icon`, `langs`, `name`, `tagline`)
  + une icône dans `ToolSwitcher` si ce n'est ni `stairs` (logo de Blondel) ni `network`.

## Changer quelque chose dans le kit

Depuis n'importe quel outil, modifier le kit est autorisé sans demander (utilisateur, 2026-10-19).

1. Modifier ici, `npm test`.
2. `npm version patch` (correctif) ou `minor` (nouveauté / API changée : en `0.x` une mineure
   peut casser), noter dans `CHANGELOG.md`.
3. Publier : `git push --follow-tags` (le workflow `.github/workflows/publish.yml` publie sur
   tag `v*` une fois le *trusted publisher* configuré sur npmjs.com), sinon à la main
   `npm publish --access public`.
4. Dans chaque outil concerné : `npm i @prinsc/prins-kit@<version>`, `npm test`, `npm run build`,
   commit du lockfile, push → Coolify redéploie. Dependabot ouvre aussi la PR tout seul.

Tester avant de publier : `npm pack` ici, puis dans l'outil
`npm i ../prins-kit/prinsc-prins-kit-<version>.tgz` - **sans commiter** ce `package.json`
(un `file:` ne se résout pas sur Coolify), ou `npm link`.

Tant qu'une version n'est pas publiée et adoptée par un outil, elle n'existe pas pour lui :
c'est voulu (le lockfile fige la version, une modif du kit ne casse jamais un outil en douce).
