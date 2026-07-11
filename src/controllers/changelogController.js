'use strict';

const changelogService = require('../services/changelogService');

/** GET /novedades — notas de parche. Visitarla marca al usuario al día. */
const page = (req, res) => {
  // Qué es nuevo *para él* se calcula antes de marcarlo como visto.
  const entries = changelogService.entriesFor(req.user);
  changelogService.markSeen(req.user.id);

  // loadUser ya corrió con el valor viejo: sin esto, el punto de aviso seguiría
  // pintado en la navegación de esta misma respuesta.
  res.locals.hasUnseenChangelog = false;

  res.render('pages/changelog', { title: 'Novedades', entries });
};

module.exports = { page };
