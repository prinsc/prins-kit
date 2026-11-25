// Fabrication numérique partagée des outils kltk (SlatShape, Blondel…) : géométrie 2D,
// compensation d'outil, imbrication sur plaques, DXF / SVG, G-code Mach3 et sa relecture.
// JS pur (aucun DOM, aucun Svelte), testé par `node --test`.
//
// Un outil qui ne veut PAS embarquer le générateur dans le navigateur (SlatShape : fichiers Pro
// fabriqués par le serveur) importe les sous-chemins (`@prinsc/prins-kit/cnc/nesting`…) au lieu
// de cette entrée.
export * from './geometry.js';
export * from './offset.js';
export * from './nesting.js';
export * from './dxf.js';
export * from './gcode.js';
export * from './gcode-parse.js';
