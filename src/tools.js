// Registre des outils kltk : SOURCE UNIQUE des liens entre outils (ToolSwitcher, liens
// « nos autres outils »). Ajouter un outil = une entrée ici + une version du kit.
//
// `url` = adresse du déploiement (sous-domaine). `langs` = langues que l'outil sait servir
// par `?lang=` : un lien n'emporte la langue courante que si la cible la connaît (sinon
// l'outil cible retomberait en français en silence, ou pire, servirait une URL inconnue).
// Les noms sont des noms propres ou des libellés courts, d'où leur place dans le kit, qui
// n'a pas d'autre texte traduit.

/** @typedef {'fr'|'nl'|'en'|'de'|'es'|'it'|'pt'} Lang */

export const TOOLS = [
	{
		id: 'blondel',
		url: 'https://blondel.kltk.be',
		icon: 'stairs',
		langs: ['fr', 'nl', 'en', 'de', 'es', 'it', 'pt'],
		name: 'Blondel',
		tagline: {
			fr: "Calcul d'escalier",
			nl: 'Trapberekening',
			en: 'Stair calculator',
			de: 'Treppenrechner',
			es: 'Cálculo de escaleras',
			it: 'Calcolo scale',
			pt: 'Cálculo de escadas'
		}
	},
	{
		id: 'gen-schema',
		url: 'https://gen-schema.kltk.be',
		icon: 'network',
		langs: ['fr', 'nl', 'en'],
		name: {
			fr: 'Schémas électriques',
			nl: "Elektrische schema's",
			en: 'Electrical schematics'
		},
		tagline: {
			fr: 'Position et unifilaire',
			nl: 'Situatie- en eendraadschema',
			en: 'Layout and single-line diagram'
		}
	}
];

/** Textes propres au sélecteur. Repli : anglais, puis français. */
export const SWITCHER_TEXT = {
	fr: { title: 'Outils kltk', all: 'Tous gratuits, sans compte', current: 'Outil actuel' },
	nl: { title: 'kltk-tools', all: 'Allemaal gratis, zonder account', current: 'Huidige tool' },
	en: { title: 'kltk tools', all: 'All free, no account', current: 'Current tool' },
	de: { title: 'kltk-Tools', all: 'Alle kostenlos, ohne Konto', current: 'Aktuelles Tool' },
	es: { title: 'Herramientas kltk', all: 'Todas gratis, sin cuenta', current: 'Herramienta actual' },
	it: { title: 'Strumenti kltk', all: 'Tutti gratuiti, senza account', current: 'Strumento attuale' },
	pt: { title: 'Ferramentas kltk', all: 'Todas grátis, sem cadastro', current: 'Ferramenta atual' }
};

/** Libellé localisé : chaîne simple (nom propre) ou objet par langue. */
export function pick(value, lang) {
	if (typeof value === 'string') return value;
	return value?.[lang] ?? value?.en ?? value?.fr ?? '';
}

/** Outil du registre, ou `undefined`. */
export function toolById(id) {
	return TOOLS.find((t) => t.id === id);
}

/**
 * Lien vers un outil, dans la langue courante si l'outil la connaît.
 * Le français est la langue par défaut de chaque outil : jamais de `?lang=fr`.
 */
export function toolHref(id, lang = 'fr') {
	const tool = toolById(id);
	if (!tool) return 'https://kltk.be';
	if (lang === 'fr' || !tool.langs.includes(lang)) return tool.url;
	return `${tool.url}/?lang=${lang}`;
}
