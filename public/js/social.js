'use strict';

/**
 * Feed social en vivo: reacciones con update optimista + SSE para recibir
 * actividad nueva y reacciones de los amigos sin recargar.
 */
(function () {
  const feed = document.getElementById('feed');
  if (!feed) return;

  const myUserId = Number(feed.dataset.userId);
  let lastId = Number(feed.dataset.lastId) || 0;
  let fetching = false;

  // ---- Reacciones (optimistas) ---------------------------------------------

  feed.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-react]');
    if (!btn) return;
    const item = btn.closest('.feed-item');
    const emoji = btn.dataset.react;
    const countEl = btn.querySelector('[data-count]');
    const wasMine = btn.classList.contains('is-mine');
    const before = Number(countEl.textContent) || 0;

    // Update optimista.
    apply(btn, countEl, !wasMine, before + (wasMine ? -1 : 1));

    try {
      const res = await window.api.post(`/api/activity/${item.dataset.eventId}/react`, { emoji });
      apply(btn, countEl, res.reacted, res.count);
    } catch (err) {
      apply(btn, countEl, wasMine, before); // revertir
      if (window.toast) window.toast.show(err.message, { type: 'info' });
    }
  });

  function apply(btn, countEl, mine, count) {
    btn.classList.toggle('is-mine', mine);
    btn.classList.toggle('has-count', count > 0);
    btn.setAttribute('aria-pressed', String(mine));
    countEl.textContent = count > 0 ? count : '';
  }

  // ---- Tiempo real (SSE) ----------------------------------------------------

  async function pullLatest() {
    if (fetching) return;
    fetching = true;
    try {
      const res = await fetch(`/api/feed/latest?after=${lastId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      lastId = Math.max(lastId, data.lastId);
      const empty = feed.querySelector('.feed-empty');
      for (const html of data.items.reverse()) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html.trim();
        const node = tmp.firstElementChild;
        node.classList.add('feed-item-new');
        feed.prepend(node);
        if (empty) empty.remove();
      }
    } finally {
      fetching = false;
    }
  }

  function updateReaction({ eventId, emoji, count, byUserId }) {
    if (byUserId === myUserId) return; // lo mío ya se pintó optimista
    const item = feed.querySelector(`[data-event-id="${eventId}"]`);
    if (!item) return;
    const btn = item.querySelector(`[data-react="${emoji}"]`);
    if (!btn) return;
    const countEl = btn.querySelector('[data-count]');
    btn.classList.toggle('has-count', count > 0);
    countEl.textContent = count > 0 ? count : '';
  }

  const source = new EventSource('/api/stream');
  source.addEventListener('activity', pullLatest);
  source.addEventListener('reaction', (e) => {
    try {
      updateReaction(JSON.parse(e.data));
    } catch {
      /* dato malformado: ignorar */
    }
  });
})();
