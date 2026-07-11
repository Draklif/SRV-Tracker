'use strict';

/**
 * Logros: la tarjeta solo muestra el título (recortado con puntos suspensivos).
 * Al pulsarla se despliega con el título completo y su descripción.
 */
(function () {
  const grid = document.querySelector('.ach-grid');
  if (!grid) return;

  grid.querySelectorAll('.ach-badge.is-unlocked').forEach((badge) => {
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.setAttribute('aria-expanded', 'false');
  });

  function toggle(badge) {
    const open = badge.classList.toggle('is-open');
    badge.setAttribute('aria-expanded', String(open));
  }

  grid.addEventListener('click', (e) => {
    const badge = e.target.closest('.ach-badge.is-unlocked');
    if (badge) toggle(badge);
  });

  grid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const badge = e.target.closest('.ach-badge.is-unlocked');
    if (!badge) return;
    e.preventDefault();
    toggle(badge);
  });
})();
