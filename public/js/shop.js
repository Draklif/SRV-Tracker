(function () {
  'use strict';

  /**
   * Tienda: pedir un objeto, confirmarlo y pagarlo.
   *
   * El servidor decide el precio, el saldo y si ya lo tienes. Esto solo pinta lo
   * que ya sabe y refleja la respuesta. Si la respuesta no cuadra con la foto que
   * tenía el cliente (un 409), se recarga: quien estaba desactualizado era él.
   */
  const page = document.querySelector('.shop-page');
  if (!page) return;

  const panel = document.getElementById('shop-confirm');
  if (!panel) return;

  const nameEl = panel.querySelector('[data-confirm-name]');
  const priceEl = panel.querySelector('[data-confirm-price]');
  const leftEl = panel.querySelector('[data-confirm-left]');
  const acceptBtn = panel.querySelector('[data-shop-accept]');

  let pending = null; // la ficha que se está comprando

  function closePanel() {
    panel.hidden = true;
    pending = null;
    acceptBtn.disabled = false;
    acceptBtn.textContent = 'Comprar';
  }

  function openPanel(tile) {
    pending = tile;
    const price = Number(tile.dataset.price);
    nameEl.textContent = tile.dataset.name;
    priceEl.textContent = String(price);
    leftEl.textContent = String(window.coins.get() - price);
    panel.hidden = false;
    acceptBtn.focus();
  }

  /**
   * Con el saldo nuevo, repasa TODAS las fichas: lo que antes no alcanzaba puede
   * seguir sin alcanzar (acabas de gastar), y hay que apagarlo. Sin esto, el
   * usuario pulsaría fichas que el servidor le va a rechazar.
   */
  function refreshAffordability(balance) {
    page.querySelectorAll('.col-item[data-price]').forEach((tile) => {
      if (tile.classList.contains('is-owned')) return;
      const affordable = Number(tile.dataset.price) <= balance;
      tile.classList.toggle('is-buyable', affordable);
      tile.classList.toggle('is-unaffordable', !affordable);
      tile.disabled = !affordable;
    });
  }

  /** La ficha comprada pasa a ser tuya: deja de venderse y luce su ✓. */
  function markOwned(tile) {
    tile.classList.remove('is-buyable', 'is-unaffordable');
    tile.classList.add('is-owned');
    tile.disabled = true;
    tile.title = `${tile.dataset.name} (ya es tuyo)`;

    const price = tile.querySelector('.col-item-price');
    if (price) {
      const check = document.createElement('span');
      check.className = 'col-item-check';
      check.textContent = '✓';
      price.replaceWith(check);
    }
  }

  page.addEventListener('click', (ev) => {
    const tile = ev.target.closest('.col-item[data-price]');
    if (!tile || tile.disabled) return;
    openPanel(tile);
  });

  // ---- Filtros -------------------------------------------------------------
  // El buscador, la rareza y las pills los monta cosmetic-filters.js: los mismos
  // que en la Colección. Lo propio de la Tienda es el bolsillo: qué puedo pagar.
  const onlyAffordable = page.querySelector('[data-shop-affordable]');

  const applyFilters = window.cosmeticFilters.init(page, {
    // "Solo lo que puedo comprar": ni lo que ya es tuyo ni lo que no te alcanza.
    extra: (tile) =>
      !(onlyAffordable && onlyAffordable.checked) || tile.classList.contains('is-buyable'),
  });

  if (onlyAffordable) onlyAffordable.addEventListener('change', applyFilters);

  panel.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-shop-cancel]')) closePanel();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !panel.hidden) closePanel();
  });

  acceptBtn.addEventListener('click', async () => {
    if (!pending) return;
    const tile = pending;

    acceptBtn.disabled = true;
    acceptBtn.textContent = 'Comprando…';

    try {
      const res = await window.api.post('/api/shop/buy', { itemKey: tile.dataset.key });
      closePanel();

      window.coins.set(res.balance);
      markOwned(tile);
      refreshAffordability(res.balance);
      // El saldo ha bajado: lo que ya no alcanza (y lo recién comprado) debe
      // desaparecer si el filtro "solo lo que puedo comprar" está puesto.
      applyFilters();

      window.toast.show(`¡${res.name} es tuyo! Póntelo en tu colección`, {
        type: 'success',
        duration: 3500,
      });
      window.toast.confetti();
    } catch (err) {
      closePanel();
      window.toast.show(err.message, { type: 'warn' });
      // 409 = el mundo no estaba como el cliente creía (ya lo tenías, o el saldo
      // cambió en otra pestaña). La foto está vieja: se pide una nueva.
      if (err.status === 409) setTimeout(() => window.location.reload(), 1200);
    }
  });
})();
