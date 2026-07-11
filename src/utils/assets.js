'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = require('../config');

const PUBLIC_DIR = path.join(config.rootDir, 'public');

// Hash por archivo, calculado la primera vez que una vista lo pide.
const cache = new Map();

function hashOf(publicPath) {
  try {
    const buf = fs.readFileSync(path.join(PUBLIC_DIR, publicPath));
    return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
  } catch (_) {
    // Si el archivo no existe (ruta mal escrita), devolvemos la URL tal cual en
    // vez de reventar el render.
    return null;
  }
}

/**
 * URL de un estático con el hash de su contenido: `/css/base.css?v=9fdc1a2b3c`.
 *
 * Es el cache busting de la app: si el archivo cambia, cambia su URL, así que el
 * navegador (sobre todo en móvil, donde el caché es agresivo y no hay forma
 * cómoda de hacer hard-refresh) está obligado a descargar la versión nueva. A
 * cambio, `app.js` puede servir las URLs con hash como inmutables.
 *
 * En desarrollo el hash se recalcula en cada petición para que editar un CSS se
 * vea sin reiniciar el servidor.
 */
function asset(publicPath) {
  let v;
  if (config.isProd) {
    if (!cache.has(publicPath)) cache.set(publicPath, hashOf(publicPath));
    v = cache.get(publicPath);
  } else {
    v = hashOf(publicPath);
  }
  return v ? `${publicPath}?v=${v}` : publicPath;
}

module.exports = { asset };
