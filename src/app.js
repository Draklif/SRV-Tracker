'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');

const config = require('./config');
const constants = require('./config/constants');
const routes = require('./routes');
const sessionMiddleware = require('./middlewares/session');
const loadUser = require('./middlewares/loadUser');
const { csrfToken } = require('./middlewares/csrf');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

/**
 * Construye y configura la aplicación Express (sin arrancar el servidor).
 * Separar la creación del `listen` facilita las pruebas de integración.
 */
function createApp() {
  const app = express();

  // Vistas EJS.
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Cabeceras de seguridad. Usamos la CSP por defecto ('self', sin CDNs) pero
  // permitimos atributos `style` inline: son imprescindibles para valores
  // dinámicos como el ancho de las barras de progreso. `script-src` sigue
  // estricto ('self'), que es la superficie de XSS que de verdad importa.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'style-src-attr': ["'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
        },
      },
    })
  );

  // Parsers de body (formularios y JSON de la API).
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Estáticos: CSS, JS, iconos, imágenes y subidas.
  app.use(
    express.static(path.join(__dirname, '..', 'public'), {
      maxAge: config.isProd ? '7d' : 0,
    })
  );

  // Sesión → carga de usuario → token CSRF. En este orden porque loadUser y el
  // token CSRF dependen de la sesión, y las vistas necesitan `user` y `csrfToken`.
  app.use(sessionMiddleware);
  app.use(loadUser);
  app.use(csrfToken);

  // Valores disponibles en todas las vistas.
  app.locals.appName = 'Tracker';
  app.locals.habitColors = constants.HABIT_COLORS;
  app.locals.habitTypeMeta = constants.HABIT_TYPE_META;
  app.locals.habitColorKeys = constants.HABIT_COLOR_KEYS;
  app.locals.habitIcons = constants.HABIT_ICON_SUGGESTIONS;

  // Rutas de la aplicación.
  app.use('/', routes);

  // 404 y manejador de errores (siempre al final).
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
