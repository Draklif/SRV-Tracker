'use strict';

/**
 * Colección: equipar y desequipar cosméticos.
 *
 * La vista previa se actualiza en el cliente (sin recargar), pero quien decide
 * qué es válido es SIEMPRE el servidor: si el POST falla, se revierte. Los datos
 * de cada objeto viajan en los data-* del botón, así que no hace falta inyectar
 * el catálogo en un <script> (la CSP no permite scripts inline).
 */
(function () {
  const page = document.querySelector('.collection-page');
  if (!page) return;

  const preview = document.getElementById('cos-preview');
  // El avatar de la barra de navegación es el MISMO usuario: se actualiza a la
  // par que la vista previa para que el marco/decoración no queden desfasados.
  const navWrap = document.querySelector('.nav-avatar .avatar-wrap');

  /** Quita de `el` las clases que empiecen por `prefix` y añade `next`. */
  function swapClass(el, prefix, next) {
    el.classList.forEach((c) => {
      if (c.startsWith(prefix)) el.classList.remove(c);
    });
    if (next) el.classList.add(next);
  }

  /**
   * Pone (o quita) la capa de marco/decoración en un envoltorio de avatar. La
   * capa puede no existir aún (avatar sin cosméticos al cargar): se crea. El
   * marco arrastra sus opciones de separación/borde interior al propio wrap.
   */
  function setAvatarLayer(wrap, slot, item) {
    if (!wrap) return;
    const baseClass = slot === 'avatar_frame' ? 'cos-frame' : 'cos-deco';
    let layer = wrap.querySelector('.' + baseClass);
    if (!layer) {
      layer = document.createElement('span');
      layer.setAttribute('aria-hidden', 'true');
      wrap.appendChild(layer);
    }
    layer.className = baseClass;
    if (item) layer.classList.add(item.css);
    if (slot === 'avatar_deco') layer.textContent = item ? item.glyph : '';
    layer.hidden = !item;

    // Separación y borde interior son propiedades del MARCO, viven en el wrap.
    if (slot === 'avatar_frame') {
      wrap.classList.toggle('cos-gap', Boolean(item && item.gap));
      wrap.classList.toggle('cos-inner', Boolean(item && item.inner));
    }
  }

  /** Pinta en la tarjeta de muestra lo que se acaba de equipar (o quitar). */
  function updatePreview(slot, item) {
    if (slot === 'avatar_frame' || slot === 'avatar_deco') {
      setAvatarLayer(preview.querySelector('.avatar-wrap'), slot, item);
      setAvatarLayer(navWrap, slot, item);
      return;
    }

    if (slot === 'card_bg' || slot === 'card_frame') {
      swapClass(preview, slot === 'card_bg' ? 'cos-bg-' : 'cos-cframe-', item ? item.css : null);
      // El fondo declara el tono de la tarjeta: la tinta se ajusta con él.
      if (slot === 'card_bg') {
        swapClass(preview, 'cos-ink-', item && item.ink ? 'cos-ink-' + item.ink : null);
      }
      // `cos-card` abre el contexto de apilado del fondo/marco: solo estorba si
      // no hay ninguno de los dos puestos.
      const hasAny =
        preview.className.includes('cos-bg-') || preview.className.includes('cos-cframe-');
      preview.classList.toggle('cos-card', hasAny);
      // El marco que trae su propio contorno oculta el borde base de la card;
      // y si tiene separación, se mete hacia dentro (no toca el borde).
      if (slot === 'card_frame') {
        preview.classList.toggle('cos-card-bare', Boolean(item && item.bare));
        preview.classList.toggle('cos-cframe-gap', Boolean(item && item.gap));
      }
      return;
    }

    if (slot === 'title') {
      const chip = preview.querySelector('[data-preview="title"]');
      chip.querySelector('[data-preview-text]').textContent = item ? item.text : '';
      chip.style.setProperty('--rarity-color', item ? item.color : 'transparent');
      chip.hidden = !item;
      // Reajusta el texto al nuevo título (encoge si no cabe en la etiqueta).
      if (item && window.cosmeticsFit) window.cosmeticsFit(preview);
    }
  }

  /** Marca el botón elegido como equipado y desmarca el resto de su hueco. */
  function updateTiles(slot, itemKey) {
    const section = page.querySelector(`.col-slot[data-slot="${slot}"]`);
    section.querySelectorAll('.col-item').forEach((tile) => {
      const on = tile.dataset.key === itemKey;
      tile.classList.toggle('is-equipped', on);
      tile.setAttribute('aria-pressed', String(on));
      const check = tile.querySelector('.col-item-check');
      if (on && !check) {
        const mark = document.createElement('span');
        mark.className = 'col-item-check';
        mark.textContent = '✓';
        tile.appendChild(mark);
      } else if (!on && check) {
        check.remove();
      }
    });
  }

  page.addEventListener('click', async (ev) => {
    const tile = ev.target.closest('.col-item');
    if (!tile || tile.disabled) return;

    const slot = tile.dataset.slot;
    // Volver a tocar lo que ya llevas puesto lo quita.
    const equipping = !tile.classList.contains('is-equipped');
    const itemKey = equipping ? tile.dataset.key : null;
    const item = equipping
      ? {
          css: tile.dataset.css,
          glyph: tile.dataset.glyph,
          text: tile.dataset.text,
          color: tile.dataset.color,
          bare: tile.dataset.bare === '1',
          gap: tile.dataset.gap === '1',
          inner: tile.dataset.inner === '1',
          ink: tile.dataset.ink || '',
        }
      : null;

    try {
      await window.api.post('/api/cosmetics/equip', { slot, itemKey });
      updateTiles(slot, itemKey);
      updatePreview(slot, item);
    } catch (err) {
      window.toast.show(err.message, { type: 'warn' });
    }
  });

  // ---- Filtros -------------------------------------------------------------
  // El buscador, la rareza y las pills los monta cosmetic-filters.js: los mismos
  // que en la Tienda. Lo propio de aquí es el armario: "ocultar los que no tengo"
  // (mismo gesto que "Ocultar hechos" del Inicio, y se recuerda entre visitas).
  const HIDE_KEY = 'srv:hideLocked';
  const hideToggle = page.querySelector('[data-hide-locked]');

  if (hideToggle) hideToggle.checked = localStorage.getItem(HIDE_KEY) === '1';

  const applyFilters = window.cosmeticFilters.init(page, {
    extra: (tile) =>
      !(hideToggle && hideToggle.checked) || !tile.classList.contains('is-locked'),
  });

  if (hideToggle) {
    hideToggle.addEventListener('change', () => {
      localStorage.setItem(HIDE_KEY, hideToggle.checked ? '1' : '0');
      applyFilters();
    });
  }
})();
