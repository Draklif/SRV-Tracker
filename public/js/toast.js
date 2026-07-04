'use strict';

/**
 * Toasts y confeti. Notificaciones efímeras (XP, logros, nivel) con el
 * lenguaje visual de la app. Sin dependencias.
 *
 *   window.toast.show('+15 XP', { type: 'xp' })
 *   window.toast.achievement({ icon: '🔥', name: 'Fuego', description: '…' })
 *   window.toast.confetti()
 */
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function stack() {
    let el = document.getElementById('toast-stack');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast-stack';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  }

  function dismiss(el) {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 300);
  }

  function show(message, { type = 'info', duration = 3200, html = null } = {}) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    if (html) el.innerHTML = html;
    else el.textContent = message;
    el.addEventListener('click', () => dismiss(el));
    stack().appendChild(el);
    setTimeout(() => dismiss(el), duration);
  }

  function achievement({ icon, name, description }) {
    show(null, {
      type: 'achievement',
      duration: 5000,
      html: `
        <span class="toast-ach-icon">${icon}</span>
        <span class="toast-ach-body">
          <b>¡Logro desbloqueado!</b>
          <span>${name}</span>
          <small>${description}</small>
        </span>`,
    });
  }

  /** Lluvia breve de fichas de colores (respeta prefers-reduced-motion). */
  function confetti() {
    if (reduceMotion) return;
    const colors = ['#4f8cff', '#39c6d6', '#4fce8f', '#8f7bf2', '#d97ba8', '#ffcf66', '#e8945a'];
    const box = document.createElement('div');
    box.className = 'confetti-box';
    for (let i = 0; i < 36; i += 1) {
      const piece = document.createElement('i');
      piece.style.left = Math.random() * 100 + '%';
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = Math.random() * 0.35 + 's';
      piece.style.animationDuration = 1.1 + Math.random() * 0.9 + 's';
      piece.style.setProperty('--drift', (Math.random() * 2 - 1).toFixed(2));
      box.appendChild(piece);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 2600);
  }

  /**
   * Muestra las recompensas de una respuesta de la API (si las hay):
   * XP ganado, logros desbloqueados y subida de nivel.
   */
  function rewards(r) {
    if (!r) return;
    if (r.xpGained > 0) show(`+${r.xpGained} XP`, { type: 'xp', duration: 2200 });
    (r.achievements || []).forEach((a, i) => setTimeout(() => achievement(a), 350 * (i + 1)));
    if (r.leveledUp) {
      setTimeout(() => {
        show(`¡Subiste al nivel ${r.leveledUp}! 🎉`, { type: 'level', duration: 4500 });
        confetti();
      }, 500);
    } else if ((r.achievements || []).length) {
      confetti();
    }
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : s;
    return d.innerHTML;
  }

  /**
   * Muestra los mensajes flash del servidor (guardados en `#flash-data` como
   * JSON) como toasts efímeros. Se ejecuta con `defer`, así que el DOM ya está
   * parseado y el bloque de datos está disponible.
   */
  function initFlash() {
    const node = document.getElementById('flash-data');
    if (!node) return;
    let messages;
    try {
      messages = JSON.parse(node.textContent);
    } catch (e) {
      return;
    }
    const icons = { success: '✅', warn: '🌤️', info: 'ℹ️' };
    (messages || []).forEach((m) => {
      const type = m.type === 'success' || m.type === 'warn' ? m.type : 'info';
      show(null, {
        type,
        html:
          `<span class="toast-flash-icon">${icons[type] || icons.info}</span>` +
          `<span>${escapeHtml(m.message)}</span>`,
      });
    });
  }

  window.toast = { show, achievement, confetti, rewards };
  initFlash();
})();
