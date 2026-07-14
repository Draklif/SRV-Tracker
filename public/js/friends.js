'use strict';

/**
 * Hub de amigos: pestañas + acciones (agregar/aceptar/rechazar/cancelar/quitar).
 * Cada mutación va a /api/friends/*; en el hub la respuesta trae las tres listas
 * re-renderizadas (amigos, solicitudes, directorio) y las intercambiamos, de modo
 * que todas las pestañas quedan sincronizadas sin recargar. En el perfil
 * (/u/:username) no hay listas: solo se actualiza el botón en el sitio.
 */
(function () {
  const hub = document.getElementById('friends-hub');
  if (!hub) return;

  const friendsBody = hub.querySelector('[data-friends-body]');
  const requestsBody = hub.querySelector('[data-requests-body]');
  const discoverBody = hub.querySelector('[data-discover-body]');
  const isHub = Boolean(friendsBody && requestsBody && discoverBody);
  const searchInput = hub.querySelector('.search-form input[name="q"]');

  // ---- Pestañas -------------------------------------------------------------
  const tabs = hub.querySelectorAll('.tab');
  const panels = hub.querySelectorAll('.tab-panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
      panels.forEach((p) => {
        const on = p.dataset.panel === name;
        p.classList.toggle('is-active', on);
        p.hidden = !on;
      });
    });
  });

  // ---- Badges y contadores --------------------------------------------------
  function setPending(count) {
    document.querySelectorAll('[data-nav-friend-badge]').forEach((b) => {
      b.textContent = count;
      b.hidden = count <= 0;
    });
    const tabBadge = hub.querySelector('[data-requests-badge]');
    if (tabBadge) {
      tabBadge.textContent = count;
      tabBadge.hidden = count <= 0;
    }
  }

  function setFriendsCount(count) {
    const el = hub.querySelector('.tab[data-tab="friends"] .tab-count');
    if (el && typeof count === 'number') el.textContent = count;
  }

  // ---- Buscador en vivo (pestaña "Descubrir") -------------------------------
  // Filtra al teclear a partir de 3 letras; con el campo vacío vuelve al
  // directorio completo. Entre 1 y 2 letras no se toca la lista (demasiado ruido
  // para una consulta tan corta).
  const MIN_QUERY = 3;

  // Cuánto se le da a la búsqueda antes de admitir que va lenta y enseñar el
  // skeleton. Con red buena la respuesta llega antes y la lista NUNCA parpadea:
  // cambiar los resultados por bloques grises en cada tecla, para devolverlos
  // 80ms después, marearía más que esperar.
  const SKELETON_AFTER = 180;

  if (isHub && searchInput) {
    const form = searchInput.closest('.search-form');
    let timer = null;
    let seq = 0; // descarta respuestas que llegan tarde y pisarían a una más nueva

    // La última lista buena. Es a donde se vuelve si una búsqueda falla DESPUÉS
    // de haber pintado el skeleton: sin esto, un error de red dejaría la pestaña
    // en bloques grises para siempre.
    let lastGoodHtml = discoverBody.innerHTML;

    /** Pinta la lista y vuelve a enganchar los avatares que acaban de aparecer. */
    function paintDiscover(html) {
      discoverBody.innerHTML = html;
      lastGoodHtml = html;
      if (window.motion) {
        window.motion.watchAvatars(discoverBody);
        window.motion.reveal(discoverBody); // las filas nuevas entran una detrás de otra
      }
    }

    async function runSearch() {
      const q = searchInput.value.trim();
      if (q.length > 0 && q.length < MIN_QUERY) return;
      const mine = ++seq;

      // `mine === seq` también aquí dentro: si mientras esperábamos se ha lanzado
      // otra búsqueda, esta ya no manda y no debe pintar nada.
      const slow = setTimeout(() => {
        if (mine === seq && window.motion) {
          discoverBody.innerHTML = window.motion.skeletonUserRows(5);
        }
      }, SKELETON_AFTER);

      try {
        const res = await window.api.get(`/api/friends/directory?q=${encodeURIComponent(q)}`);
        if (mine === seq && res.discoverHtml != null) paintDiscover(res.discoverHtml);
      } catch (err) {
        if (mine === seq) paintDiscover(lastGoodHtml);
        if (window.toast) window.toast.show(err.message, { type: 'info' });
      } finally {
        clearTimeout(slow);
      }
    }

    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(runSearch, 250);
    });

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault(); // con JS no recargamos: buscamos en el sitio
        clearTimeout(timer);
        runSearch();
      });
    }
  }

  // ---- Acciones (delegadas) -------------------------------------------------
  function url(base) {
    if (!isHub) return base;
    const q = searchInput ? searchInput.value : '';
    return `${base}?hub=1&q=${encodeURIComponent(q)}`;
  }

  const endpoints = {
    request: (btn) => window.api.post(url('/api/friends/request'), { username: btn.dataset.username }),
    accept: (btn) => window.api.post(url(`/api/friends/${btn.dataset.friendshipId}/accept`)),
    decline: (btn) => window.api.post(url(`/api/friends/${btn.dataset.friendshipId}/decline`)),
    cancel: (btn) => window.api.post(url(`/api/friends/${btn.dataset.friendshipId}/cancel`)),
    remove: (btn) => window.api.del(url(`/api/friends/${btn.dataset.friendshipId}`)),
  };

  hub.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-friend-action]');
    if (!btn) return;
    const action = btn.dataset.friendAction;
    const row = btn.closest('.user-row');
    if (!endpoints[action] || !row) return;

    btn.disabled = true; // evita doble click mientras vuela la petición

    try {
      const res = await endpoints[action](btn);
      if (typeof res.pendingCount === 'number') setPending(res.pendingCount);

      if (isHub && res.friendsHtml != null) {
        // Re-render de todas las listas (mantiene las pestañas sincronizadas).
        const y = window.scrollY;
        friendsBody.innerHTML = res.friendsHtml;
        requestsBody.innerHTML = res.requestsHtml;
        discoverBody.innerHTML = res.discoverHtml;
        setFriendsCount(res.friendsCount);
        window.scrollTo(0, y);
        // Los avatares recién pintados vienen con su skeleton puesto (lo marca el
        // partial). Hay que engancharlos, o se quedarían en gris para siempre.
        // Y las filas nuevas, revelarlas: acaban de nacer y están escondidas.
        if (window.motion) {
          window.motion.watchAvatars(hub);
          window.motion.reveal(hub);
        }
      } else if (res.actionHtml) {
        // Perfil: solo se actualiza el botón en el sitio.
        const holder = row.querySelector('[data-row-action]');
        if (holder) holder.outerHTML = res.actionHtml;
      }
    } catch (err) {
      btn.disabled = false;
      if (window.toast) window.toast.show(err.message, { type: 'info' });
    }
  });
})();
