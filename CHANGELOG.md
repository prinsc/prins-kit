# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [semver](https://semver.org/lang/fr/).
Tant qu'on est en `0.x`, une version MINEURE (`0.2.0`) peut casser l'API : les outils
dépendent de `^0.1.0`, qui n'accepte que les correctifs `0.1.x`.

## [0.4.0] - 2026-10-26

### Sécurité
- **Injection de session sur `/auth/sso` corrigée.** Sans lien entre le navigateur qui lance la
  connexion et celui qui revient, n'importe qui pouvait demander au studio un jeton pour SON
  compte, copier l'adresse de retour et la faire ouvrir à quelqu'un d'autre : la victime était
  connectée au compte de l'attaquant, et ses projets s'y enregistraient.
  - `createLoginHandler({ studio })` (`GET /auth/login`, **nouvelle route obligatoire**) : pose un
    `state` aléatoire dans un cookie httpOnly `__Host-kltk_sso_state` (1 h) et le glisse dans le
    `next` envoyé au studio.
  - `createSsoHandler()` n'échange plus le jeton que si le `state` revenu est celui du cookie
    (comparaison à temps constant). Le cookie est consommé à chaque retour.

### Modifié (cassant)
- `loginUrl(next, { signup })` rend `/auth/login?next=<chemin>` (route de l'outil) au lieu de
  l'adresse du studio. L'option `studio` passe à `createLoginHandler`. Un lien
  `studio/sso?next=…` construit à la main n'a pas de `state` : son retour est refusé.

## [0.3.0] - 2026-10-24

### Ajouté
- `@prinsc/prins-kit/auth` branché (Blondel en premier) : le studio (`studio.kltk.be`) porte les
  comptes, l'outil n'a que sa session, dans un cookie httpOnly sur son propre domaine.
  - `createViewerHandle({ createServerClient, url, key, plan })` : `locals.supabase` (droits de la
    personne connectée) + `locals.viewer` (`{ id, email, plan }`). `createServerClient` est passé
    par l'outil : le kit n'a toujours aucune dépendance Supabase.
  - `createSsoHandler()` (`GET /auth/sso`) : échange le jeton à usage unique du studio contre une
    session de l'outil.
  - `createLogoutHandler()` (`POST /auth/logout`).
  - `studioUrl(path, { org })`, `safePath(next)`, `STUDIO_URL`.

### Modifié
- `loginUrl(next, { signup })` vise `https://studio.kltk.be/sso?next=…` (avant : la page de
  connexion d'admin.kltk.be, jamais branchée). `viewerHandle` (viewer nul) reste pour les outils
  sans compte.

## [0.2.0] - 2026-10-19

### Ajouté
- `BlondelLogo` : le nouveau logo de Blondel (marches en cubes isométriques), en ligne, faces
  sombres en `currentColor`. Le menu des outils l'affiche pour Blondel.

### Retiré
- `StairsIcon` (ancien tracé en escalier), remplacé par `BlondelLogo`. Aucun outil ne l'importait.

### Modifié
- `peerDependencies.svelte` : `^5.20.0` (`$props.id`).

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
