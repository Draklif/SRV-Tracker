'use strict';

/**
 * Página de hábitos: modal de crear/editar (con campos dinámicos por tipo),
 * archivar/restaurar y reordenar con ▲▼. Todo vía API JSON + actualización
 * optimista del DOM; las tarjetas las renderiza el servidor (una sola fuente).
 */
(function () {
  const typeMeta = JSON.parse(document.getElementById('habit-type-meta').textContent);

  const modal = document.getElementById('habit-modal');
  const form = document.getElementById('habit-form');
  const list = document.getElementById('habit-list');
  const emptyState = document.getElementById('habits-empty');
  const errorBox = document.getElementById('habit-form-error');

  const el = (id) => document.getElementById(id);
  const val = (id) => el(id).value.trim();

  // Devolver el foco a quien abrió el modal al cerrarlo (accesibilidad).
  let modalTrigger = null;

  // ---- Apertura / cierre del modal ----------------------------------------

  function openModal() {
    modalTrigger = document.activeElement;
    errorBox.hidden = true;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    // Enfocar lo primero útil: el selector de tipo al crear, el nombre al editar.
    const target = el('habit-details').hidden
      ? document.querySelector('.type-option')
      : el('habit-name');
    if (target) target.focus();
  }

  function closeModal() {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (modalTrigger && document.contains(modalTrigger)) modalTrigger.focus();
    modalTrigger = null;
  }

  function resetForm() {
    form.reset();
    el('habit-id').value = '';
    el('habit-color').value = 'blue';
    el('habit-icon').value = '⭐';
    el('habit-type').value = '';
    syncColorSelection('blue');
    syncIconSelection('⭐');
    document.querySelectorAll('.type-option').forEach((b) => b.classList.remove('is-selected'));
  }

  function startCreate() {
    resetForm();
    el('habit-modal-title').textContent = 'Nuevo hábito';
    el('type-picker-wrap').hidden = false;
    el('type-fixed-wrap').hidden = true;
    // Los detalles aparecen al elegir tipo (paso 01 → 02).
    el('habit-details').hidden = true;
    el('habit-save').disabled = true;
    toggleDynamicFields(null);
    openModal();
  }

  function startEdit(card) {
    resetForm();
    const cfg = JSON.parse(card.dataset.json);
    el('habit-modal-title').textContent = 'Editar hábito';
    el('type-picker-wrap').hidden = true;
    el('type-fixed-wrap').hidden = false;
    el('type-fixed-label').textContent = typeMeta[cfg.type] ? typeMeta[cfg.type].label : cfg.type;

    el('habit-details').hidden = false;
    el('habit-save').disabled = false;
    el('habit-id').value = cfg.id;
    el('habit-type').value = cfg.type;
    el('habit-name').value = cfg.name;
    el('habit-icon').value = cfg.icon;
    el('habit-color').value = cfg.color;
    syncColorSelection(cfg.color);
    syncIconSelection(cfg.icon);
    if (cfg.unit) el('habit-unit').value = cfg.unit;
    if (cfg.targetDaily != null) el('habit-target').value = cfg.targetDaily;
    const s = cfg.settings || {};
    if (s.quickAdd) el('habit-quickadd').value = s.quickAdd.join(', ');
    if (s.scaleMin != null) el('habit-scalemin').value = s.scaleMin;
    if (s.scaleMax != null) el('habit-scalemax').value = s.scaleMax;

    toggleDynamicFields(cfg.type);
    openModal();
  }

  // ---- Selección de tipo / icono / color ----------------------------------

  function toggleDynamicFields(type) {
    const fields = type && typeMeta[type] ? typeMeta[type].fields : [];
    document.querySelectorAll('[data-field]').forEach((wrap) => {
      wrap.hidden = !fields.includes(wrap.dataset.field);
    });
  }

  function selectType(type) {
    el('habit-type').value = type;
    document.querySelectorAll('.type-option').forEach((b) => {
      b.classList.toggle('is-selected', b.dataset.type === type);
    });
    toggleDynamicFields(type);
    // Revelar el paso 02 y habilitar guardar.
    el('habit-details').hidden = false;
    el('habit-save').disabled = false;
    el('habit-name').focus();
  }

  function syncColorSelection(color) {
    document.querySelectorAll('.swatch').forEach((b) => {
      b.classList.toggle('is-selected', b.dataset.color === color);
    });
  }

  function syncIconSelection(emoji) {
    document.querySelectorAll('.icon-choice').forEach((b) => {
      b.classList.toggle('is-selected', b.dataset.emoji === emoji);
    });
  }

  // ---- Construcción del payload y envío ------------------------------------

  function buildPayload() {
    const type = val('habit-type');
    const payload = {
      type,
      name: val('habit-name'),
      icon: val('habit-icon'),
      color: val('habit-color'),
    };
    const fields = typeMeta[type] ? typeMeta[type].fields : [];
    if (fields.includes('unit') && val('habit-unit')) payload.unit = val('habit-unit');
    if (fields.includes('target') && val('habit-target') !== '') {
      payload.targetDaily = Number(val('habit-target'));
    }
    if (fields.includes('quickAdd') && val('habit-quickadd')) {
      payload.quickAdd = val('habit-quickadd')
        .split(',')
        .map((n) => Number(n.trim()))
        .filter((n) => !Number.isNaN(n) && n > 0);
    }
    if (fields.includes('scale')) {
      payload.scaleMin = Number(val('habit-scalemin'));
      payload.scaleMax = Number(val('habit-scalemax'));
    }
    return payload;
  }

  function showError(err) {
    let msg = err.message || 'Revisa los datos.';
    if (err.fields) {
      const parts = Object.values(err.fields);
      if (parts.length) msg = parts.join(' · ');
    }
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }

  async function submit(event) {
    event.preventDefault();
    if (!val('habit-type')) {
      showError({ message: 'Elige un tipo de hábito.' });
      return;
    }
    const saveBtn = el('habit-save');
    saveBtn.disabled = true;
    try {
      const id = val('habit-id');
      const payload = buildPayload();
      const result = id
        ? await window.api.patch(`/api/habits/${id}`, payload)
        : await window.api.post('/api/habits', payload);
      applyCard(result.html, id);
      closeModal();
      if (result.rewards && window.toast) window.toast.rewards(result.rewards);
    } catch (err) {
      showError(err);
    } finally {
      saveBtn.disabled = false;
    }
  }

  /** Inserta (crear) o reemplaza (editar) la tarjeta en el DOM. */
  function applyCard(html, existingId) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html.trim();
    const card = tmp.firstElementChild;
    if (existingId) {
      const old = list.querySelector(`[data-habit-id="${existingId}"]`);
      if (old) old.replaceWith(card);
    } else {
      list.appendChild(card);
    }
    if (emptyState) emptyState.hidden = true;
  }

  // ---- Acciones sobre tarjetas (delegación) --------------------------------

  async function archiveHabit(card) {
    const id = card.dataset.habitId;
    try {
      await window.api.del(`/api/habits/${id}`);
      card.remove();
      if (!list.children.length && emptyState) emptyState.hidden = false;
    } catch (err) {
      showError(err);
    }
  }

  async function restoreHabit(card) {
    const id = card.dataset.habitId;
    try {
      const result = await window.api.post(`/api/habits/${id}/restore`, {});
      card.remove();
      applyCard(result.html, null);
    } catch (err) {
      alert(err.message);
    }
  }

  async function moveHabit(card, dir) {
    const sibling = dir === 'up' ? card.previousElementSibling : card.nextElementSibling;
    if (!sibling) return;
    // Reinsertar en el DOM reinicia la animación de entrada (parpadeo): anularla.
    card.style.animation = 'none';
    sibling.style.animation = 'none';
    if (dir === 'up') list.insertBefore(card, sibling);
    else list.insertBefore(sibling, card);
    const order = [...list.querySelectorAll('.habit-card')].map((c) => Number(c.dataset.habitId));
    try {
      await window.api.post('/api/habits/reorder', { order });
    } catch (err) {
      // Revertir si el servidor rechaza.
      if (dir === 'up') list.insertBefore(sibling, card);
      else list.insertBefore(card, sibling);
      alert(err.message);
    }
  }

  // ---- Colapsable móvil + reorder por long-press ---------------------------

  const isMobile = () => window.matchMedia('(max-width: 560px)').matches;
  let suppressNextClick = false; // evita que un drag termine abriendo la tarjeta

  function toggleCardOpen(card) {
    const open = card.classList.toggle('is-open');
    const chevron = card.querySelector('.hc-expand');
    if (chevron) chevron.setAttribute('aria-expanded', String(open));
  }

  /** Reordenar arrastrando tras mantener oprimido (solo táctil). */
  function setupTouchReorder() {
    if (!list) return;
    let pressTimer = null;
    let dragging = null;
    let startY = 0;
    let orderBefore = null;

    const cancelPress = () => {
      clearTimeout(pressTimer);
      pressTimer = null;
    };

    let anchorY = 0; // Y del puntero en el último cambio de posición en el DOM

    list.addEventListener('pointerdown', (e) => {
      if (!isMobile() || e.pointerType === 'mouse') return;
      const card = e.target.closest('.habit-card');
      if (!card || card.classList.contains('is-archived')) return;
      if (e.target.closest('button, a, input')) return;
      startY = e.clientY;
      pressTimer = setTimeout(() => {
        dragging = card;
        anchorY = startY;
        orderBefore = [...list.querySelectorAll('.habit-card')].map((c) => c.dataset.habitId);
        card.classList.add('is-dragging');
        if (navigator.vibrate) navigator.vibrate(15);
      }, 400);
    });

    document.addEventListener('pointermove', (e) => {
      // Si el dedo se mueve antes del long-press, es un scroll: cancelar.
      if (pressTimer && !dragging && Math.abs(e.clientY - startY) > 8) cancelPress();
      if (!dragging) return;

      // La tarjeta sigue al dedo (translate desde su hueco actual).
      dragging.style.transform = `translateY(${e.clientY - anchorY}px) scale(1.02)`;

      const siblings = [...list.querySelectorAll('.habit-card:not(.is-dragging)')];
      const next = siblings.find((c) => {
        const r = c.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
      });
      const target = next || null;
      // Solo tocar el DOM si la posición realmente cambia.
      if (target !== dragging.nextElementSibling) {
        if (target) list.insertBefore(dragging, target);
        else list.appendChild(dragging);
        // Re-anclar: la tarjeta ocupa su nuevo hueco y sigue bajo el dedo.
        anchorY = e.clientY;
        dragging.style.transform = 'scale(1.02)';
      }
    });

    // Con drag activo, bloquear el scroll de la página.
    list.addEventListener(
      'touchmove',
      (e) => {
        if (dragging) e.preventDefault();
      },
      { passive: false }
    );

    async function endDrag() {
      cancelPress();
      if (!dragging) return;
      const card = dragging;
      dragging = null;
      card.style.transform = '';
      card.classList.remove('is-dragging');
      suppressNextClick = true;
      setTimeout(() => (suppressNextClick = false), 350);

      const order = [...list.querySelectorAll('.habit-card')].map((c) => Number(c.dataset.habitId));
      if (order.join() === orderBefore.join()) return; // sin cambios
      try {
        await window.api.post('/api/habits/reorder', { order });
        if (navigator.vibrate) navigator.vibrate(8);
      } catch (err) {
        // Revertir al orden original si el servidor rechaza.
        orderBefore.forEach((id) => {
          const c = list.querySelector(`[data-habit-id="${id}"]`);
          if (c) list.appendChild(c);
        });
        alert(err.message);
      }
    }
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);
  }
  setupTouchReorder();

  // Tap en la tarjeta (fuera de botones/links) también despliega en móvil.
  if (list) {
    list.addEventListener('click', (e) => {
      if (!isMobile() || suppressNextClick) return;
      if (e.target.closest('button, a, input')) return;
      const card = e.target.closest('.habit-card');
      if (card && !card.classList.contains('is-archived')) toggleCardOpen(card);
    });
  }

  // ---- Cableado de eventos -------------------------------------------------

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.dataset.action;

    if (action === 'new-habit') return startCreate();
    if (action === 'close') return closeModal();

    const card = trigger.closest('.habit-card');
    if (!card) return;
    if (action === 'card-toggle') toggleCardOpen(card);
    else if (action === 'edit') startEdit(card);
    else if (action === 'archive') archiveHabit(card);
    else if (action === 'restore') restoreHabit(card);
    else if (action === 'up') moveHabit(card, 'up');
    else if (action === 'down') moveHabit(card, 'down');
  });

  document.querySelectorAll('.type-option').forEach((btn) => {
    btn.addEventListener('click', () => selectType(btn.dataset.type));
  });
  document.querySelectorAll('.icon-choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      el('habit-icon').value = btn.dataset.emoji;
      syncIconSelection(btn.dataset.emoji);
    });
  });
  // Si el usuario escribe su propio emoji, desmarcar la cuadrícula.
  el('habit-icon').addEventListener('input', () => syncIconSelection(el('habit-icon').value.trim()));
  document.querySelectorAll('.swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      el('habit-color').value = btn.dataset.color;
      syncColorSelection(btn.dataset.color);
    });
  });

  form.addEventListener('submit', submit);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
})();
