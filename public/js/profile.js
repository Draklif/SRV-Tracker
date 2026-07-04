'use strict';

/**
 * Perfil: elegir una imagen para el avatar la sube de inmediato
 * (el label sobre el avatar abre el selector; sin botón intermedio).
 */
(function () {
  const input = document.getElementById('avatar-input');
  if (!input) return;
  input.addEventListener('change', () => {
    if (input.files && input.files.length) input.form.submit();
  });
})();

/**
 * Código de invitación: copiar al portapapeles y cuenta atrás en vivo hasta
 * que caduca. Al llegar a cero, se atenúa (el servidor ya lo trata como expirado).
 */
(function () {
  const copyBtn = document.querySelector('.invite-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const code = copyBtn.dataset.code;
      try {
        await navigator.clipboard.writeText(code);
      } catch (_) {
        return; // Sin permiso de portapapeles: no molestamos con un error.
      }
      if (window.toast) window.toast.show('Código copiado ✅', { type: 'info', duration: 1800 });
    });
  }

  const active = document.querySelector('.invite-active');
  const expiryEl = active && active.querySelector('.invite-expiry');
  if (!active || !expiryEl) return;

  const expiresAt = new Date(active.dataset.expiresAt).getTime();

  function tick() {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      expiryEl.textContent = 'Este código caducó. Genera uno nuevo.';
      active.classList.add('is-expired');
      clearInterval(timer);
      return;
    }
    const totalSec = Math.floor(remaining / 1000);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    expiryEl.textContent = `Caduca en ${mm}:${ss}`;
  }

  tick();
  const timer = setInterval(tick, 1000);
})();
