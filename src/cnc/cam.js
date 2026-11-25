/**
 * Réglages d'usinage du G-code (projet : `params.cam`). Séparés du générateur (`gcode.js`) :
 * un outil qui garde ses trajectoires sur le serveur (SlatShape) peut montrer les réglages
 * dans le navigateur sans y embarquer le générateur.
 */
export const CAM_DEFAULTS = {
	spindle: 18000, // tr/min
	feed: 0, // mm/min, 0 = avance conseillée de la matière
	plunge: 1200, // mm/min
	safeZ: 10, // mm au-dessus de la plaque
	overcut: 0.3, // mm dans le martyr
	tabs: true,
	tabLength: 10, // mm (hors diamètre de fraise)
	tabHeight: 3, // mm de matière laissée
	ramp: true,
	climb: true,
	origin: 'bl', // 'bl' coin bas gauche de la plaque, 'center'
	zZero: 'top', // 'top' dessus de la plaque, 'bed' dessus du martyr
	stepover: 0.45 // poches : pas latéral, en fraction du diamètre
};
