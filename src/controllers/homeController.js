'use strict';

const dashboardService = require('../services/dashboardService');
const { timeAgo } = require('../utils/format');

/**
 * Página de inicio: landing pública para invitados, o el dashboard con el
 * tracker diario para el usuario autenticado.
 */
function index(req, res) {
  if (!req.user) {
    return res.render('pages/landing', { title: 'Tracker — hábitos, a tu ritmo' });
  }
  const data = dashboardService.assemble(req.user);
  return res.render('pages/home', { title: 'Inicio', ...data, timeAgo });
}

module.exports = { index };
