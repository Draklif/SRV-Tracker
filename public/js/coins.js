(function () {
  'use strict';

  /**
   * El saldo de monedas, en un solo sitio. Vive en el nav (y en la cabecera de
   * la tienda), así que cualquier página puede hacerlo subir o bajar sin tener
   * que saber dónde está pintado ni escarbar en el DOM.
   *
   * El servidor es la verdad: esto solo mantiene al día lo que se ve mientras no
   * se recarga.
   */
  function nodes() {
    return document.querySelectorAll('[data-coin-value]');
  }

  function get() {
    const el = document.querySelector('[data-coin-value]');
    const n = el ? Number(el.textContent.replace(/\D/g, '')) : 0;
    return Number.isFinite(n) ? n : 0;
  }

  function set(n) {
    nodes().forEach((el) => {
      el.textContent = String(n);
    });
  }

  function add(n) {
    set(get() + n);
  }

  window.coins = { get, set, add };
})();
