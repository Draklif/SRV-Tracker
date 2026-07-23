(function () {
  'use strict';

  /**
   * Bandeja de regalos (dentro de la Tienda): reclamar lo recibido y quitar de la
   * bandeja lo ya reclamado. El envío de cajas vive en el modal de la caja
   * (lootbox.js); esto solo reclama y limpia.
   */
  const inbox = document.querySelector('[data-gift-inbox]');
  if (!inbox) return;

  const list = inbox.querySelector('.gift-list');

  // SVG del icono 'close' (mismo trazo que partials/icon.ejs), para el botón de
  // quitar que se crea al vuelo tras reclamar.
  const CLOSE_SVG =
    '<svg class="icon icon-close" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';

  /** Baja en uno los badges de regalos del nav (o los oculta al llegar a 0). */
  function decrementGiftBadges() {
    document.querySelectorAll('[data-nav-gift-badge]').forEach((badge) => {
      const n = Math.max(0, (parseInt(badge.textContent, 10) || 1) - 1);
      if (n > 0) badge.textContent = String(n);
      else badge.hidden = true;
    });
  }

  /** Si la bandeja se queda vacía, se retira toda la sección. */
  function pruneIfEmpty() {
    if (list && !list.querySelector('.gift-item')) inbox.remove();
  }

  /** Botón "quitar" (para un regalo ya reclamado). */
  function makeDeleteButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gift-delete';
    btn.setAttribute('data-gift-delete', '');
    btn.title = 'Quitar de la bandeja';
    btn.setAttribute('aria-label', 'Quitar de la bandeja');
    btn.innerHTML = CLOSE_SVG;
    return btn;
  }

  inbox.addEventListener('click', async (ev) => {
    const claimBtn = ev.target.closest('[data-gift-claim]');
    const deleteBtn = ev.target.closest('[data-gift-delete]');
    const item = ev.target.closest('.gift-item');
    if (!item) return;
    const id = item.dataset.giftId;

    // ---- Reclamar ----
    if (claimBtn) {
      claimBtn.disabled = true;
      claimBtn.textContent = 'Reclamando…';
      try {
        const res = await window.api.post(`/api/gifts/${id}/claim`, {});
        if (typeof res.balance === 'number') window.coins.set(res.balance);

        item.classList.remove('is-pending');
        item.classList.add('is-claimed');
        const tag = document.createElement('span');
        tag.className = 'gift-claimed-tag';
        tag.textContent = 'Reclamado ✓';
        claimBtn.replaceWith(tag);
        tag.after(makeDeleteButton());
        decrementGiftBadges();

        window.toast.show(`¡Reclamado! ${res.label}`, { type: 'success', duration: 3500 });
        window.toast.confetti();
      } catch (err) {
        claimBtn.disabled = false;
        claimBtn.textContent = 'Reclamar';
        window.toast.show(err.message, { type: 'warn' });
        if (err.status === 409) setTimeout(() => window.location.reload(), 1200);
      }
      return;
    }

    // ---- Quitar (solo reclamados) ----
    if (deleteBtn) {
      deleteBtn.disabled = true;
      try {
        await window.api.del(`/api/gifts/${id}`);
        item.remove();
        pruneIfEmpty();
      } catch (err) {
        deleteBtn.disabled = false;
        window.toast.show(err.message, { type: 'warn' });
      }
    }
  });
})();
