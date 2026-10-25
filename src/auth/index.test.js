import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
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
	return {
		sets,
		getAll: () => [...store].map(([name, value]) => ({ name, value })),
		set: (name, value, options) => {
			store.set(name, value);
			sets.push({ name, value, options });
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

test('loginUrl : /sso du studio, next encodé, mode inscription', () => {
	assert.equal(
		loginUrl('https://blondel.kltk.be/abc?lang=nl'),
		'https://studio.kltk.be/sso?next=https%3A%2F%2Fblondel.kltk.be%2Fabc%3Flang%3Dnl'
	);
	assert.match(loginUrl('https://blondel.kltk.be/', { signup: true }), /&mode=signup$/);
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

test('createSsoHandler : jeton vérifié puis retour sur next, sans cache ni referer', async () => {
	const f = fakeSupabase();
	const supabase = f.createServerClient('u', 'k', { cookies: {} });
	const res = await createSsoHandler()({
		url: new URL('https://blondel.kltk.be/auth/sso?token_hash=h1&next=%2Fabc%3Flang%3Dnl'),
		locals: { supabase }
	});
	assert.deepEqual(f.calls.verifyOtp, [{ token_hash: 'h1', type: 'magiclink' }]);
	assert.equal(res.status, 303);
	assert.equal(res.headers.get('location'), '/abc?lang=nl');
	assert.equal(res.headers.get('cache-control'), 'no-store');
	assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
});

test('createSsoHandler : next externe ignoré, échec signalé', async () => {
	const f = fakeSupabase({ verifyError: new Error('used') });
	const supabase = f.createServerClient('u', 'k', { cookies: {} });
	const res = await createSsoHandler()({
		url: new URL('https://blondel.kltk.be/auth/sso?token_hash=h&next=https%3A%2F%2Fevil.com'),
		locals: { supabase }
	});
	assert.equal(res.headers.get('location'), '/?connexion=echec');
});

test('createLogoutHandler : session locale fermée, retour interne', async () => {
	const f = fakeSupabase();
	const supabase = f.createServerClient('u', 'k', { cookies: {} });
	const res = await createLogoutHandler()({ url: new URL('https://blondel.kltk.be/auth/logout?next=%2Fabc'), locals: { supabase } });
	assert.deepEqual(f.calls.signOut, [{ scope: 'local' }]);
	assert.equal(res.headers.get('location'), '/abc');
});
