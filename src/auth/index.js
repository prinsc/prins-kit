/**
 * Couture d'authentification des outils kltk - CONTRAT SEUL en v0.x.
 *
 * Cible (phase 2, rien n'est branché aujourd'hui) : une seule identité, Supabase Auth de
 * l'admin studio. Connexion sur `https://admin.kltk.be/login?next=<url>` (`next` en liste
 * blanche `https://*.kltk.be`), session posée par l'admin sur `.kltk.be`, lue ici par
 * `@supabase/ssr` et vérifiée localement (`auth.getClaims()`). Projets cloud dans
 * `tool_projects`, abonnement dans `subscriptions` (écrit par l'admin seul).
 *
 * Aujourd'hui `viewerHandle` pose `locals.viewer = null` : les outils peuvent déjà écrire
 * `if (locals.viewer)` / `page.data.viewer`, et le jour où la connexion arrive, seul ce
 * fichier change.
 *
 * Pur Node (aucun import SvelteKit) : utilisable dans `sequence(...)` de hooks.server.js.
 */

/**
 * @typedef {{ id: string, email: string, plan: string }} ViewerData
 * @typedef {ViewerData | null} Viewer
 */

/** Hook SvelteKit : remplit `event.locals.viewer`. */
export async function viewerHandle({ event, resolve }) {
	event.locals.viewer = null;
	return resolve(event);
}

/** URL de connexion de l'admin, retour sur `next` après coup (phase 2). */
export function loginUrl(next) {
	return `https://admin.kltk.be/login?next=${encodeURIComponent(next)}`;
}
