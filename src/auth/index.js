/**
 * Comptes des outils kltk (v0.3, 2026-10-24 - Blondel en premier).
 *
 * Une seule identité : Supabase Auth du studio (`studio.kltk.be`). Le studio porte
 * l'inscription, la connexion, le mot de passe, le compte et l'abonnement ; l'outil n'a que
 * SA session, posée sur SON domaine dans un cookie httpOnly. Rien n'est partagé entre
 * sous-domaines (pas de cookie `.kltk.be`) : une XSS sur un autre site ne vole aucune
 * session - c'est l'option « plus étanche » de la spec du 2026-10-18.
 *
 * ```
 * outil  → loginUrl(next)        = <outil>/auth/login?next=<chemin>
 * outil  → createLoginHandler()  cookie `state` (httpOnly) → studio /sso?next=<url>&sso_state=…
 * studio → <outil>/auth/sso?token_hash=…&next=<chemin>?…&sso_state=…   jeton à usage unique
 * outil  → createSsoHandler()    state = cookie ? verifyOtp → session de l'outil → <chemin>
 * outil  → createViewerHandle()  à chaque requête : locals.supabase + locals.viewer
 * ```
 *
 * ⚠️ Le `state` (v0.4, 2026-10-26) empêche l'INJECTION DE SESSION : sans lui, n'importe qui
 * pouvait demander au studio un jeton pour SON compte, copier l'adresse de retour et la faire
 * ouvrir à quelqu'un d'autre - qui se retrouvait connecté au compte de l'attaquant, et y
 * enregistrait ses projets. Le jeton n'est échangé que dans le navigateur qui a lancé la
 * connexion (cookie `__Host-` : un autre sous-domaine `*.kltk.be` ne peut pas le poser).
 *
 * Pur Node (aucun import SvelteKit ni Supabase) : `createServerClient` (`@supabase/ssr`)
 * est PASSÉ par l'outil. Un outil sans compte (gen-schema) garde `viewerHandle` et n'a
 * aucune dépendance Supabase à installer.
 */

/**
 * @typedef {{ id: string, email: string, plan: string }} ViewerData
 * @typedef {ViewerData | null} Viewer
 */

export const STUDIO_URL = 'https://studio.kltk.be';

/** Cookie de session posé par `@supabase/ssr` (découpé en `.0`, `.1`… quand il est long). */
const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

/** Chemin interne sûr (`/…`, jamais `//hôte` ni `/\hôte`), sinon `/`. */
export function safePath(next) {
	const p = String(next ?? '');
	return p.startsWith('/') && !p.startsWith('//') && !p.startsWith('/\\') ? p : '/';
}

/** Hook d'un outil SANS comptes : `locals.viewer = null`. */
export async function viewerHandle({ event, resolve }) {
	event.locals.viewer = null;
	return resolve(event);
}

/**
 * Lien « Se connecter » : la route `/auth/login` de l'OUTIL (`createLoginHandler`), qui pose
 * le `state` puis file vers le studio. `next` : chemin ou URL complète de l'outil (seuls le
 * chemin et la query sont gardés). `signup: true` ouvre l'inscription plutôt que la connexion.
 *
 * ⚠️ v0.4 : ne mène plus directement au studio. Un lien `studio/sso?next=…` construit à la
 * main n'a pas de `state` : le retour serait refusé.
 */
export function loginUrl(next, { signup = false } = {}) {
	let path = '/';
	try {
		const u = new URL(String(next ?? '/'), 'http://outil.invalid');
		path = safePath(`${u.pathname}${u.search}`);
	} catch {
		/* chemin par défaut */
	}
	const qs = new URLSearchParams({ next: path });
	if (signup) qs.set('mode', 'signup');
	return `/auth/login?${qs}`;
}

/**
 * Page du studio (compte, abonnement…) aux couleurs de l'org `org`. Passe par `/login`,
 * qui fait suivre tout de suite si la personne est déjà connectée au studio.
 */
export function studioUrl(path, { org, studio = STUDIO_URL } = {}) {
	const u = new URL('/login', studio);
	if (org) u.searchParams.set('from', org);
	u.searchParams.set('next', safePath(path));
	return u.href;
}

/**
 * Hook SvelteKit d'un outil AVEC comptes : `event.locals.supabase` (client serveur, droits
 * de la personne connectée, RLS comprise) et `event.locals.viewer`.
 *
 * Sans cookie de session, aucun appel réseau : un visiteur anonyme ne coûte rien.
 * Le JWT est vérifié par `auth.getClaims()` (localement si les clés de signature sont
 * asymétriques, sinon par un aller-retour Auth).
 *
 * @param {{
 *   createServerClient: Function,
 *   url: () => string | undefined,
 *   key: () => string | undefined,
 *   plan?: (supabase: any, userId: string) => Promise<string>
 * }} opts  `url` / `key` : fonctions, lues à chaque requête (le kit ne lit jamais l'env).
 */
export function createViewerHandle({ createServerClient, url, key, plan = async () => 'free' }) {
	return async ({ event, resolve }) => {
		event.locals.viewer = null;
		event.locals.supabase = null;

		const supabaseUrl = url();
		const supabaseKey = key();
		if (!supabaseUrl || !supabaseKey) return resolve(event);

		const secure = event.url.protocol === 'https:';
		event.locals.supabase = createServerClient(supabaseUrl, supabaseKey, {
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll: (list) => {
					for (const { name, value, options } of list) {
						// httpOnly IMPOSÉ : seul le serveur de l'outil lit la session. Le
						// navigateur passe par les routes de l'outil, jamais par Supabase.
						event.cookies.set(name, value, { ...options, path: '/', httpOnly: true, secure, sameSite: 'lax' });
					}
				}
			}
		});

		if (event.cookies.getAll().some((c) => AUTH_COOKIE.test(c.name))) {
			try {
				const { data, error } = await event.locals.supabase.auth.getClaims();
				const claims = data?.claims;
				if (!error && claims?.sub) {
					event.locals.viewer = {
						id: claims.sub,
						email: claims.email ?? '',
						plan: (await plan(event.locals.supabase, claims.sub)) || 'free'
					};
				}
			} catch (e) {
				console.error('[prins-kit/auth] session illisible :', e?.message ?? e);
			}
		}
		return resolve(event);
	};
}

const NO_STORE = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' };

/** Paramètre porteur du `state`, dans le `next` qui fait l'aller-retour par le studio. */
export const STATE_PARAM = 'sso_state';
/** Une heure : couvre une inscription (le lien de confirmation repasse par `/sso`). */
const STATE_MAX_AGE = 60 * 60;

/** `__Host-` en https (ni sous-domaine, ni chemin, ni http ne peuvent le poser) ; nu en dev. */
const stateCookie = (url) => (url.protocol === 'https:' ? '__Host-kltk_sso_state' : 'kltk_sso_state');

/** 32 octets aléatoires en hex. `crypto` global : Node ≥ 19 et navigateurs. */
function randomState() {
	const bytes = new Uint8Array(32);
	globalThis.crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Égalité à temps constant (pas de `node:crypto` : ce module est aussi lu par le navigateur). */
function sameString(a, b) {
	if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !a) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

const redirectTo = (location) => new Response(null, { status: 303, headers: { ...NO_STORE, location } });

/**
 * `GET /auth/login?next=<chemin>[&mode=signup]` : début de connexion. Pose le `state` dans un
 * cookie httpOnly et le glisse dans le `next` envoyé au studio, qui le rend tel quel.
 * `studio` : fonction ou chaîne (l'outil la lit dans son env, `PUBLIC_STUDIO_URL` en dev).
 */
export function createLoginHandler({ studio = STUDIO_URL } = {}) {
	return async ({ url, cookies }) => {
		const state = randomState();
		cookies.set(stateCookie(url), state, {
			path: '/',
			httpOnly: true,
			secure: url.protocol === 'https:',
			sameSite: 'lax',
			maxAge: STATE_MAX_AGE
		});
		const back = new URL(safePath(url.searchParams.get('next')), url.origin);
		back.searchParams.delete(STATE_PARAM);
		back.searchParams.set(STATE_PARAM, state);
		const to = new URL('/sso', (typeof studio === 'function' ? studio() : studio) || STUDIO_URL);
		to.searchParams.set('next', back.href);
		if (url.searchParams.get('mode') === 'signup') to.searchParams.set('mode', 'signup');
		return redirectTo(to.href);
	};
}

/**
 * `GET /auth/sso?token_hash=…&next=<chemin>?…&sso_state=…` : échange le jeton du studio contre
 * une session de l'outil, SEULEMENT si le `state` du retour est celui du cookie posé par
 * `createLoginHandler` dans ce navigateur. Sinon, ou si le jeton est refusé (expiré, déjà
 * utilisé), retour sur `next` avec `?connexion=echec`. Le cookie est consommé dans tous les cas.
 */
export function createSsoHandler() {
	return async ({ url, locals, cookies }) => {
		const target = new URL(safePath(url.searchParams.get('next')), url.origin);
		const state = target.searchParams.get(STATE_PARAM);
		target.searchParams.delete(STATE_PARAM);
		const next = `${target.pathname}${target.search}`;

		const name = stateCookie(url);
		const expected = cookies?.get(name);
		if (expected !== undefined) cookies.delete(name, { path: '/', secure: url.protocol === 'https:' });

		const failed = () => {
			const f = new URL(next, url.origin);
			f.searchParams.set('connexion', 'echec');
			return redirectTo(`${f.pathname}${f.search}`);
		};

		const token_hash = url.searchParams.get('token_hash');
		if (!token_hash || !locals.supabase) return redirectTo(next);

		// ⚠️ Avant `verifyOtp` : un jeton qui ne vient pas d'une connexion lancée ICI n'est
		// jamais échangé (cf. en-tête du fichier).
		if (!sameString(state, expected)) {
			console.error('[prins-kit/auth] retour sans state valide : jeton ignoré');
			return failed();
		}

		const { error } = await locals.supabase.auth.verifyOtp({ token_hash, type: 'magiclink' });
		if (!error) return redirectTo(next);

		console.error('[prins-kit/auth] jeton refusé :', error.message);
		return failed();
	};
}

/** `POST /auth/logout` : ferme la session de l'OUTIL seulement (celle du studio reste). */
export function createLogoutHandler({ to = '/' } = {}) {
	return async ({ url, locals }) => {
		try {
			await locals.supabase?.auth.signOut({ scope: 'local' });
		} catch (e) {
			console.error('[prins-kit/auth] déconnexion :', e?.message ?? e);
		}
		return redirectTo(safePath(url.searchParams.get('next') ?? to));
	};
}
