# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [semver](https://semver.org/lang/fr/).
Tant qu'on est en `0.x`, une version MINEURE (`0.2.0`) peut casser l'API : les outils
dépendent de `^0.1.0`, qui n'accepte que les correctifs `0.1.x`.

## [0.1.0] - 2026-10-18

Première version, extraite des outils du portfolio (`/outils/calcul-escalier`, `/outils/gen-schema`).

### Ajouté
- `studio.css` : jetons `--kit-*` (sombre par défaut, clair via `data-theme="light"`), styles de l'infobulle.
- `fonts.css` : Inter (variable) + IBM Plex Mono 400/500/700, auto-hébergées.
- `tooltip` (alias `tip`) : action d'infobulle, fusion des deux copies.
- `SupportCard` : encart Buy Me a Coffee (textes en props) + `BMC_URL`.
- `ToolSwitcher` + registre `TOOLS` (`toolHref`, `pick`, `toolById`) : menu « Outils kltk ».
- `StairsIcon` : marque de Blondel.
- `@prinsc/prins-kit/server` : `createLeadHandler`, `createFeedbackHandler` (relais vers l'admin studio).
- `@prinsc/prins-kit/auth` : contrat `Viewer`, `viewerHandle` (pose `locals.viewer = null`), `loginUrl`.
