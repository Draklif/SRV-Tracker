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

  // ---- Apertura / cierre del modal ----------------------------------------

  function openModal() {
    errorBox.hidden = true;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    el('habit-name').focus();
  }

  function closeModal() {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function resetForm() {
    form.reset();
    el('habit-id').value = '';
    el('habit-color').value = 'blue';
    el('habit-icon').value = '⭐';
    el('habit-type').value = '';
    syncColorSelection('blue');
    document.querySelectorAll('.type-option').forEach((b) => b.classList.remove('is-selected'));
  }

  function startCreate() {
    resetForm();
    el('habit-modal-title').textContent = 'Nuevo hábito';
    el('type-picker-wrap').hidden = false;
    el('type-fixed-wrap').hidden = true;
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

    el('habit-id').value = cfg.id;
    el('habit-type').value = cfg.type;
    el('habit-name').value = cfg.name;
    el('habit-icon').value = cfg.icon;
    el('habit-color').value = cfg.color;
    syncColorSelection(cfg.color);
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
  }

  function syncColorSelection(color) {
    document.querySelectorAll('.swatch').forEach((b) => {
      b.classList.toggle('is-selected', b.dataset.color === color);
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

  // ---- Cableado de eventos -------------------------------------------------

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.dataset.action;

    if (action === 'new-habit') return startCreate();
    if (action === 'close') return closeModal();
    if (action === 'type' /* unused */) return;

    const card = trigger.closest('.habit-card');
    if (!card) return;
    if (action === 'edit') startEdit(card);
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
    });
  });
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
