(function () {
  'use strict';

  /**
   * Cajas: ver qué puede salir, comprarlas/abrirlas y escenificar la apertura
   * con un carrusel estilo Counter-Strike.
   *
   * El servidor decide SIEMPRE el resultado (la tirada, el cobro, el reembolso
   * de un duplicado). Esto solo lo enseña: monta un carrusel que frena justo en
   * el objeto que el servidor dijo que salió. Sin movimiento (motion off o
   * prefers-reduced-motion) se salta la animación y muestra el resultado.
   */
  const page = document.querySelector('.shop-page');
  if (!page) return;

  const preview = document.getElementById('lb-preview');
  const reveal = document.getElementById('lb-reveal');
  if (!preview || !reveal) return;

  const reduceMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.getAttribute('data-motion') === 'off';

  // Contrato con el HTML de la vista previa.
  const titleEl = preview.querySelector('[data-lb-title]');
  const descEl = preview.querySelector('[data-lb-desc]');
  const bodyEl = preview.querySelector('[data-lb-body]');
  const buyBtn = preview.querySelector('[data-lb-buy]');
  const purchaseBtn = preview.querySelector('[data-lb-purchase]');
  const buyPriceEl = preview.querySelector('[data-lb-buyprice]');
  const openBtn = preview.querySelector('[data-lb-open]');
  const ownCountEl = preview.querySelector('[data-lb-owncount]');

  // Envío a un amigo (puede no existir si no tienes amigos: entonces todo null).
  const actionsEl = preview.querySelector('[data-lb-actions]');
  const sendBtn = preview.querySelector('[data-lb-send]');
  const sendPanel = preview.querySelector('[data-lb-send-panel]');
  const friendSel = preview.querySelector('[data-lb-friend]');
  const sendBoxNameEl = preview.querySelector('[data-lb-send-box]');
  const sendConfirmBtn = preview.querySelector('[data-lb-send-confirm]');
  const sendCancelBtn = preview.querySelector('[data-lb-send-cancel]');

  // Contrato con el carrusel de apertura.
  const reel = reveal.querySelector('[data-lb-reel]');
  const viewport = reveal.querySelector('.lb-reel-viewport');
  const resultEl = reveal.querySelector('[data-lb-result]');
  const againBtn = reveal.querySelector('[data-lb-again]');
  const revealCloseBtn = reveal.querySelector('[data-lb-reveal-close]');

  let current = null; // { key, name, price, card }

  function tpl(boxKey) {
    return document.querySelector(`.lb-tpl[data-box="${boxKey}"]`);
  }

  // ---- Vista previa -------------------------------------------------------
  function openPreview(card) {
    const boxKey = card.dataset.box;
    const t = tpl(boxKey);
    if (!t) return;

    current = {
      key: boxKey,
      name: card.dataset.name,
      price: Number(card.dataset.price),
      card,
    };

    titleEl.textContent = card.dataset.name;
    descEl.textContent = t.dataset.desc || '';
    bodyEl.replaceChildren(t.content.cloneNode(true));

    buyPriceEl.textContent = String(current.price);
    const affordable = card.dataset.affordable === '1';
    buyBtn.disabled = !affordable;
    purchaseBtn.disabled = !affordable;
    buyBtn.title = affordable ? '' : 'No te alcanzan las monedas';
    purchaseBtn.title = affordable ? '' : 'No te alcanzan las monedas';

    const owned = Number(card.dataset.owned) || 0;
    if (owned > 0) {
      openBtn.hidden = false;
      ownCountEl.textContent = String(owned);
    } else {
      openBtn.hidden = true;
    }

    // Enviar solo tiene sentido con una caja que YA tienes: se regala del
    // inventario (sin cobro). Por eso el botón aparece únicamente si tienes ≥1.
    if (sendBtn) sendBtn.hidden = owned <= 0;
    closeSend(); // por si el modal se reabre estando en modo envío

    preview.hidden = false;
    buyBtn.focus();
  }

  function closePreview() {
    preview.hidden = true;
    closeSend();
  }

  // ---- Enviar a un amigo --------------------------------------------------
  function openSend() {
    if (!sendPanel || !current) return;
    if (sendBoxNameEl) sendBoxNameEl.textContent = current.name;
    if (bodyEl) bodyEl.hidden = true;
    if (actionsEl) actionsEl.hidden = true;
    sendPanel.hidden = false;
    if (friendSel) friendSel.focus();
  }

  function closeSend() {
    if (!sendPanel) return;
    sendPanel.hidden = true;
    if (bodyEl) bodyEl.hidden = false;
    if (actionsEl) actionsEl.hidden = false;
    if (sendConfirmBtn) {
      sendConfirmBtn.disabled = false;
      sendConfirmBtn.textContent = 'Enviar regalo';
    }
  }

  if (sendBtn) sendBtn.addEventListener('click', openSend);
  if (sendCancelBtn) sendCancelBtn.addEventListener('click', closeSend);
  if (sendConfirmBtn) {
    sendConfirmBtn.addEventListener('click', async () => {
      if (!current) return;
      sendConfirmBtn.disabled = true;
      sendConfirmBtn.textContent = 'Enviando…';
      try {
        const res = await window.api.post('/api/gifts/send', {
          recipientId: friendSel.value,
          key: current.key,
        });
        // La caja sale de TU inventario: baja el contador de la tarjeta.
        setCardOwned(current.card, Math.max(0, (Number(current.card.dataset.owned) || 0) - 1));
        closePreview();
        window.toast.show(`Regalo enviado: ${res.label} 🎁`, { type: 'success', duration: 3500 });
      } catch (err) {
        sendConfirmBtn.disabled = false;
        sendConfirmBtn.textContent = 'Enviar regalo';
        window.toast.show(err.message, { type: 'warn' });
        if (err.status === 409) setTimeout(() => window.location.reload(), 1200);
      }
    });
  }

  page.addEventListener('click', (ev) => {
    const card = ev.target.closest('.lb-card');
    if (card) openPreview(card);
  });

  preview.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-lb-close]')) closePreview();
  });

  // ---- Apertura -----------------------------------------------------------
  function poolClones(boxKey) {
    const t = tpl(boxKey);
    return t ? Array.from(t.content.querySelectorAll('.lb-pool-item')) : [];
  }

  function findWinner(pool, key) {
    return pool.find((n) => n.dataset.key === key) || pool[0];
  }

  /** Monta el carrusel y lo frena en la ficha ganadora. Devuelve una promesa. */
  function spin(boxKey, wonKey) {
    const pool = poolClones(boxKey);
    if (!pool.length) return Promise.resolve();

    const WIN_INDEX = 44; // cuántas fichas corren antes de la premiada
    reel.replaceChildren();
    reel.style.transition = 'none';
    reel.style.transform = 'translateX(0)';

    for (let i = 0; i < WIN_INDEX + 6; i += 1) {
      const src = i === WIN_INDEX ? findWinner(pool, wonKey) : pool[Math.floor(Math.random() * pool.length)];
      const node = src.cloneNode(true);
      node.classList.add('lb-reel-item');
      if (i === WIN_INDEX) node.classList.add('is-winner');
      reel.appendChild(node);
    }

    const winTile = reel.children[WIN_INDEX];

    if (reduceMotion) {
      // Sin animación: coloca la ganadora bajo la marca al instante.
      const x = winTile.offsetLeft + winTile.offsetWidth / 2 - viewport.clientWidth / 2;
      reel.style.transform = `translateX(${-x}px)`;
      return Promise.resolve();
    }

    // Un pelín de azar dentro de la ficha, para que no siempre pare centrada al pixel.
    const jitter = (Math.random() * 2 - 1) * (winTile.offsetWidth * 0.28);
    const targetX = winTile.offsetLeft + winTile.offsetWidth / 2 - viewport.clientWidth / 2 + jitter;

    return new Promise((resolve) => {
      // Doble rAF: asegura que el layout con transform:0 se pinta antes de animar.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          reel.style.transition = 'transform 5.2s cubic-bezier(0.12, 0.8, 0.16, 1)';
          reel.style.transform = `translateX(${-targetX}px)`;
        });
      });
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        winTile.classList.add('lb-land');
        resolve();
      };
      reel.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, 5600); // red de seguridad si no llega transitionend
    });
  }

  function showResult(res) {
    const item = res.item;
    const rarity = `<span class="lb-result-rarity" style="--rarity-color:${item.color}">${item.rarityLabel}</span>`;
    let html;
    if (res.duplicate) {
      html =
        `<span class="lb-result-line">Repetido</span>` +
        `<span class="lb-result-win"><b>${item.name}</b> ${rarity}</span>` +
        `<span class="lb-result-refund">Se convierte en <b>+${res.refund}</b> monedas</span>`;
    } else {
      html =
        `<span class="lb-result-line">¡Te ha salido!</span>` +
        `<span class="lb-result-win"><b>${item.name}</b> ${rarity}</span>`;
    }
    resultEl.innerHTML = html;
    resultEl.hidden = false;

    if (!res.duplicate && (item.rarity === 'rare' || item.rarity === 'epic' || item.rarity === 'legendary')) {
      window.toast.confetti();
    }
  }

  /** Pinta cuántas cajas sin abrir tiene una tarjeta (o quita el badge si 0). */
  function setCardOwned(card, n) {
    card.dataset.owned = String(n);
    let badge = card.querySelector('[data-box-owned]');
    if (n > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'lb-card-owned';
        badge.setAttribute('data-box-owned', '');
        card.appendChild(badge);
      }
      badge.textContent = `Tienes ${n}`;
    } else if (badge) {
      badge.remove();
    }
  }

  /** Recalcula qué cajas siguen siendo comprables tras cambiar el saldo. */
  function refreshAffordability(balance) {
    document.querySelectorAll('.lb-card').forEach((c) => {
      c.dataset.affordable = Number(c.dataset.price) <= balance ? '1' : '';
    });
  }

  function updateAfter(res, wasInventory) {
    window.coins.set(res.balance);
    if (!current) return;
    refreshAffordability(res.balance);
    if (wasInventory) {
      setCardOwned(current.card, Math.max(0, (Number(current.card.dataset.owned) || 0) - 1));
    }
  }

  async function open(endpoint, wasInventory) {
    if (!current) return;
    const boxKey = current.key;

    closePreview();
    reel.replaceChildren();
    resultEl.hidden = true;
    againBtn.hidden = true;
    revealCloseBtn.hidden = true;
    reveal.hidden = false;

    let res;
    try {
      res = await window.api.post(endpoint, { boxKey });
    } catch (err) {
      reveal.hidden = true;
      window.toast.show(err.message, { type: 'warn' });
      if (err.status === 409) setTimeout(() => window.location.reload(), 1200);
      return;
    }

    await spin(boxKey, res.item.key);
    showResult(res);
    updateAfter(res, wasInventory);

    revealCloseBtn.hidden = false;
    // "Abrir otra" solo si aún se puede repetir la misma acción.
    const canRepeat = wasInventory
      ? (Number(current.card.dataset.owned) || 0) > 0
      : current.card.dataset.affordable === '1';
    againBtn.hidden = !canRepeat;
    revealCloseBtn.focus();
  }

  buyBtn.addEventListener('click', () => open('/api/lootbox/buy', false));
  openBtn.addEventListener('click', () => open('/api/lootbox/open', true));

  // Solo comprar: la caja va al inventario, sin animación. Se puede abrir luego.
  purchaseBtn.addEventListener('click', async () => {
    if (!current) return;
    purchaseBtn.disabled = true;
    try {
      const res = await window.api.post('/api/lootbox/purchase', { boxKey: current.key });
      window.coins.set(res.balance);
      refreshAffordability(res.balance);
      setCardOwned(current.card, res.owned);
      closePreview();
      window.toast.show(`${res.boxName} guardada en tu inventario`, { type: 'success' });
    } catch (err) {
      purchaseBtn.disabled = false;
      window.toast.show(err.message, { type: 'warn' });
      if (err.status === 409) setTimeout(() => window.location.reload(), 1200);
    }
  });

  againBtn.addEventListener('click', () => {
    // Repite según lo que quede disponible: prioriza gastar el inventario.
    if ((Number(current.card.dataset.owned) || 0) > 0) open('/api/lootbox/open', true);
    else open('/api/lootbox/buy', false);
  });

  function closeReveal() {
    reveal.hidden = true;
  }
  revealCloseBtn.addEventListener('click', closeReveal);
  reveal.querySelector('.lb-reveal-backdrop').addEventListener('click', closeReveal);

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (!reveal.hidden && !revealCloseBtn.hidden) closeReveal();
    else if (!preview.hidden) closePreview();
  });
})();
