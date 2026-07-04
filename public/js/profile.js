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
