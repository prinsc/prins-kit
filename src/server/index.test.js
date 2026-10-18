import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLeadHandler, createFeedbackHandler, ADMIN_API, HONEYPOT_FIELD } from './index.js';

// Faux `fetch` amont : enregistre les appels, répond ce qu'on lui dit.
function upstream(status = 200, payload = { ok: true }) {
	const calls = [];
	const fetch = async (url, init) => {
		calls.push({ url, init, body: JSON.parse(init.body) });
		return new Response(JSON.stringify(payload), { status });
	};
	return { fetch, calls };
}

const req = (body) =>
	new Request('http://localhost/api/x', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});

// les erreurs attendues sont journalisées : on les tait pour garder la sortie lisible
console.error = () => {};

const key = () => 'k-test';

test('lead : relaie email, nom, source avec le Bearer', async () => {
	const up = upstream();
	const h = createLeadHandler({ apiKey: key });
	const res = await h({ request: req({ email: ' Ana@Ex.be ', name: 'Ana', source: 'blondel:home:fr' }), fetch: up.fetch });
	assert.equal(res.status, 200);
	assert.deepEqual(await res.json(), { ok: true });
	assert.equal(up.calls.length, 1);
	assert.equal(up.calls[0].url, `${ADMIN_API}/newsletter`);
	assert.equal(up.calls[0].init.headers.Authorization, 'Bearer k-test');
	assert.deepEqual(up.calls[0].body, { email: 'ana@ex.be', name: 'Ana', source: 'blondel:home:fr', honeypot: '' });
});

test('lead : source par défaut « site-web »', async () => {
	const up = upstream();
	await createLeadHandler({ apiKey: key })({ request: req({ email: 'a@b.be' }), fetch: up.fetch });
	assert.equal(up.calls[0].body.source, 'site-web');
});

test('lead : leurre rempli → 200 sans appel amont', async () => {
	const up = upstream();
	const res = await createLeadHandler({ apiKey: key })({
		request: req({ email: 'a@b.be', [HONEYPOT_FIELD]: 'spam' }),
		fetch: up.fetch
	});
	assert.equal(res.status, 200);
	assert.equal(up.calls.length, 0);
});

test('lead : corps invalide / email invalide → 400', async () => {
	const up = upstream();
	const h = createLeadHandler({ apiKey: key });
	assert.equal((await h({ request: req('pas du json'), fetch: up.fetch })).status, 400);
	assert.equal((await h({ request: req({ email: 'nope' }), fetch: up.fetch })).status, 400);
	assert.equal(up.calls.length, 0);
});

test('lead : clé absente → 500, jamais de faux succès', async () => {
	const up = upstream();
	const res = await createLeadHandler({ apiKey: () => undefined })({ request: req({ email: 'a@b.be' }), fetch: up.fetch });
	assert.equal(res.status, 500);
	assert.equal(up.calls.length, 0);
});

test('lead : 429 amont → 429 ; échec amont → 502', async () => {
	const h = createLeadHandler({ apiKey: key });
	assert.equal((await h({ request: req({ email: 'a@b.be' }), fetch: upstream(429, {}).fetch })).status, 429);
	assert.equal((await h({ request: req({ email: 'a@b.be' }), fetch: upstream(401, { error: 'x' }).fetch })).status, 502);
	assert.equal((await h({ request: req({ email: 'a@b.be' }), fetch: upstream(200, { ok: false }).fetch })).status, 502);
});

test('lead : fetch qui lève → 500', async () => {
	const res = await createLeadHandler({ apiKey: key })({
		request: req({ email: 'a@b.be' }),
		fetch: async () => {
			throw new Error('réseau');
		}
	});
	assert.equal(res.status, 500);
});

test('feedback : relaie form_type + message, email optionnel', async () => {
	const up = upstream();
	const h = createFeedbackHandler({ apiKey: key, formType: 'gen_schema' });
	const res = await h({ request: req({ message: '  Super outil  ' }), fetch: up.fetch });
	assert.equal(res.status, 200);
	assert.equal(up.calls[0].url, `${ADMIN_API}/submit`);
	assert.deepEqual(up.calls[0].body, { form_type: 'gen_schema', data: { email: '', message: 'Super outil' }, honeypot: '' });
});

test('feedback : message vide → 400 ; email rempli invalide → 400', async () => {
	const up = upstream();
	const h = createFeedbackHandler({ apiKey: key, formType: 'gen_schema' });
	assert.equal((await h({ request: req({ message: '   ' }), fetch: up.fetch })).status, 400);
	assert.equal((await h({ request: req({ message: 'ok', email: 'nope' }), fetch: up.fetch })).status, 400);
	assert.equal(up.calls.length, 0);
});

test('feedback : message tronqué à 5000 caractères', async () => {
	const up = upstream();
	await createFeedbackHandler({ apiKey: key, formType: 'gen_schema' })({
		request: req({ message: 'x'.repeat(6000) }),
		fetch: up.fetch
	});
	assert.equal(up.calls[0].body.data.message.length, 5000);
});

test('feedback : `formType` obligatoire', () => {
	assert.throws(() => createFeedbackHandler({ apiKey: key }));
});
