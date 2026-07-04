'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');

const config = require('./config');
const constants = require('./config/constants');
const schedule = require('./utils/schedule');
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
  // Conecta los subscribers del bus de eventos (gamificación, y en el futuro
  // feed, tiempo real, aldea…).
  require('./events/subscribers').registerAll();

  const app = express();

  // Detrás de Caddy (reverse proxy con TLS): confiar en el primer salto para
  // leer X-Forwarded-Proto. Sin esto, Express ve la conexión como HTTP y no
  // envía la cookie de sesión `secure`, rompiendo login/registro (CSRF).
  if (config.isProd) app.set('trust proxy', 1);

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

  // URL base y canónica para el <head> (og:url, og:image). Detrás de Caddy,
  // `trust proxy` hace que req.protocol sea https en producción. Se puede fijar
  // una URL canónica con PUBLIC_URL (config.site.url).
  app.use((req, res, next) => {
    const base = config.site.url || `${req.protocol}://${req.get('host')}`;
    res.locals.baseUrl = base;
    res.locals.canonicalUrl = base + req.originalUrl;
    next();
  });

  // Valores disponibles en todas las vistas.
  app.locals.appName = config.site.name;
  app.locals.siteDescription = config.site.description;
  app.locals.habitColors = constants.HABIT_COLORS;
  app.locals.habitTypeMeta = constants.HABIT_TYPE_META;
  app.locals.habitColorKeys = constants.HABIT_COLOR_KEYS;
  app.locals.habitIcons = constants.HABIT_ICON_SUGGESTIONS;
  app.locals.resourceTypeMeta = constants.RESOURCE_TYPE_META;
  app.locals.schedule = schedule; // helpers de frecuencia para las vistas

  // Rutas de la aplicación.
  app.use('/', routes);

  // 404 y manejador de errores (siempre al final).
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
