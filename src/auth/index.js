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
 * outil  → loginUrl(next)       = studio /sso?next=<url>     (connexion si besoin)
 * studio → <outil>/auth/sso?token_hash=…&next=<chemin>      jeton à usage unique
 * outil  → createSsoHandler()   verifyOtp → session de l'outil → <chemin>
 * outil  → createViewerHandle() à chaque requête : locals.supabase + locals.viewer
 * ```
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
 * Connexion par le studio, retour connecté sur `next` (URL complète de l'outil).
 * `signup: true` ouvre l'inscription plutôt que la connexion quand il n'y a pas de session.
 */
export function loginUrl(next, { signup = false, studio = STUDIO_URL } = {}) {
	const u = new URL('/sso', studio);
	u.searchParams.set('next', next);
	if (signup) u.searchParams.set('mode', 'signup');
	return u.href;
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

const redirectTo = (location) => new Response(null, { status: 303, headers: { ...NO_STORE, location } });

/**
 * `GET /auth/sso?token_hash=…&next=<chemin>` : échange le jeton du studio contre une session
 * de l'outil. Un jeton refusé (expiré, déjà utilisé) renvoie sur `next` avec `?connexion=echec`.
 */
export function createSsoHandler() {
	return async ({ url, locals }) => {
		const next = safePath(url.searchParams.get('next'));
		const token_hash = url.searchParams.get('token_hash');
		if (!token_hash || !locals.supabase) return redirectTo(next);

		const { error } = await locals.supabase.auth.verifyOtp({ token_hash, type: 'magiclink' });
		if (!error) return redirectTo(next);

		console.error('[prins-kit/auth] jeton refusé :', error.message);
		const failed = new URL(next, url.origin);
		failed.searchParams.set('connexion', 'echec');
		return redirectTo(`${failed.pathname}${failed.search}`);
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
