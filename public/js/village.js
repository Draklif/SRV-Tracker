'use strict';

/**
 * Cliente de "La Colonia" (Fase A). Vanilla, sin dependencias.
 *
 * El mapa crece sin límite desde el Núcleo → lienzo PANEABLE (drag) con las salas
 * posicionadas en absoluto por su huella (floor, col, width). La unidad horizontal
 * es la MEDIA casilla: una sala cuadrada mide 2 unidades (se dibuja cuadrada) y el
 * elevador 1 (media casilla → conector fino). Al elegir una sala del catálogo se
 * entra en MODO COLOCACIÓN: se resaltan los anchors adyacentes válidos (fantasma
 * con snap) y un click construye ahí. El servidor revalida la adyacencia (fuente
 * de verdad); aquí solo se calculan los candidatos. Las mutaciones recargan la
 * página, pero el paneo se conserva (sessionStorage, compensando el origen).
 */
(function () {
  const root = document.getElementById('village-root');
  if (!root) return;

  const dataNode = document.getElementById('village-data');
  const data = dataNode ? JSON.parse(dataNode.textContent) : {};
  const roomMeta = data.roomMeta || {};
  const resourceMeta = data.resourceMeta || {};
  const rooms = data.rooms || [];
  const bounds = data.bounds || { minFloor: 0, maxFloor: 0, minCol: 0, maxCol: 0 };
  const unlockedRoomTypes = data.unlockedRoomTypes || [];
  const maxWidth = data.maxWidth || 6;
  const credits = data.credits || 0;
  const rushPerMinute = data.rushPerMinute || 1;
  const villageId = data.villageId || 0;

  const CELL = 96; // lado de una sala cuadrada (px)
  const UW = CELL / 2; // ancho de una unidad = media casilla
  const GAP = 8; // separación visual
  const MARGIN = 4; // unidades de margen alrededor para crecer (2 salas)

  const originCol = bounds.minCol - MARGIN;
  const originFloor = bounds.maxFloor + MARGIN;
  const xOf = (col) => (col - originCol) * UW;
  const yOf = (floor) => (originFloor - floor) * CELL;

  let placing = null; // roomType en curso de colocación (construir)
  let placingWidth = 0; // ancho (unidades) del tipo en colocación
  let moveMode = null; // id de la sala que se está moviendo, o null
  let currentRoom = null; // sala abierta en el modal
  let mergeNeighborId = null;

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
        savePan();
        window.location.reload();
      }
      return true;
    } catch (err) {
      window.toast.show(err.message || 'No se pudo completar la acción.', { type: 'info' });
      return false;
    }
  }

  const viewport = document.getElementById('map-viewport');
  const canvas = document.getElementById('map-canvas');

  /* ── Layout: dimensiona el lienzo y posiciona cada sala por su huella ── */
  function layout() {
    if (!canvas) return;
    const cols = bounds.maxCol - bounds.minCol + 1 + 2 * MARGIN;
    const floors = bounds.maxFloor - bounds.minFloor + 1 + 2 * MARGIN;
    canvas.style.width = `${cols * UW}px`;
    canvas.style.height = `${floors * CELL}px`;

    canvas.querySelectorAll('.room-tile').forEach((tile) => {
      const floor = Number(tile.dataset.floor);
      const col = Number(tile.dataset.col);
      const width = Number(tile.dataset.width);
      tile.style.left = `${xOf(col) + GAP / 2}px`;
      tile.style.top = `${yOf(floor) + GAP / 2}px`;
      tile.style.width = `${width * UW - GAP}px`;
      tile.style.height = `${CELL - GAP}px`;
    });
  }

  /* ── Paneo (persistente) ── */
  let panX = 0;
  let panY = 0;
  const PAN_KEY = 'village-pan';
  function applyPan() {
    if (canvas) canvas.style.transform = `translate(${panX}px, ${panY}px)`;
  }
  function savePan() {
    try {
      sessionStorage.setItem(PAN_KEY, JSON.stringify({ villageId, panX, panY, originCol, originFloor }));
    } catch (_) { /* sessionStorage no disponible */ }
  }
  function restorePan() {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(PAN_KEY) || 'null'); } catch (_) { saved = null; }
    if (!saved || saved.villageId !== villageId) return false;
    // El origen pudo moverse si el mapa creció; compensa para no "saltar".
    panX = saved.panX + (originCol - saved.originCol) * UW;
    panY = saved.panY + (saved.originFloor - originFloor) * CELL;
    applyPan();
    return true;
  }
  function centerOnNucleo() {
    if (!viewport) return;
    const nucleo = rooms.find((r) => r.room_type === 'nucleo') || { col: 0, floor: 0, width: 2 };
    panX = viewport.clientWidth / 2 - (xOf(nucleo.col) + (nucleo.width * UW) / 2);
    panY = viewport.clientHeight / 2 - (yOf(nucleo.floor) + CELL / 2);
    applyPan();
  }

  if (viewport && canvas) {
    let down = null; // { x, y, baseX, baseY }
    let dragging = false;
    let suppressClick = false; // solo el click inmediato tras un drag real

    viewport.addEventListener('pointerdown', (e) => {
      // No capturamos aún: un tap simple sobre sala/fantasma debe emitir su click.
      down = { x: e.clientX, y: e.clientY, baseX: panX, baseY: panY };
      dragging = false;
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (!dragging && Math.hypot(dx, dy) > 4) {
        dragging = true;
        try { viewport.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
        viewport.classList.add('is-grabbing');
      }
      if (dragging) {
        panX = down.baseX + dx;
        panY = down.baseY + dy;
        applyPan();
      }
    });
    function endDrag(e) {
      if (dragging) {
        suppressClick = true; // el click sintético del arrastre no debe activar nada
        savePan();
        if (e && e.pointerId != null) {
          try { viewport.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
        }
      }
      down = null;
      dragging = false;
      viewport.classList.remove('is-grabbing');
    }
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('click', (e) => {
      if (suppressClick) {
        suppressClick = false;
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
  }

  /* ── Modo colocación: fantasma con snap a anchors válidos ── */
  // excludeId ignora una sala (para mover: su hueco actual queda libre).
  function occupiedSet(excludeId) {
    const occ = new Set();
    rooms.forEach((r) => {
      if (r.id === excludeId) return;
      for (let c = r.col; c < r.col + r.width; c += 1) occ.add(`${r.floor},${c}`);
    });
    return occ;
  }

  // Anchors candidatos para una sala de ancho `w`. Solo se ancla a lo TERMINADO.
  // Horizontal: vecinos de salas construidas. Vertical (sobre/bajo un elevador):
  // SOLO si lo que se coloca es otro elevador — así se cambia de piso apilando dos.
  // `excludeId` ignora una sala (mover); `isElevator` habilita el anclaje vertical.
  function candidateAnchors(w, excludeId, isElevator) {
    const occ = occupiedSet(excludeId);
    const self = excludeId != null ? rooms.find((r) => r.id === excludeId) : null;
    const seen = new Set();
    const out = [];
    const add = (floor, col) => {
      const key = `${floor},${col}`;
      if (seen.has(key)) return;
      // Al mover: no ofrezcas la casilla exacta de origen (mover ahí no es mover).
      if (self && floor === self.floor && col === self.col) return;
      for (let c = col; c < col + w; c += 1) {
        if (occ.has(`${floor},${c}`)) return; // la huella pisaría algo ocupado
      }
      seen.add(key);
      out.push({ floor, col });
    };
    rooms.forEach((r) => {
      if (r.id === excludeId || r.status !== 'built') return;
      add(r.floor, r.col - w); // pegado por la izquierda
      add(r.floor, r.col + r.width); // pegado por la derecha
      if (isElevator && r.room_type === 'elevator') {
        // Solo un elevador se apila sobre/bajo otro elevador construido.
        for (let off = 0; off < w; off += 1) {
          add(r.floor + 1, r.col - off);
          add(r.floor - 1, r.col - off);
        }
      }
    });
    return out;
  }

  function clearGhosts() {
    if (canvas) canvas.querySelectorAll('.ghost-anchor').forEach((g) => g.remove());
  }

  // Pinta los fantasmas en cada anchor. `icon` decora, `excludeId` para mover,
  // `isElevator` habilita el anclaje vertical sobre/bajo elevadores.
  function showGhosts(width, icon, excludeId, isElevator) {
    clearGhosts();
    const anchors = candidateAnchors(width, excludeId, isElevator);
    if (!anchors.length) {
      window.toast.show('No hay dónde colocar todavía.', { type: 'info' });
      return false;
    }
    anchors.forEach(({ floor, col }) => {
      const g = document.createElement('button');
      g.type = 'button';
      g.className = 'ghost-anchor';
      g.dataset.floor = floor;
      g.dataset.col = col;
      g.style.left = `${xOf(col) + GAP / 2}px`;
      g.style.top = `${yOf(floor) + GAP / 2}px`;
      g.style.width = `${width * UW - GAP}px`;
      g.style.height = `${CELL - GAP}px`;
      g.innerHTML = `<span class="ghost-icon">${icon || '＋'}</span>`;
      canvas.appendChild(g);
    });
    const hint = document.getElementById('placement-hint');
    if (hint) hint.hidden = false;
    if (viewport) viewport.classList.add('is-placing');
    return true;
  }

  function enterPlacement(roomType) {
    const meta = roomMeta[roomType] || {};
    if (meta.unique && rooms.some((r) => r.room_type === roomType)) {
      window.toast.show('Solo puedes tener una de estas en la colonia.', { type: 'info' });
      return;
    }
    closeModals();
    placing = roomType;
    placingWidth = meta.baseWidth || 2;
    moveMode = null;
    if (!showGhosts(placingWidth, meta.icon, null, roomType === 'elevator')) exitPlacement();
  }

  function enterMove(room) {
    const meta = roomMeta[room.room_type] || {};
    closeModals();
    placing = null;
    moveMode = room.id;
    placingWidth = room.width;
    // Excluye la propia sala: su hueco actual queda libre y no se ancla a sí misma.
    if (!showGhosts(room.width, meta.icon, room.id, room.room_type === 'elevator')) exitPlacement();
  }

  function exitPlacement() {
    placing = null;
    moveMode = null;
    placingWidth = 0;
    clearGhosts();
    const hint = document.getElementById('placement-hint');
    if (hint) hint.hidden = true;
    if (viewport) viewport.classList.remove('is-placing');
  }

  /* ── Conectividad (espejo del servidor): detectar nodos críticos ── */
  function connected(a, b) {
    if (a.floor === b.floor) return a.col + a.width === b.col || b.col + b.width === a.col;
    if (Math.abs(a.floor - b.floor) === 1) {
      const viaElevator = a.room_type === 'elevator' || b.room_type === 'elevator';
      const colsOverlap = a.col < b.col + b.width && b.col < a.col + a.width;
      return viaElevator && colsOverlap;
    }
    return false;
  }
  function allReachFromNucleo(list) {
    const nucleo = list.find((r) => r.room_type === 'nucleo');
    if (!nucleo) return true;
    const seen = new Set([nucleo.id]);
    const stack = [nucleo];
    while (stack.length) {
      const cur = stack.pop();
      for (const r of list) {
        if (!seen.has(r.id) && connected(cur, r)) {
          seen.add(r.id);
          stack.push(r);
        }
      }
    }
    return seen.size === list.length;
  }
  // Una sala es crítica si quitarla aísla a otra del Núcleo → no se puede mover ni destruir.
  function isCritical(roomId) {
    return !allReachFromNucleo(rooms.filter((r) => r.id !== roomId));
  }

  /* ── Detalle de sala (mejorar / fusionar / rush) ── */
  // Espejo de villageService.rushCost: créditos por minuto restante (mín. 1).
  function rushCostOf(room) {
    if (!room.construct_finish_at) return 1;
    const remainingMs = new Date(room.construct_finish_at).getTime() - Date.now();
    const remainingMin = Math.ceil(Math.max(0, remainingMs) / 60000);
    return Math.max(1, remainingMin * rushPerMinute);
  }

  function findMergeNeighbor(room) {
    if (room.status !== 'built') return null;
    return rooms.find((r) =>
      r.id !== room.id &&
      r.room_type === room.room_type &&
      r.floor === room.floor &&
      r.level === room.level &&
      r.status === 'built' &&
      (r.col + r.width === room.col || room.col + room.width === r.col) &&
      r.width + room.width <= maxWidth
    ) || null;
  }

  function openRoom(tile) {
    const id = Number(tile.dataset.roomId);
    const room = rooms.find((r) => r.id === id) || {
      id,
      room_type: tile.dataset.roomType,
      floor: Number(tile.dataset.floor),
      col: Number(tile.dataset.col),
      width: Number(tile.dataset.width),
      level: Number(tile.dataset.level),
      status: tile.dataset.status,
      construct_finish_at: tile.dataset.finish || null,
    };
    const meta = roomMeta[room.room_type] || {};
    currentRoom = room;

    document.getElementById('room-modal-title').textContent = `${meta.icon || ''} ${meta.label || 'Sala'} · Nv ${room.level}`;
    document.getElementById('room-modal-desc').textContent = meta.desc || '';

    const statusEl = document.getElementById('room-modal-status');
    const upgradeBtn = document.getElementById('room-upgrade-btn');
    const rushBtn = document.getElementById('room-rush-btn');
    const mergeBtn = document.getElementById('room-merge-btn');
    const moveBtn = document.getElementById('room-move-btn');
    const cancelBtn = document.getElementById('room-cancel-btn');
    const destroyBtn = document.getElementById('room-destroy-btn');
    const isNucleo = room.room_type === 'nucleo';

    if (room.status !== 'built') {
      const moving = room.status === 'moving';
      const cost = rushCostOf(room);
      const enough = credits >= cost;
      const verb = moving ? 'Moviéndose' : 'En obras';
      statusEl.textContent = enough
        ? `${verb}… acelérala por ${cost} 🪙 (tienes ${credits}).`
        : `${verb}… acelerar cuesta ${cost} 🪙 y solo tienes ${credits}.`;
      upgradeBtn.hidden = true;
      mergeBtn.hidden = true;
      moveBtn.hidden = true;
      destroyBtn.hidden = true;
      rushBtn.hidden = false;
      rushBtn.textContent = `Terminar ya · ${cost} 🪙`;
      rushBtn.disabled = !enough;
      // Cancelar: mover → revierte al origen (sin coste); mejora → revierte y
      // reembolsa; obra nueva → elimina y reembolsa 100%.
      cancelBtn.hidden = false;
      cancelBtn.textContent = moving ? 'Cancelar movimiento' : (room.level > 1 ? 'Cancelar mejora' : 'Cancelar obra');
      mergeNeighborId = null;
    } else {
      const nextCost = {};
      Object.entries(meta.cost || {}).forEach(([r, n]) => { nextCost[r] = n * (room.level + 1); });
      statusEl.textContent = isNucleo
        ? 'El corazón de la colonia. No se puede mover ni destruir.'
        : `Mejorar a Nv ${room.level + 1}: ${costChips(nextCost)}`;
      cancelBtn.hidden = true;
      rushBtn.hidden = true;
      upgradeBtn.hidden = isNucleo;
      upgradeBtn.textContent = `Mejorar a Nv ${room.level + 1}`;

      const neighbor = findMergeNeighbor(room);
      mergeNeighborId = neighbor ? neighbor.id : null;
      mergeBtn.hidden = !neighbor;
      // Mover / destruir: no para el Núcleo ni para un nodo crítico (dejaría huérfanas).
      const critical = !isNucleo && isCritical(room.id);
      moveBtn.hidden = isNucleo || critical;
      destroyBtn.hidden = isNucleo || critical;
      if (critical) {
        statusEl.textContent += ' · Nodo crítico: no se puede mover ni destruir sin aislar otras salas.';
      }
    }
    openModal('room-modal');
  }

  /* ── Delegación de clicks ── */
  document.addEventListener('click', (e) => {
    const ghost = e.target.closest('.ghost-anchor');
    if (ghost && (placing || moveMode)) {
      const floor = Number(ghost.dataset.floor);
      const col = Number(ghost.dataset.col);
      if (moveMode) {
        mutate('/api/village/move', { roomId: moveMode, floor, col });
      } else {
        mutate('/api/village/build', { roomType: placing, floor, col });
      }
      return;
    }

    const el = e.target.closest('[data-action], [data-build]');
    if (!el) return;

    if (el.dataset.build) {
      if (el.disabled) return;
      enterPlacement(el.dataset.build);
      return;
    }

    switch (el.dataset.action) {
      case 'close':
        closeModals();
        break;
      case 'open-build':
        exitPlacement();
        openModal('build-modal');
        break;
      case 'cancel-place':
        exitPlacement();
        break;
      case 'room':
        if (!placing) openRoom(el);
        break;
      case 'nucleo':
        window.toast.show('El Núcleo es el corazón de la colonia. Todo crece a partir de él.', { type: 'info' });
        break;
      case 'upgrade':
        if (currentRoom) mutate('/api/village/upgrade', { roomId: currentRoom.id });
        break;
      case 'merge':
        if (currentRoom && mergeNeighborId) {
          mutate('/api/village/merge', { roomIdA: currentRoom.id, roomIdB: mergeNeighborId });
        }
        break;
      case 'move':
        if (currentRoom) enterMove(currentRoom);
        break;
      case 'cancel':
        if (currentRoom) mutate('/api/village/cancel', { roomId: currentRoom.id });
        break;
      case 'destroy':
        if (currentRoom && window.confirm('¿Destruir esta sala? Recuperas la mitad de los materiales.')) {
          mutate('/api/village/destroy', { roomId: currentRoom.id });
        }
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

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && placing) exitPlacement();
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
      el.textContent = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    });
  }

  /* ── Arranque ── */
  if (canvas) {
    layout();
    if (!restorePan()) centerOnNucleo();
  }
  if (document.querySelector('[data-countdown]')) {
    tickCountdowns();
    setInterval(tickCountdowns, 30000);
  }
})();
