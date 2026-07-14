'use strict';

/**
 * Los filtros del catálogo de cosméticos, compartidos por la Colección y la
 * Tienda (partials/cosmetic-filters.ejs). Todo el catálogo ya está pintado en la
 * página, así que filtrar es solo esconder: ni una petición ni una recarga.
 *
 * Cada página añade su propio criterio con `extra` (la Colección: "ocultar los
 * que no tengo"; la Tienda: "solo lo que puedo comprar") y recibe de vuelta un
 * `apply()` para repasar la rejilla cuando cambie algo suyo (p. ej. tras comprar,
 * que baja el saldo y cambia lo que se puede pagar).
 */
(function () {
  /** Quita acentos y mayúsculas: buscar "neon" debe encontrar "Neón". */
  function normalize(s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Engancha la barra a la rejilla de `page`.
   * @param {HTMLElement} page contenedor con la barra y los `.col-slot`
   * @param {{ extra?: (tile: HTMLElement) => boolean }} opts criterio propio de la página
   * @returns {() => void} vuelve a aplicar los filtros
   */
  function init(page, opts) {
    const options = opts || {};
    const extra = options.extra || (() => true);

    const search = page.querySelector('[data-cos-search]');
    const rarity = page.querySelector('[data-cos-rarity]');
    const pills = page.querySelectorAll('[data-cos-slot]');
    const empty = page.querySelector('[data-cos-empty]');

    let slot = ''; // categoría elegida; '' = todas

    function matches(tile, term, rare) {
      if (slot && tile.dataset.slot !== slot) return false;
      if (rare && tile.dataset.rarity !== rare) return false;
      if (term && !normalize(tile.dataset.name).includes(term)) return false;
      return extra(tile);
    }

    function apply() {
      const term = normalize(search && search.value.trim());
      const rare = (rarity && rarity.value) || '';
      let total = 0;

      page.querySelectorAll('.col-slot').forEach((section) => {
        let visible = 0;
        section.querySelectorAll('.col-item').forEach((tile) => {
          const show = matches(tile, term, rare);
          tile.classList.toggle('is-filtered', !show);
          if (show) visible += 1;
        });
        section.classList.toggle('is-filtered', visible === 0);
        total += visible;
      });

      if (empty) empty.hidden = total > 0;
    }

    if (search) search.addEventListener('input', apply);
    if (rarity) rarity.addEventListener('change', apply);

    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        // Volver a pulsar la categoría que ya está puesta la quita: se vuelve a
        // "Todos" sin tener que ir a buscarlo.
        slot = pill.dataset.cosSlot === slot ? '' : pill.dataset.cosSlot;
        pills.forEach((p) => {
          const on = p.dataset.cosSlot === slot;
          p.classList.toggle('is-active', on);
          p.setAttribute('aria-pressed', String(on));
        });
        apply();
      });
    });

    apply();
    return apply;
  }

  window.cosmeticFilters = { init, normalize };
})();
