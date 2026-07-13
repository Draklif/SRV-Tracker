'use strict';

/**
 * Ajuste de títulos cosméticos. La etiqueta (.cos-title) crece con el texto
 * hasta su ancho máximo (lo marca el contenedor con max-width). A partir de ahí
 * el texto no debe desbordar ni recortarse: encoge SOLO el texto por dentro, sin
 * encoger la etiqueta. Se hace en JS porque CSS no sabe medir "cabe o no cabe".
 */
(function () {
  var MIN_PX = 8; // suelo del texto: por debajo no se encoge más

  function fitOne(tag) {
    if (!tag || tag.hidden) return;
    var span = tag.querySelector('span');
    if (!span) return;

    span.style.fontSize = ''; // parte del tamaño de CSS en cada medición
    var cs = getComputedStyle(tag);
    var avail = tag.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (avail <= 0) return;

    var size = parseFloat(getComputedStyle(span).fontSize);
    var guard = 60; // tope de iteraciones, por si acaso
    while (span.scrollWidth > avail && size > MIN_PX && guard-- > 0) {
      size -= 0.5;
      span.style.fontSize = size + 'px';
    }
  }

  function fitAll(root) {
    (root || document).querySelectorAll('.cos-title').forEach(fitOne);
  }

  // Expuesto para que la colección re-ajuste al equipar un título nuevo.
  window.cosmeticsFit = fitAll;

  if (document.readyState !== 'loading') fitAll();
  else document.addEventListener('DOMContentLoaded', function () { fitAll(); });

  var t;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(function () { fitAll(); }, 150);
  });
})();
