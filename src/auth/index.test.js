import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	STATE_PARAM,
	createLoginHandler,
	createLogoutHandler,
	createSsoHandler,
	createViewerHandle,
	loginUrl,
	safePath,
	studioUrl,
	viewerHandle
} from './index.js';

console.error = () => {};

/** Faux `event.cookies` de SvelteKit. */
function jar(initial = {}) {
	const store = new Map(Object.entries(initial));
	const sets = [];
	const deleted = [];
	return {
		sets,
		deleted,
		get: (name) => store.get(name),
		getAll: () => [...store].map(([name, value]) => ({ name, value })),
		set: (name, value, options) => {
			store.set(name, value);
			sets.push({ name, value, options });
		},
		delete: (name, options) => {
			store.delete(name);
			deleted.push({ name, options });
		}
	};
}

/** Faux `createServerClient` : rend un client dont `auth` répond ce qu'on lui dit. */
function fakeSupabase({ claims = null, claimsError = null, verifyError = null } = {}) {
	const calls = { getClaims: 0, verifyOtp: [], signOut: [], cookieOpts: null };
	const createServerClient = (url, key, opts) => {
		calls.cookieOpts = opts.cookies;
		return {
			auth: {
				getClaims: async () => {
					calls.getClaims++;
					return { data: claims ? { claims } : null, error: claimsError };
				},
				verifyOtp: async (args) => {
					calls.verifyOtp.push(args);
					return { error: verifyError };
				},
				signOut: async (args) => calls.signOut.push(args)
			}
		};
	};
	return { createServerClient, calls };
}

const run = async (handle, { cookies = jar(), href = 'https://blondel.kltk.be/' } = {}) => {
	const event = { locals: {}, cookies, url: new URL(href) };
	await handle({ event, resolve: async () => new Response('ok') });
	return event;
};

const env = { url: () => 'https://supabase.example', key: () => 'anon' };

test('safePath : chemins internes seulement', () => {
	assert.equal(safePath('/abc?x=1'), '/abc?x=1');
	assert.equal(safePath('//evil.com'), '/');
	assert.equal(safePath('/\\evil.com'), '/');
	assert.equal(safePath('https://evil.com'), '/');
	assert.equal(safePath(null), '/');
});

test("loginUrl : route /auth/login de l'outil, chemin seul, mode inscription", () => {
	assert.equal(loginUrl('https://blondel.kltk.be/abc?lang=nl'), '/auth/login?next=%2Fabc%3Flang%3Dnl');
	assert.equal(loginUrl('/abc'), '/auth/login?next=%2Fabc');
	assert.match(loginUrl('https://blondel.kltk.be/', { signup: true }), /&mode=signup$/);
	// une URL d'ailleurs ne garde que son chemin : jamais d'aller-retour vers un autre hôte
	assert.equal(loginUrl('https://evil.com/x'), '/auth/login?next=%2Fx');
	assert.equal(loginUrl('//evil.com'), '/auth/login?next=%2F');
});

test('createLoginHandler : state en cookie __Host- httpOnly, et dans le next envoyé au studio', async () => {
	const cookies = jar();
	const res = await createLoginHandler()({
		url: new URL('https://blondel.kltk.be/auth/login?next=%2Fabc%3Flang%3Dnl&mode=signup'),
		cookies
	});
	assert.equal(res.status, 303);
	const set = cookies.sets[0];
	assert.equal(set.name, '__Host-kltk_sso_state');
	assert.match(set.value, /^[0-9a-f]{64}$/);
	assert.deepEqual(
		{ ...set.options, maxAge: undefined },
		{ path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: undefined }
	);
	const to = new URL(res.headers.get('location'));
	assert.equal(to.origin + to.pathname, 'https://studio.kltk.be/sso');
	assert.equal(to.searchParams.get('mode'), 'signup');
	const back = new URL(to.searchParams.get('next'));
	assert.equal(back.origin, 'https://blondel.kltk.be');
	assert.equal(back.pathname, '/abc');
	assert.equal(back.searchParams.get('lang'), 'nl');
	assert.equal(back.searchParams.get(STATE_PARAM), set.value);
	// deux connexions = deux state différents
	const other = jar();
	await createLoginHandler()({ url: new URL('https://blondel.kltk.be/auth/login'), cookies: other });
	assert.notEqual(other.sets[0].value, set.value);
});

test('createLoginHandler : next externe ramené à /, studio de dev, cookie nu en http', async () => {
	const cookies = jar();
	const res = await createLoginHandler({ studio: () => 'http://localhost:5173' })({
		url: new URL('http://localhost:5174/auth/login?next=https%3A%2F%2Fevil.com%2Fx'),
		cookies
	});
	assert.equal(cookies.sets[0].name, 'kltk_sso_state');
	assert.equal(cookies.sets[0].options.secure, false);
	const to = new URL(res.headers.get('location'));
	assert.equal(to.origin, 'http://localhost:5173');
	const back = new URL(to.searchParams.get('next'));
	assert.equal(back.origin, 'http://localhost:5174');
	assert.equal(back.pathname, '/');
});

test('studioUrl : passe par /login, org et chemin interne', () => {
	const u = new URL(studioUrl('/dashboard/blondel/compte', { org: 'blondel' }));
	assert.equal(u.pathname, '/login');
	assert.equal(u.searchParams.get('from'), 'blondel');
	assert.equal(u.searchParams.get('next'), '/dashboard/blondel/compte');
	assert.equal(new URL(studioUrl('https://evil.com')).searchParams.get('next'), '/');
});

test('viewerHandle (outil sans compte) : viewer nul', async () => {
	const e = await run(viewerHandle);
	assert.equal(e.locals.viewer, null);
});

test('createViewerHandle : sans cookie de session, aucun appel Auth', async () => {
	const f = fakeSupabase({ claims: { sub: 'u1' } });
	const e = await run(createViewerHandle({ createServerClient: f.createServerClient, ...env }));
	assert.equal(e.locals.viewer, null);
	assert.ok(e.locals.supabase);
	assert.equal(f.calls.getClaims, 0);
});

test('createViewerHandle : cookie valide → viewer avec plan', async () => {
	const f = fakeSupabase({ claims: { sub: 'u1', email: 'a@b.be' } });
	const plan = async (sb, id) => (id === 'u1' ? 'pro' : 'free');
	const e = await run(createViewerHandle({ createServerClient: f.createServerClient, ...env, plan }), {
		cookies: jar({ 'sb-abc-auth-token.0': 'x' })
	});
	assert.deepEqual(e.locals.viewer, { id: 'u1', email: 'a@b.be', plan: 'pro' });
});

test('createViewerHandle : jeton refusé → viewer nul, pas d’exception', async () => {
	const f = fakeSupabase({ claimsError: new Error('expired') });
	const e = await run(createViewerHandle({ createServerClient: f.createServerClient, ...env }), {
		cookies: jar({ 'sb-abc-auth-token': 'x' })
	});
	assert.equal(e.locals.viewer, null);
});

test('createViewerHandle : cookies écrits httpOnly, secure en https seulement', async () => {
	const f = fakeSupabase();
	const cookies = jar();
	await run(createViewerHandle({ createServerClient: f.createServerClient, ...env }), { cookies });
	f.calls.cookieOpts.setAll([{ name: 'sb-x-auth-token', value: 'v', options: { httpOnly: false, maxAge: 9 } }]);
	assert.equal(cookies.sets[0].options.httpOnly, true);
	assert.equal(cookies.sets[0].options.secure, true);
	assert.equal(cookies.sets[0].options.maxAge, 9);

	const devJar = jar();
	await run(createViewerHandle({ createServerClient: f.createServerClient, ...env }), {
		cookies: devJar,
		href: 'http://localhost:5174/'
	});
	f.calls.cookieOpts.setAll([{ name: 'n', value: 'v', options: {} }]);
	assert.equal(devJar.sets[0].options.secure, false);
});

test('createViewerHandle : sans URL ni clé, pas de client', async () => {
	const f = fakeSupabase();
	const e = await run(createViewerHandle({ createServerClient: f.createServerClient, url: () => '', key: () => '' }));
	assert.equal(e.locals.supabase, null);
	assert.equal(e.locals.viewer, null);
});

const STATE = 'a'.repeat(64);
const ssoUrl = (next, token = 'h1') =>
	new URL(`https://blondel.kltk.be/auth/sso?token_hash=${token}&next=${encodeURIComponent(next)}`);

test('createSsoHandler : state = cookie → jeton vérifié, retour sur next sans le state, cookie consommé', async () => {
	const f = fakeSupabase();
	const supabase = f.createServerClient('u', 'k', { cookies: {} });
	const cookies = jar({ '__Host-kltk_sso_state': STATE });
	const res = await createSsoHandler()({ url: ssoUrl(`/abc?lang=nl&sso_state=${STATE}`), locals: { supabase }, cookies });
	assert.deepEqual(f.calls.verifyOtp, [{ token_hash: 'h1', type: 'magiclink' }]);
	assert.equal(res.status, 303);
	assert.equal(res.headers.get('location'), '/abc?lang=nl');
	assert.equal(res.headers.get('cache-control'), 'no-store');
	assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
	assert.deepEqual(cookies.deleted.map((d) => d.name), ['__Host-kltk_sso_state']);
});

test("createSsoHandler : lien d'un tiers (pas de cookie) → jeton JAMAIS échangé", async () => {
	const f = fakeSupabase();
	const supabase = f.createServerClient('u', 'k', { cookies: {} });
	const res = await createSsoHandler()({ url: ssoUrl(`/abc?sso_state=${STATE}`), locals: { supabase }, cookies: jar() });
	assert.deepEqual(f.calls.verifyOtp, []);
	assert.equal(res.headers.get('location'), '/abc?connexion=echec');
});

test('createSsoHandler : state absent, vide, différent ou de longueur différente → refusé', async () => {
	for (const [next, cookie] of [
		['/abc', STATE],
		['/abc?sso_state=', STATE],
		[`/abc?sso_state=${'b'.repeat(64)}`, STATE],
		[`/abc?sso_state=${STATE}x`, STATE],
		['/abc?sso_state=', '']
	]) {
		const f = fakeSupabase();
		const supabase = f.createServerClient('u', 'k', { cookies: {} });
		await createSsoHandler()({ url: ssoUrl(next), locals: { supabase }, cookies: jar({ '__Host-kltk_sso_state': cookie }) });
		assert.deepEqual(f.calls.verifyOtp, [], next);
	}
});

test('createSsoHandler : cookie nu (posable par un autre sous-domaine) ignoré en https', async () => {
	const f = fakeSupabase();
	const supabase = f.createServerClient('u', 'k', { cookies: {} });
	await createSsoHandler()({
		url: ssoUrl(`/abc?sso_state=${STATE}`),
		locals: { supabase },
		cookies: jar({ kltk_sso_state: STATE })
	});
	assert.deepEqual(f.calls.verifyOtp, []);
});

test('createSsoHandler : next externe ignoré, jeton refusé signalé', async () => {
	const f = fakeSupabase({ verifyError: new Error('used') });
	const supabase = f.createServerClient('u', 'k', { cookies: {} });
	const res = await createSsoHandler()({
		url: ssoUrl('https://evil.com'),
		locals: { supabase },
		cookies: jar({ '__Host-kltk_sso_state': STATE })
	});
	// next externe → '/' sans state → refusé avant même verifyOtp
	assert.deepEqual(f.calls.verifyOtp, []);
	assert.equal(res.headers.get('location'), '/?connexion=echec');

	const g = fakeSupabase({ verifyError: new Error('used') });
	const res2 = await createSsoHandler()({
		url: ssoUrl(`/?sso_state=${STATE}`),
		locals: { supabase: g.createServerClient('u', 'k', { cookies: {} }) },
		cookies: jar({ '__Host-kltk_sso_state': STATE })
	});
	assert.equal(g.calls.verifyOtp.length, 1);
	assert.equal(res2.headers.get('location'), '/?connexion=echec');
});

test('aller-retour complet : login → (studio) → sso, même navigateur', async () => {
	const cookies = jar();
	const start = await createLoginHandler()({ url: new URL('https://blondel.kltk.be/auth/login?next=%2Fp1'), cookies });
	const next = new URL(new URL(start.headers.get('location')).searchParams.get('next'));
	// le studio renvoie `<outil>/auth/sso?token_hash=…&next=<chemin + query>` (handoffUrl)
	const f = fakeSupabase();
	const res = await createSsoHandler()({
		url: ssoUrl(`${next.pathname}${next.search}`),
		locals: { supabase: f.createServerClient('u', 'k', { cookies: {} }) },
		cookies
	});
	assert.equal(f.calls.verifyOtp.length, 1);
	assert.equal(res.headers.get('location'), '/p1');
});

test('createLogoutHandler : session locale fermée, retour interne', async () => {
	const f = fakeSupabase();
	const supabase = f.createServerClient('u', 'k', { cookies: {} });
	const res = await createLogoutHandler()({ url: new URL('https://blondel.kltk.be/auth/logout?next=%2Fabc'), locals: { supabase } });
	assert.deepEqual(f.calls.signOut, [{ scope: 'local' }]);
	assert.equal(res.headers.get('location'), '/abc');
});
