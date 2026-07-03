'use strict';

const { levelProgress } = require('../utils/level');

/**
 * Página de inicio: landing pública para invitados, o el hogar del usuario
 * autenticado. El dashboard completo llegará en su milestone; por ahora es un
 * recibimiento cálido con el progreso de nivel.
 */
function index(req, res) {
  if (!req.user) {
    return res.render('pages/landing', { title: 'Tracker — hábitos, a tu ritmo' });
  }
  return res.render('pages/home', {
    title: 'Inicio',
    progress: levelProgress(req.user.xp),
  });
}

module.exports = { index };
