'use strict';

/**
 * Novedades: cada versión se despliega al pulsar su cabecera. La más reciente
 * llega abierta desde el servidor; el resto colapsadas.
 */
(function () {
  const list = document.querySelector('.changelog-list');
  if (!list) return;

  list.querySelectorAll('.changelog-entry').forEach((entry) => {
    const head = entry.querySelector('.changelog-entry-head');
    if (!head) return;
    head.setAttribute('role', 'button');
    head.setAttribute('tabindex', '0');
    head.setAttribute('aria-expanded', String(entry.classList.contains('is-open')));
  });

  function toggle(head) {
    const open = head.closest('.changelog-entry').classList.toggle('is-open');
    head.setAttribute('aria-expanded', String(open));
  }

  list.addEventListener('click', (e) => {
    const head = e.target.closest('.changelog-entry-head');
    if (head) toggle(head);
  });

  list.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const head = e.target.closest('.changelog-entry-head');
    if (!head) return;
    e.preventDefault();
    toggle(head);
  });
})();
