(function () {
  'use strict';

  /**
   * Pase de batalla: desbloquear el premium y reclamar recompensas de tier.
   * El servidor decide todo (nivel alcanzado, si ya lo reclamaste); esto solo
   * pide y refleja la respuesta.
   */
  const page = document.querySelector('.pass-page');
  if (!page) return;

  // ---- Interruptor gratis/premium (solo visible en móvil) -----------------
  const track = page.querySelector('.pass-track');
  const switchBtns = page.querySelectorAll('[data-track-toggle]');
  switchBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.trackToggle;
      if (track) track.setAttribute('data-track-view', view);
      switchBtns.forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    });
  });

  // ---- Desbloquear premium ------------------------------------------------
  const premiumBtn = page.querySelector('[data-premium-unlock]');
  if (premiumBtn) {
    premiumBtn.addEventListener('click', async () => {
      premiumBtn.disabled = true;
      premiumBtn.textContent = 'Desbloqueando…';
      try {
        const res = await window.api.post('/api/pase/premium', {});
        window.coins.set(res.balance);
        window.toast.show('¡Premium desbloqueado!', { type: 'success' });
        window.toast.confetti();
        // Recargar: el carril premium pasa a poder reclamarse en los tiers ya alcanzados.
        setTimeout(() => window.location.reload(), 700);
      } catch (err) {
        premiumBtn.disabled = false;
        premiumBtn.textContent = 'Reintentar desbloquear premium';
        window.toast.show(err.message, { type: 'warn' });
        if (err.status === 409) setTimeout(() => window.location.reload(), 1200);
      }
    });
  }

  // ---- Reclamar recompensas ----------------------------------------------
  function announce(reward) {
    if (!reward) return;
    if (reward.type === 'coins') {
      window.toast.show(`+${reward.amount} monedas`, { type: 'coin' });
    } else if (reward.type === 'cosmetic') {
      window.toast.show(`¡${reward.label} desbloqueado! Póntelo en tu colección`, { type: 'success' });
    } else if (reward.type === 'lootbox') {
      window.toast.show(`Caja conseguida: ${reward.label}. Ábrela en la tienda`, { type: 'success' });
    }
    window.toast.confetti();
  }

  page.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-claim]');
    if (!btn) return;

    const level = Number(btn.dataset.level);
    const track = btn.dataset.track;
    btn.disabled = true;
    btn.textContent = 'Reclamando…';

    try {
      const res = await window.api.post('/api/pase/claim', { level, track });
      window.coins.set(res.balance);
      announce(res.reward);

      // El botón se convierte en un sello de "reclamado", sin recargar.
      const done = document.createElement('span');
      done.className = 'pass-reward-state is-done';
      done.textContent = '✓ Reclamado';
      btn.replaceWith(done);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Reclamar';
      window.toast.show(err.message, { type: 'warn' });
      if (err.status === 409 || err.status === 403) setTimeout(() => window.location.reload(), 1200);
    }
  });
})();
