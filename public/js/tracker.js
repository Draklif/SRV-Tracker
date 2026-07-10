'use strict';

/**
 * Tracker diario del dashboard: registra avances de cada hábito según su tipo
 * (check, +cantidad, escala, número, texto) vía API JSON y actualiza la tarjeta
 * y el progreso del día al instante, sin recargar.
 */
(function () {
  const list = document.getElementById('tracker-list');
  const page = document.querySelector('[data-today]');

  // ---- Cambio de día: si la página quedó abierta de ayer, recargar ---------
  // (evita ver hábitos "completados" que en realidad son del día anterior).
  async function checkDayRollover() {
    if (!page || document.hidden) return;
    try {
      const res = await fetch('/api/today', { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const { date } = await res.json();
      if (date && date !== page.dataset.today) window.location.reload();
    } catch {
      /* sin red: reintentará */
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkDayRollover();
  });
  window.addEventListener('focus', checkDayRollover);
  setInterval(checkDayRollover, 5 * 60 * 1000);

  if (!list) return;

  function dayMessage(dp) {
    if (dp.total === 0) return 'Aún no hay hábitos para hoy.';
    if (dp.done === dp.total) return '¡Todo listo por hoy! Disfruta 🎉';
    if (dp.done === 0) return 'Empieza cuando quieras 🌱';
    return '¡Vas muy bien! Sigue a tu ritmo.';
  }

  // ---- Construcción del cuerpo de la petición según la acción --------------

  function buildBody(action, btn, card) {
    switch (action) {
      case 'toggle':
        return { op: 'toggle' };
      case 'increment':
        return { op: 'increment', amount: Number(btn.dataset.amount) };
      case 'fill':
        // Rellena lo que falte hasta la meta del día (deja value/target = target).
        return { op: 'set', value: Number(card.dataset.target) || 0 };
      case 'scale':
        return { op: 'set', value: Number(btn.dataset.level) };
      case 'set-manual': {
        const input = card.querySelector('.tc-manual-input');
        return { op: 'set', value: Number(input.value || 0) };
      }
      case 'set-number': {
        const input = card.querySelector('.tc-num-input');
        if (input.value.trim() === '') return null;
        return { op: 'set', value: Number(input.value) };
      }
      case 'save-text': {
        const input = card.querySelector('.tc-text-input');
        return { op: 'text', text: input.value };
      }
      default:
        return null;
    }
  }

  // ---- Actualización del DOM tras la respuesta -----------------------------

  function updateCard(card, res) {
    const type = card.dataset.type;
    card.classList.toggle('is-complete', res.completed);

    const streakWrap = card.querySelector('[data-streak-wrap]');
    const streakNum = card.querySelector('[data-streak]');
    if (streakNum) streakNum.textContent = res.streak.current;
    if (streakWrap) streakWrap.hidden = res.streak.current <= 0;

    // Chip semanal (hábitos "N veces/semana"): reflejar la cuota al instante.
    if (res.week) {
      const weekEl = card.querySelector('.tc-week');
      if (weekEl) weekEl.textContent = `${res.week.done}/${res.week.target} esta semana`;
      card.classList.toggle('is-week-done', res.week.done >= res.week.target);
    }

    if (type === 'quantity' || type === 'duration') {
      const target = Number(card.dataset.target) || 0;
      const fill = card.querySelector('[data-fill]');
      const valEl = card.querySelector('[data-value]');
      if (valEl) valEl.textContent = res.value;
      if (fill) {
        const pct = target ? Math.min(100, Math.round((res.value / target) * 100)) : res.completed ? 100 : 0;
        fill.style.width = pct + '%';
      }
      const manual = card.querySelector('.tc-manual');
      if (manual) manual.hidden = true;
      const manualInput = card.querySelector('.tc-manual-input');
      if (manualInput) manualInput.value = res.value;
    } else if (type === 'checkbox') {
      const btn = card.querySelector('.tc-check');
      if (btn) {
        const wasDone = btn.classList.contains('is-done');
        btn.classList.toggle('is-done', res.completed);
        btn.setAttribute('aria-pressed', String(res.completed));
        if (res.completed && !wasDone) {
          btn.classList.remove('just-done');
          void btn.offsetWidth;
          btn.classList.add('just-done');
        }
      }
    } else if (type === 'scale') {
      card.querySelectorAll('.tc-scale-btn').forEach((b) => {
        b.classList.toggle('is-on', res.completed && Number(b.dataset.level) <= res.value);
      });
    } else if (type === 'numeric') {
      const input = card.querySelector('.tc-num-input');
      if (input && res.completed) input.value = res.value;
    }

    // Pequeño pulso de confirmación.
    card.classList.remove('tc-pulse');
    void card.offsetWidth;
    card.classList.add('tc-pulse');
  }

  function updateDayProgress(dp) {
    const box = document.querySelector('[data-day-progress]');
    if (!box) return;
    box.querySelector('[data-day-done]').textContent = dp.done;
    box.querySelector('[data-day-total]').textContent = dp.total;
    box.querySelector('.dp-ring').style.setProperty('--pct', dp.percent);
    box.querySelector('[data-day-msg]').textContent = dayMessage(dp);
  }

  function weekMessage(wp) {
    if (wp.done === wp.total) return '¡Cuotas de la semana cumplidas! 🌟';
    if (wp.done === 0) return 'Tus hábitos semanales te esperan.';
    return 'Buen ritmo con tus metas de la semana.';
  }

  function updateWeekProgress(wp) {
    const box = document.querySelector('[data-week-progress]');
    if (!box || !wp) return;
    box.querySelector('[data-week-done]').textContent = wp.done;
    box.querySelector('[data-week-total]').textContent = wp.total;
    box.querySelector('.dp-ring').style.setProperty('--pct', wp.percent);
    box.querySelector('[data-week-msg]').textContent = weekMessage(wp);
  }

  /** Actualiza la barra de nivel del saludo con el progreso recibido. */
  function updateLevel(progress) {
    if (!progress) return;
    const num = document.querySelector('[data-level-num]');
    const fill = document.querySelector('[data-level-fill]');
    const caption = document.querySelector('[data-level-caption]');
    if (num) num.textContent = `Nivel ${progress.level}`;
    if (fill) fill.style.width = progress.percent + '%';
    if (caption) {
      caption.textContent = `${progress.xp} XP · ${progress.toNext} para el nivel ${progress.level + 1}`;
    }
  }

  async function send(card, btn, body) {
    const id = card.dataset.habitId;
    btn.disabled = true;
    try {
      const res = await window.api.post(`/api/habits/${id}/log`, body);
      // Si el registro cayó en un día distinto al renderizado, refrescar todo.
      if (page && res.date && res.date !== page.dataset.today) {
        window.location.reload();
        return;
      }
      updateCard(card, res);
      updateDayProgress(res.dayProgress);
      updateWeekProgress(res.weekProgress);
      applyHideFilter();
      if (res.rewards) {
        updateLevel(res.rewards.progress);
        if (window.toast) window.toast.rewards(res.rewards);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false;
    }
  }

  // ---- Cableado ------------------------------------------------------------

  // ---- Ocultar hábitos ya completados (toggle sutil, persistido) ----------
  const HIDE_KEY = 'srv:hideDone';
  const hideToggle = document.querySelector('[data-hide-done]');

  /** ¿La tarjeta cuenta como "hecha" para el filtro de ocultar? */
  function cardIsDone(card) {
    // Los días libres no son obligatorios: no se ocultan como "hechos".
    if (card.classList.contains('is-rest')) return false;
    // Semanales: solo cuando cumplen su cuota (no por el registro de hoy).
    if (card.dataset.weekly === '1') return card.classList.contains('is-week-done');
    return card.classList.contains('is-complete');
  }

  function applyHideFilter() {
    const on = hideToggle && hideToggle.checked;
    list.querySelectorAll('.tracker-card').forEach((card) => {
      card.classList.toggle('is-filtered', Boolean(on) && cardIsDone(card));
    });
  }

  if (hideToggle) {
    hideToggle.checked = localStorage.getItem(HIDE_KEY) === '1';
    hideToggle.addEventListener('change', () => {
      localStorage.setItem(HIDE_KEY, hideToggle.checked ? '1' : '0');
      applyHideFilter();
    });
    applyHideFilter();
  }

  // ---- Expansión móvil: tap en la cabecera despliega los controles --------
  const isMobile = () => window.matchMedia('(max-width: 560px)').matches;

  function toggleCard(card) {
    const open = card.classList.toggle('is-open');
    const expandBtn = card.querySelector('[data-expand]');
    if (expandBtn) expandBtn.setAttribute('aria-expanded', String(open));
  }

  list.addEventListener('click', (e) => {
    if (!isMobile()) return;
    const expandBtn = e.target.closest('[data-expand]');
    if (expandBtn) return toggleCard(expandBtn.closest('.tracker-card'));
    // Tap en la cabecera (fuera de links/botones/inputs) también despliega.
    const top = e.target.closest('.tc-top');
    if (top && !e.target.closest('a, button, input, textarea')) {
      const card = top.closest('.tracker-card');
      if (card.querySelector('.tc-control')) toggleCard(card);
    }
  });

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-log]');
    if (!btn) return;
    const card = btn.closest('.tracker-card');
    const action = btn.dataset.log;

    if (action === 'toggle-manual') {
      const manual = card.querySelector('.tc-manual');
      manual.hidden = !manual.hidden;
      if (!manual.hidden) card.querySelector('.tc-manual-input').focus();
      return;
    }

    const body = buildBody(action, btn, card);
    if (body) send(card, btn, body);
  });
})();
