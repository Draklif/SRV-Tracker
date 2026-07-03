'use strict';

/**
 * 404: si la ruta no existe. Responde JSON para /api y HTML para el resto.
 */
module.exports = function notFound(req, res) {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'No encontrado' });
  }
  return res.status(404).render('pages/error', {
    title: 'Página no encontrada',
    status: 404,
    message: 'No encontramos esta página. Pero aquí sigues, y eso está bien 🌿',
  });
};
