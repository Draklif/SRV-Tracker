'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');

const config = require('./config');
const constants = require('./config/constants');
const schedule = require('./utils/schedule');
const cosmeticsService = require('./services/cosmeticsService');
const { asset } = require('./utils/assets');
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
  // Conecta los subscribers del bus de eventos (gamificación, feed, recursos).
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

  // Manifest de la PWA. Se sirve desde una ruta (antes que express.static, que si
  // no se lo quedaría él) para inyectar los iconos con `?v=<hash>`.
  //
  // Es lo que hace que un cambio de icono llegue de verdad al móvil: si el icono
  // se sirviera siempre desde `/icons/icon-192.png`, un cliente que ya tuviera esa
  // URL en caché no volvería a pedirla —la cree fresca— y seguiría enseñando el
  // icono viejo. Con el hash la URL es nueva, así que no puede tener nada cacheado.
  const manifestFile = path.join(__dirname, '..', 'public', 'manifest.webmanifest');
  app.get('/manifest.webmanifest', (req, res) => {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    manifest.icons = manifest.icons.map((icon) => ({ ...icon, src: asset(icon.src) }));
    res.type('application/manifest+json');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(JSON.stringify(manifest, null, 2));
  });

  // Estáticos: CSS, JS, iconos, imágenes y subidas.
  //
  // Las vistas piden los estáticos con `?v=<hash del contenido>` (utils/assets),
  // así que una URL con `?v` es inmutable por definición: si el archivo cambia,
  // cambia la URL. Eso permite cachearla un año y arregla el problema de que los
  // móviles se quedaran con el CSS/JS viejo hasta una semana.
  //
  // Lo que llega sin `?v` (sw.js, el manifest y los iconos que este referencia)
  // debe revalidar siempre: son URLs fijas que sí cambian de contenido, y si el
  // cliente las cachea se queda clavado en la versión anterior.
  app.use(
    express.static(path.join(__dirname, '..', 'public'), {
      setHeaders(res, filePath) {
        if (!config.isProd) {
          res.setHeader('Cache-Control', 'no-store');
        } else if (res.req.query && res.req.query.v) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.includes(`${path.sep}uploads${path.sep}`)) {
          // Los avatares ya llevan timestamp en el nombre, nunca se reescriben.
          res.setHeader('Cache-Control', 'public, max-age=604800');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );

  // El HTML (y las respuestas de la API) nunca se cachean: son personales y
  // deben reflejar el estado actual. Además es lo que cierra el círculo del cache
  // busting — si el móvil cacheara el HTML, seguiría pidiendo los estáticos con
  // el `?v=` antiguo. `no-cache` obliga a revalidar, pero deja que el ETag
  // responda 304 cuando la página no ha cambiado.
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, private');
    next();
  });

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
  // Resuelve los cosméticos equipados de CUALQUIER fila de usuario que traiga la
  // columna `cosmetics`. Va en locals (y no en cada controlador) porque el
  // avatar se pinta en el feed, en las listas y en la nav.
  app.locals.cosmeticsFor = cosmeticsService.resolve;
  app.locals.cosmeticRarities = cosmeticsService.RARITIES; // color de cada rareza
  app.locals.cosmeticCardClasses = cosmeticsService.cardClasses; // clases de la tarjeta
  app.locals.cosmeticFrameClasses = cosmeticsService.frameWrapClasses; // gap/borde del marco
  app.locals.schedule = schedule; // helpers de frecuencia para las vistas
  app.locals.vapidPublicKey = config.push.vapidPublic; // para suscribirse a Web Push
  app.locals.asset = asset; // estáticos con hash de contenido (cache busting)

  // Rutas de la aplicación.
  app.use('/', routes);

  // 404 y manejador de errores (siempre al final).
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
