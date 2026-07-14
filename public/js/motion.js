'use strict';

/**
 * La parte de la capa de movimiento que necesita JavaScript (el resto es CSS:
 * public/css/motion.css). Tres cosas, ninguna imprescindible: si este archivo no
 * llegara a cargar, la app funciona igual, solo que más seca.
 *
 *   1. La barra de carga de navegación (el hueco entre pantalla y pantalla).
 *   2. El skeleton de los avatares mientras la foto viaja por la red.
 *   3. El destape del arte de las fichas de cosméticos.
 *
 * Expone `window.motion` para que las demás páginas puedan pintar skeletons
 * (amigos lo usa al buscar) sin tener que repetir el HTML ni consultar la
 * preferencia por su cuenta.
 */
(function () {
  const root = document.documentElement;

  // La preferencia del perfil (data-motion) y el ajuste del sistema. El sistema
  // manda: si el dispositivo pide menos movimiento, no hay movimiento, diga lo
  // que diga el perfil. (El CSS hace la misma lectura; esto es para el JS.)
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const enabled = () => root.dataset.motion !== 'off' && !prefersReduced.matches;

  // ---- 1. Barra de carga de navegación --------------------------------------

  /**
   * En una app de páginas del servidor, al pulsar un enlace el navegador SE QUEDA
   * en la página vieja mientras pide la nueva. Con buena red son 100ms y no se
   * nota; con mala red son segundos en los que no pasa nada en pantalla y la app
   * parece rota. Esta barra ocupa esa espera.
   *
   * Solo aparece si la navegación TARDA (SHOW_AFTER). Una barra que parpadea en
   * cada clic instantáneo es ruido: el usuario la registra como un fallo, no como
   * una respuesta. Si la red va bien, esto no se ve nunca, que es la intención.
   */
  const SHOW_AFTER = 220; // ms de espera antes de admitir que esto va lento

  let bar = null;
  let showTimer = null;
  let creepTimer = null;
  let progress = 0;

  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement('div');
    bar.className = 'nav-progress';
    bar.setAttribute('aria-hidden', 'true'); // el progreso real ya lo canta el navegador
    const inner = document.createElement('div');
    inner.className = 'nav-progress-bar';
    bar.appendChild(inner);
    document.body.appendChild(bar);
    return bar;
  }

  function setProgress(value) {
    progress = Math.min(value, 0.92); // nunca llega al final: no sabemos cuánto falta
    ensureBar().firstChild.style.transform = `scaleX(${progress})`;
  }

  function startNavProgress() {
    if (showTimer || creepTimer) return; // ya hay una navegación en marcha

    showTimer = setTimeout(() => {
      showTimer = null;
      const el = ensureBar();
      setProgress(0.3);
      el.classList.add('is-active');

      // Avanza a trompicones y cada vez menos, como quien no sabe cuánto queda.
      // Si avanzara a ritmo constante, prometería un final que no puede cumplir.
      creepTimer = setInterval(() => setProgress(progress + (0.92 - progress) * 0.12), 400);
    }, SHOW_AFTER);
  }

  function stopNavProgress() {
    clearTimeout(showTimer);
    clearInterval(creepTimer);
    showTimer = null;
    creepTimer = null;
    if (!bar) return;
    bar.classList.remove('is-active');
    setProgress(0);
  }

  // Navegación empezada: cualquier clic en un enlace de la propia app, y también
  // los formularios (guardar el perfil, crear un hábito) que acaban en redirect.
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link || e.defaultPrevented) return;
    // Descartar lo que NO es una navegación de esta pestaña: teclas modificadoras
    // (abrir en otra pestaña), target propio, descargas, otro origen, y los
    // enlaces a un ancla de la misma página.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (link.target && link.target !== '_self') return;
    if (link.hasAttribute('download')) return;

    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.href.split('#')[0] === location.href.split('#')[0]) return;

    startNavProgress();
  });

  document.addEventListener('submit', (e) => {
    if (!e.defaultPrevented) startNavProgress();
  });

  // Y navegación terminada. `pageshow` cubre el caso de volver ATRÁS: el
  // navegador restaura la página desde su caché tal y como la dejó —con la barra
  // a medias, si no la quitáramos aquí.
  window.addEventListener('pageshow', stopNavProgress);
  window.addEventListener('pagehide', stopNavProgress);

  // ---- 2. Skeleton de los avatares ------------------------------------------

  /**
   * La foto del avatar viaja por la red, así que hay un rato en el que no está.
   * El skeleton lo pone el SERVIDOR (la clase `is-loading` sale ya en el HTML,
   * ver partials/avatar.ejs) y aquí se quita al cargar la imagen. Al revés —que
   * lo pusiera este script— habría un parpadeo: entre que se pinta el HTML y
   * corre el JS (que va con `defer`) se vería el hueco vacío, y el skeleton
   * aparecería DESPUÉS, justo cuando ya no hace falta.
   *
   * `img.complete` es la comprobación que de verdad importa: si la imagen venía
   * de la caché, ya está cargada antes de que este script exista y el evento
   * `load` no se va a disparar nunca. Sin esa rama, los avatares cacheados se
   * quedarían en skeleton para siempre.
   */
  function watchAvatar(img) {
    if (img.dataset.skWatched) return;
    img.dataset.skWatched = '1';

    if (img.complete && img.naturalWidth > 0) {
      img.classList.remove('is-loading'); // ya estaba (caché): sin fundido, es instantáneo
      return;
    }

    img.classList.add('is-loading'); // por si el nodo viene de un re-render
    const done = () => {
      img.classList.remove('is-loading');
      img.classList.add('is-ready');
    };
    img.addEventListener('load', done, { once: true });
    // Si la imagen falla, se quita el skeleton igual: un hueco brillando para
    // siempre miente más que un avatar roto.
    img.addEventListener('error', done, { once: true });
  }

  function watchAvatars(scope) {
    (scope || document).querySelectorAll('img.avatar').forEach(watchAvatar);
  }

  // ---- 3. Arte de las fichas de cosméticos ----------------------------------

  /**
   * El arte de una ficha (marcos, fondos, títulos) es CSS, no imágenes: no viaja
   * por la red, pero en un móvil lento tarda en estar pintada, y hasta entonces se
   * ve el hueco vacío. El partial las marca con `is-art-pending` y aquí se
   * destapan cuando la página ya tiene sus estilos y sus fuentes: ese es el
   * momento en que el arte se puede pintar entera y de una vez.
   */
  function revealTileArt() {
    document.querySelectorAll('.col-item-art.is-art-pending').forEach((art) => {
      art.classList.remove('is-art-pending');
    });
  }

  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  // El `load` de la ventana (no DOMContentLoaded): queremos los estilos aplicados,
  // no solo el HTML leído.
  const windowLoaded = new Promise((resolve) => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve, { once: true });
  });

  Promise.all([fontsReady, windowLoaded]).then(revealTileArt);
  // Red de seguridad: si algo de lo anterior no resuelve (una fuente que nunca
  // llega), el arte se destapa igual. Preferimos verla sin gracia que no verla.
  setTimeout(revealTileArt, 3000);

  // ---- 4. Revelado por componente -------------------------------------------

  /**
   * Cada componente entra al asomar por la pantalla, no todos al cargar. Los
   * estados los pinta motion.css (`rv` = escondido esperando turno, `rv-in` =
   * adelante); aquí solo se decide a quién le toca y cuándo.
   *
   * QUÉ se revela. La lista es de componentes, no de páginas: una ficha de la
   * tienda, una tarjeta del feed, una fila de la lista de amigos. Así una página
   * nueva hereda el comportamiento sin tocar nada, siempre que use las piezas de
   * siempre.
   */
  const REVEAL = [
    '.tracker-list > *', // inicio: los hábitos de hoy
    '.habit-list > *', // hábitos
    '.stats-row > *',
    '.fa-list > *', // inicio: actividad de los amigos
    '.quick-links > *',
    '.col-grid > .col-item', // tienda y colección: cada ficha
    '.feed > .feed-item', // amigos: el feed
    '.user-list > .user-row', // amigos: mis amigos, solicitudes, descubrir
    '.ach-grid > .ach-badge', // perfil: los logros
    '.changelog-list > .changelog-entry', // novedades
    'main > .card', // secciones sueltas (perfil, historial, tienda…)
    '.pg-col > .card', // perfil: las tarjetas de cada columna
  ].join(',');

  let observer = null;

  function onReveal(entries, obs) {
    // Los que asoman A LA VEZ (al cargar, o una rejilla entera al llegar a ella)
    // entran en cascada, por orden de aparición en la página. En orden del DOM y
    // no en el que los devuelva el observador, que no promete ninguno.
    const shown = entries.filter((e) => e.isIntersecting).map((e) => e.target);
    shown.sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );

    shown.forEach((el, i) => {
      // El retraso se corta a la novena: más allá, el último de una rejilla larga
      // esperaría tanto que parecería que no ha cargado.
      el.style.setProperty('--rv-i', Math.min(i, 8));
      el.classList.remove('rv');
      el.classList.add('rv-in');
      obs.unobserve(el); // se entra una vez; al volver a subir no se repite

      // Y cuando ha entrado, se le quita hasta la clase: el elemento queda
      // exactamente como estaba antes de que existiera todo esto.
      //
      // No es limpieza cosmética. Una animación CSS vuelve a arrancar si el
      // elemento se REINSERTA en el DOM, y eso pasa de verdad: al arrastrar un
      // hábito para reordenarlo, la tarjeta se mueve de sitio en la lista. Con la
      // clase puesta, volvería a entrar desde `opacity: 0` en mitad del arrastre
      // —la tarjeta desapareciendo bajo el dedo—. Sin clase, no hay animación que
      // reiniciar.
      el.addEventListener(
        'animationend',
        (ev) => {
          if (ev.animationName === 'rv-in') el.classList.remove('rv-in');
        },
        { once: true }
      );
    });
  }

  /**
   * Prepara los componentes de `scope` (por defecto, la página entera). Se puede
   * llamar otra vez con lo que acabe de aparecer: los que ya estaban preparados
   * se ignoran.
   */
  function reveal(scope) {
    // Con el movimiento apagado no se esconde NADA. Es importante que la salida
    // sea esta y no "esconder y revelar al instante": si el observador fallara,
    // lo escondido se quedaría escondido.
    if (!enabled()) return;

    const armed = [];
    (scope || document).querySelectorAll(REVEAL).forEach((el) => {
      if (el.dataset.rvArmed) return;

      // Cuando un componente CONTIENE otros de la lista, entran los de dentro y
      // no él. Gana siempre el grano más fino, y por eso esta comprobación mira
      // hacia abajo y no hacia arriba.
      //
      // El caso que lo explica es la tienda: cada sección es una `main > .card`
      // (está en la lista) y dentro lleva sus fichas (también). Si entrara la
      // sección, las fichas viajarían dentro de ella como un bloque y no se
      // vería lo que se busca —cada ficha apareciendo a su tiempo—, sino un
      // panel gris haciendo un fundido. Igual en los logros del perfil.
      if (el.querySelector(REVEAL)) return;

      el.dataset.rvArmed = '1';
      el.classList.add('rv');
      armed.push(el);
    });

    if (!armed.length) return;
    if (!observer) {
      observer = new IntersectionObserver(onReveal, {
        // Un pelín DENTRO de la pantalla: el componente entra cuando ya se ve que
        // llega, no justo al rozar el borde (donde el usuario se perdería la
        // animación por el rabillo del ojo).
        rootMargin: '0px 0px -6% 0px',
        threshold: 0.02,
      });
    }
    armed.forEach((el) => observer.observe(el));
  }

  // ---- API para el resto de páginas -----------------------------------------

  /**
   * Filas de usuario de mentira, del tamaño exacto de las de verdad. Se usan
   * mientras vuela un fetch que va a devolver una lista de gente (buscar amigos).
   * Devuelve HTML y no nodos porque los sitios donde se usan pintan con innerHTML.
   */
  function userRowsHTML(count) {
    const row = `
      <div class="sk-user-row">
        <div class="sk sk-avatar"></div>
        <div class="sk-user-id">
          <div class="sk sk-line sk-name"></div>
          <div class="sk sk-line sk-line-sm sk-handle"></div>
        </div>
        <div class="sk sk-action"></div>
      </div>`;
    return `<div class="user-list card" aria-busy="true">${row.repeat(count)}</div>`;
  }

  window.motion = {
    enabled,
    watchAvatars,
    reveal,
    skeletonUserRows: userRowsHTML,
  };

  // Los avatares y los componentes que ya están en la página. Los que lleguen
  // después (una lista re-pintada) los engancha quien los pinte, llamando a
  // window.motion.watchAvatars() y window.motion.reveal().
  watchAvatars(document);
  reveal(document);
})();
