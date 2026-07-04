'use strict';

/**
 * Renderiza una vista/parcial a string (sin enviarla) usando el contexto de la
 * respuesta, de modo que `res.locals` (user, csrfToken, app.locals…) esté
 * disponible. Permite que la API devuelva HTML ya renderizado y así el markup
 * de las tarjetas viva en un solo sitio (EJS), no duplicado en el cliente.
 */
module.exports = function renderPartial(res, view, locals = {}) {
  return new Promise((resolve, reject) => {
    res.render(view, locals, (err, html) => (err ? reject(err) : resolve(html)));
  });
};
