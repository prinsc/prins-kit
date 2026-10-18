/**
 * Relais serveur des outils kltk vers l'admin studio (admin.kltk.be).
 *
 * Raison d'être : la clé API ne doit JAMAIS partir dans le bundle client. Le navigateur
 * poste sur la route de l'outil (`/api/lead`, `/api/feedback`), le serveur relaie avec le
 * Bearer. Logique reprise telle quelle des routes du portfolio (src/routes/api/lead,
 * src/routes/api/gen-schema/feedback) - mêmes contrats amont, mêmes codes.
 *
 * Le kit ne lit JAMAIS l'environnement : l'outil passe `apiKey`, une fonction
 * (`() => env.API_KLTK_KEY`), lue à chaque requête (une clé changée dans Coolify est prise
 * sans rebuild, et une clé absente se voit au moment de l'envoi, pas au démarrage).
 *
 * Pur Node (aucun import SvelteKit) : testé par `node --test`.
 */

export const ADMIN_API = 'https://admin.kltk.be/api/eleazar-portfolio';

// Doit rester aligné avec le champ leurre des formulaires des outils.
export const HONEYPOT_FIELD = 'company_website';

const MAX_LEN = 320;
const MAX_MESSAGE = 5000; // l'amont tronque à 5000 : on coupe déjà ici
const MAX_EMAIL = 320;

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const clean = (value, max = MAX_LEN) => String(value ?? '').trim().slice(0, max);

const json = (payload, status) =>
	new Response(JSON.stringify(payload), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});

/**
 * Inscription (newsletter / « prévenez-moi ») → POST {ADMIN_API}/newsletter
 *   body amont : { email, name, source, honeypot: '' }
 *   succès : { ok: true } (un email déjà inscrit renvoie aussi 200) · 429 : 5 / IP / minute
 *
 * @param {{ apiKey: () => string | undefined, url?: string, tag?: string }} opts
 */
export function createLeadHandler({ apiKey, url = `${ADMIN_API}/newsletter`, tag = 'lead' }) {
	return async ({ request, fetch }) => {
		try {
			const body = await request.json().catch(() => null);

			if (!body || typeof body !== 'object') {
				return json({ error: 'Requête invalide.' }, 400);
			}

			// Anti-bot : champ leurre rempli => 200 sans rien envoyer, pour ne pas
			// apprendre au bot qu'il a été détecté.
			if (clean(body[HONEYPOT_FIELD], 50)) {
				return json({ ok: true }, 200);
			}

			const email = clean(body.email).toLowerCase();

			if (!email || !isValidEmail(email)) {
				return json({ error: 'Cette adresse email ne semble pas valide.' }, 400);
			}

			const key = apiKey();

			if (!key) {
				// Ne pas "réussir" en silence : sinon on croit que tout marche alors
				// que rien n'est enregistré.
				console.error(`[${tag}] API_KLTK_KEY absente - inscription non transmise`);
				return json({ error: 'Inscription indisponible pour le moment.' }, 500);
			}

			const upstream = await fetch(url, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${key}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					email,
					name: clean(body.name, 120),
					source: clean(body.source, 80) || 'site-web',
					// Notre leurre a déjà filtré plus haut : toujours vide, comme l'exige l'amont.
					honeypot: ''
				})
			});

			if (upstream.status === 429) {
				return json({ error: 'Trop de tentatives. Réessayez dans une minute.' }, 429);
			}

			const result = await upstream.json().catch(() => null);

			if (!upstream.ok || !result?.ok) {
				console.error(`[${tag}] échec amont`, upstream.status, result);
				return json({ error: 'Inscription impossible pour le moment.' }, 502);
			}

			return json({ ok: true }, 200);
		} catch (e) {
			console.error(`[${tag}] erreur inattendue`, e);
			return json({ error: 'Erreur serveur.' }, 500);
		}
	};
}

/**
 * Avis / retour sur un outil → POST {ADMIN_API}/submit (section Contact de l'admin)
 *   body amont : { form_type, data: { email, message }, honeypot: '' }
 *   erreurs amont : 401 clé · 403 section contact désactivée · 400 form_type/body invalide,
 *   `missing_required:<key>`, `invalid_option:<key>:<value>` · 429 (5 / IP / min)
 *
 * L'email est demandé mais pas exigé : un avis anonyme reste un avis. On ne le valide
 * donc que s'il est rempli.
 *
 * ⚠ Dépendance à la config du formulaire côté admin : seul `message` doit y être requis.
 * Si l'amont exige un autre champ, l'envoi ressort en `400 missing_required:<key>` - d'où
 * le log en clair.
 *
 * @param {{ apiKey: () => string | undefined, formType: string, url?: string, tag?: string }} opts
 */
export function createFeedbackHandler({ apiKey, formType, url = `${ADMIN_API}/submit`, tag = 'feedback' }) {
	if (!formType) throw new Error('createFeedbackHandler : `formType` est requis');

	return async ({ request, fetch }) => {
		try {
			const body = await request.json().catch(() => null);

			if (!body || typeof body !== 'object') {
				return json({ error: 'Requête invalide.' }, 400);
			}

			if (clean(body[HONEYPOT_FIELD], 50)) {
				return json({ ok: true }, 200);
			}

			const email = clean(body.email, MAX_EMAIL).toLowerCase();
			const message = clean(body.message, MAX_MESSAGE);

			if (email && !isValidEmail(email)) {
				return json({ error: 'Cette adresse email ne semble pas valide.' }, 400);
			}
			if (!message) return json({ error: 'Le message est vide.' }, 400);

			const key = apiKey();

			if (!key) {
				console.error(`[${tag}] API_KLTK_KEY absente - avis non transmis`);
				return json({ error: 'Envoi indisponible pour le moment.' }, 500);
			}

			const upstream = await fetch(url, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${key}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					form_type: formType,
					data: { email, message },
					honeypot: ''
				})
			});

			if (upstream.status === 429) {
				return json({ error: 'Trop de tentatives. Réessayez dans une minute.' }, 429);
			}

			const result = await upstream.json().catch(() => null);

			if (!upstream.ok || !result?.ok) {
				console.error(`[${tag}] échec amont`, upstream.status, result);
				return json({ error: 'Envoi impossible pour le moment.' }, 502);
			}

			return json({ ok: true }, 200);
		} catch (e) {
			console.error(`[${tag}] erreur inattendue`, e);
			return json({ error: 'Erreur serveur.' }, 500);
		}
	};
}
