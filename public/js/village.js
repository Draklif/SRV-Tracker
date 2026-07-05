'use strict';

/**
 * Cliente de "La Colonia". Vanilla, sin dependencias. Las mutaciones usan
 * window.api (CSRF por header) y, al tener éxito, recargan para reflejar el
 * estado compartido (sin tiempo real en la Fase 1). Las invitaciones solo
 * muestran un toast.
 */
(function () {
  const root = document.getElementById('village-root');
  if (!root) return;

  const dataNode = document.getElementById('village-data');
  const data = dataNode ? JSON.parse(dataNode.textContent) : { roomMeta: {}, resourceMeta: {} };
  const { roomMeta, resourceMeta } = data;

  let pendingSlot = null; // slot elegido al abrir el modal de construir
  let currentRoom = null; // { id, type, level, status }

  /* ── Modales ── */
  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeModals() {
    document.querySelectorAll('.modal').forEach((m) => {
      m.hidden = true;
      m.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = '';
  }

  function costChips(cost) {
    return Object.entries(cost)
      .map(([r, n]) => `${n} ${(resourceMeta[r] && resourceMeta[r].icon) || r}`)
      .join('  ');
  }

  async function mutate(url, body, { reload = true } = {}) {
    try {
      await window.api.post(url, body);
      if (reload) {
        window.location.reload();
      }
      return true;
    } catch (err) {
      window.toast.show(err.message || 'No se pudo completar la acción.', { type: 'info' });
      return false;
    }
  }

  /* ── Detalle de sala ── */
  function openRoom(tile) {
    const type = tile.dataset.roomType;
    const meta = roomMeta[type] || {};
    const level = Number(tile.dataset.level);
    const status = tile.dataset.status;
    currentRoom = { id: Number(tile.dataset.roomId), type, level, status };

    document.getElementById('room-modal-title').textContent = `${meta.icon || ''} ${meta.label || 'Sala'} · Nv ${level}`;
    document.getElementById('room-modal-desc').textContent = meta.desc || '';

    const statusEl = document.getElementById('room-modal-status');
    const upgradeBtn = document.getElementById('room-upgrade-btn');
    const rushBtn = document.getElementById('room-rush-btn');
    if (status === 'constructing') {
      statusEl.textContent = 'En obras… puedes esperar el timer o completarla ya.';
      upgradeBtn.hidden = true;
      rushBtn.hidden = false;
    } else {
      const nextCost = {};
      Object.entries(meta.cost || {}).forEach(([r, n]) => {
        nextCost[r] = n * (level + 1);
      });
      statusEl.textContent = `Mejorar a Nv ${level + 1}: ${costChips(nextCost)}`;
      upgradeBtn.hidden = false;
      upgradeBtn.textContent = `Mejorar a Nv ${level + 1}`;
      rushBtn.hidden = true;
    }
    openModal('room-modal');
  }

  /* ── Delegación de clicks ── */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action], [data-build]');
    if (!el) return;

    // Opción de construcción
    if (el.dataset.build) {
      const roomType = el.dataset.build;
      if (pendingSlot == null) return;
      mutate('/api/village/build', { roomType, slotIndex: pendingSlot });
      return;
    }

    const action = el.dataset.action;
    switch (action) {
      case 'close':
        closeModals();
        break;
      case 'empty':
        pendingSlot = Number(el.dataset.slot);
        openModal('build-modal');
        break;
      case 'room':
        openRoom(el);
        break;
      case 'upgrade':
        if (currentRoom) mutate('/api/village/upgrade', { roomId: currentRoom.id });
        break;
      case 'rush':
        if (currentRoom) mutate('/api/village/rush', { roomId: currentRoom.id });
        break;
      case 'dev-refill':
        mutate('/api/village/dev/refill', {});
        break;
      case 'open-invite':
        openModal('invite-modal');
        break;
      case 'invite':
        mutate('/api/village/invite', { friendId: Number(el.dataset.friendId) }, { reload: false }).then((ok) => {
          if (ok) {
            window.toast.show('Invitación enviada.', { type: 'success' });
            closeModals();
          }
        });
        break;
      case 'accept':
        mutate('/api/village/accept', { villageId: Number(el.dataset.villageId) });
        break;
      default:
        break;
    }
  });

  /* ── Crear colonia ── */
  const createForm = document.getElementById('create-village-form');
  if (createForm) {
    createForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = createForm.querySelector('#village-name').value.trim();
      if (name.length < 2) {
        window.toast.show('Ponle un nombre a tu colonia (mín. 2 caracteres).', { type: 'info' });
        return;
      }
      mutate('/api/village', { name });
    });
  }

  /* ── Countdown de construcciones ── */
  function tickCountdowns() {
    document.querySelectorAll('[data-countdown]').forEach((el) => {
      const finish = new Date(el.dataset.countdown).getTime();
      const left = finish - Date.now();
      if (left <= 0) {
        el.textContent = 'Completándose…';
        return;
      }
      const mins = Math.ceil(left / 60000);
      el.textContent = mins >= 60 ? `En obras · ${Math.floor(mins / 60)}h ${mins % 60}m` : `En obras · ${mins}m`;
    });
  }
  if (document.querySelector('[data-countdown]')) {
    tickCountdowns();
    setInterval(tickCountdowns, 30000);
  }
})();
