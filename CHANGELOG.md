# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [semver](https://semver.org/lang/fr/).
Tant qu'on est en `0.x`, une version MINEURE (`0.2.0`) peut casser l'API : les outils
dépendent de `^0.1.0`, qui n'accepte que les correctifs `0.1.x`.

## [Non publié] - prévu 0.6.0

### Ajouté
- **SlatShape** dans le registre `TOOLS` (`slat-shape.kltk.be`, domaine provisoire ; langues
  fr, en, nl, es, ru) et son icône (`slats`) dans `ToolSwitcher`. Type `Lang` : `ru` ajouté.
- **Fabrication numérique `@prinsc/prins-kit/cnc`** (2026-11-24) : le code CNC de SlatShape devient
  celui du kit, pour Blondel et les suivants. JS pur, testé (`src/cnc/cnc.test.js`). Sous-chemins
  `/cnc/geometry`, `/cnc/offset`, `/cnc/nesting`, `/cnc/dxf`, `/cnc/gcode`, `/cnc/cam`,
  `/cnc/gcode-parse` (un outil qui garde le générateur côté serveur importe les sous-chemins).
  - imbrication : skyline + comblement, groupes par matière / épaisseur, stock de plaques et chutes
    réutilisables (portés par la session SlatShape) ; nouveau par pièce : `turn: false` (pas de
    quart de tour : fil du bois) et `flip: false` (pas de miroir : face finie) ;
  - DXF R12 / SVG : couches `POCHE_<prof>` (poches) et `PERCAGE_<prof>` (perçages borgnes),
    `partEntities` ; G-code Mach3 : poches vidées en anneaux concentriques (`pocketRings`,
    `cam.stepover`), perçages borgnes, en-tête `app` (`(Blondel - …)`, `(SlatShape - …)`).
- **Briques d'interface** (2026-11-24, origine SlatShape) : `Seg` (`wrap`), `Switch`, `Check`,
  `NumField` (format / parse en props, ↺ valeur par défaut, plage conseillée, snippets `help` et
  `eye`, `texts`), `Help` (bulle « ? », `title` / `body` / `aria`), `Split` (deux panneaux
  redimensionnables, `storageKey`, `labels`), `LoadBar`, `motion` / `motionMs` / `pop` / `veil`.
  Jetons `--kit-*` seulement, aucun texte en dur hors des valeurs par défaut anglaises de `Split`.

### Modifié
- **Infobulle** (`tooltip` / `tip`) : celle de SlatShape, une bulle unique qui apparaît (échelle +
  fondu) puis GLISSE d'un bouton à l'autre. Même usage. Styles injectés (`.kit-tip`) ; les styles
  `.kit-tooltip` de `studio.css` sont retirés. Respecte `motion.enabled` et « réduire les
  animations ».

## [0.5.0] - 2026-11-10

### Modifié (cassant)
- **Buy Me a Coffee remplacé par Ko-fi** (`ko-fi.com/eleazar_k`). `BMC_URL` n'existe plus :
  importer `KOFI_URL`. Assets BMC retirés de `src/assets/`, remplacés par les fichiers
  officiels Ko-fi (`kofi-cup.avif`, `kofi-button.avif`, AVIF tels que publiés sur
  more.ko-fi.com/brand-assets).
- `SupportCard` : couleurs Ko-fi (bleu `#72a5f2` des boutons officiels), bouton
  « Support me on Ko-fi ». Classe racine `.kofi`, `id` par défaut `kit-kofi-h`. Le `alt` passé
  doit dire ce que l'image écrit (« Support me on Ko-fi », traduit).

### Ajouté
- `KofiCup` : la tasse officielle Ko-fi (`size`, `alt`), pour le bouton de soutien des barres
  d'outils. `KOFI_BLUE` : le bleu des boutons officiels.

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
