'use strict';

/**
 * Controlador de páginas públicas (landing). Fino: solo elige qué renderizar.
 */

function landing(req, res) {
  res.render('pages/landing', { title: 'Tracker — hábitos, a tu ritmo' });
}

module.exports = { landing };
