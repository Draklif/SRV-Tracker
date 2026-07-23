(function () {
  'use strict';

  /**
   * Panel de admin: pestañas + descuentos, ajustes de tienda, cajas, cosméticos y
   * difusión. El servidor valida y decide; esto envía y refleja la respuesta.
   *
   * Nota: se accede a los controles por `form.elements`/querySelector y NO por
   * `form.<name>`, porque nombres como `name` o `hidden` chocan con propiedades
   * nativas del elemento <form>.
   */
  const page = document.querySelector('.admin-page');
  if (!page) return;

  const val = (form, name) => {
    const el = form.querySelector(`[name="${name}"]`);
    return el ? el.value : '';
  };
  const checked = (form, name) => {
    const el = form.querySelector(`[name="${name}"]`);
    return Boolean(el && el.checked);
  };

  // ---- Pestañas (cambian el contenido, no navegan) -------------------------
  const tabs = Array.from(page.querySelectorAll('[data-admin-tab]'));
  const sections = Array.from(page.querySelectorAll('[data-admin-section]'));
  function showTab(key) {
    tabs.forEach((t) => {
      const on = t.dataset.adminTab === key;
      t.classList.toggle('is-active', on);
      if (on) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
    sections.forEach((s) => {
      s.hidden = s.dataset.adminSection !== key;
    });
  }
  tabs.forEach((t) =>
    t.addEventListener('click', () => {
      showTab(t.dataset.adminTab);
      history.replaceState(null, '', `#${t.dataset.adminTab}`);
    })
  );
  const initial = location.hash.replace('#', '');
  if (sections.some((s) => s.dataset.adminSection === initial)) showTab(initial);

  /** Recarga manteniendo la pestaña actual (para creaciones/toggles). */
  function reloadTo(section) {
    history.replaceState(null, '', `#${section}`);
    setTimeout(() => window.location.reload(), 500);
  }

  /** Envía un form con toast de error y, si va bien, recarga a su pestaña. */
  async function submitForm(form, url, payload, section) {
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      await window.api.post(url, payload);
      window.toast.show('Guardado.', { type: 'success' });
      reloadTo(section);
    } catch (err) {
      if (btn) btn.disabled = false;
      window.toast.show(err.message, { type: 'warn' });
    }
  }

  // ---- Descuentos ----------------------------------------------------------
  const discountForm = page.querySelector('[data-admin-form="discount"]');
  if (discountForm) {
    discountForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      submitForm(
        discountForm,
        '/api/admin/discounts',
        {
          itemKey: val(discountForm, 'itemKey'),
          percent: parseInt(val(discountForm, 'percent'), 10) || 0,
          startsOn: val(discountForm, 'startsOn') || undefined,
          endsOn: val(discountForm, 'endsOn') || undefined,
        },
        'descuentos'
      );
    });
  }

  // ---- Ajustes de tienda (overrides) ---------------------------------------
  const overrideForm = page.querySelector('[data-admin-form="override"]');
  if (overrideForm) {
    overrideForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const price = val(overrideForm, 'price');
      submitForm(
        overrideForm,
        '/api/admin/overrides',
        {
          itemKey: val(overrideForm, 'itemKey'),
          price: price === '' ? undefined : parseInt(price, 10),
          hidden: val(overrideForm, 'hidden'),
        },
        'tienda'
      );
    });
  }

  // ---- Cajas ---------------------------------------------------------------
  const lootboxForm = page.querySelector('[data-admin-form="lootbox"]');
  if (lootboxForm) {
    lootboxForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const poolSel = lootboxForm.querySelector('[data-lb-pool]');
      const pool = poolSel ? Array.from(poolSel.selectedOptions).map((o) => o.value) : [];
      submitForm(
        lootboxForm,
        '/api/admin/lootboxes',
        {
          name: val(lootboxForm, 'name'),
          price: parseInt(val(lootboxForm, 'price'), 10) || 0,
          art: val(lootboxForm, 'art'),
          description: val(lootboxForm, 'description') || undefined,
          pool,
        },
        'cajas'
      );
    });
  }

  // ---- Cosméticos ----------------------------------------------------------
  const cosmeticForm = page.querySelector('[data-admin-form="cosmetic"]');
  if (cosmeticForm) {
    const slotSel = cosmeticForm.querySelector('[data-co-slot]');
    const CSS_SLOTS = ['avatar_frame', 'card_bg', 'card_frame'];

    function showCoPanes(slot) {
      const map = {
        text: slot === 'title',
        glyph: slot === 'avatar_deco',
        css: CSS_SLOTS.includes(slot),
        ink: slot === 'card_bg',
      };
      cosmeticForm.querySelectorAll('[data-co-pane]').forEach((pane) => {
        pane.hidden = !map[pane.dataset.coPane];
      });
    }
    slotSel.addEventListener('change', () => showCoPanes(slotSel.value));
    showCoPanes(slotSel.value);

    cosmeticForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const slot = slotSel.value;
      const payload = {
        slot,
        name: val(cosmeticForm, 'name'),
        rarity: val(cosmeticForm, 'rarity'),
        price: parseInt(val(cosmeticForm, 'price'), 10) || 0,
        hidden: checked(cosmeticForm, 'hidden'),
      };
      if (slot === 'title') {
        payload.text = val(cosmeticForm, 'text');
      } else if (slot === 'avatar_deco') {
        payload.glyph = val(cosmeticForm, 'glyph');
      } else if (CSS_SLOTS.includes(slot)) {
        payload.css = val(cosmeticForm, 'css');
        payload.gap = checked(cosmeticForm, 'gap');
        payload.innerBorder = checked(cosmeticForm, 'innerBorder');
        payload.replaceBorder = checked(cosmeticForm, 'replaceBorder');
        if (slot === 'card_bg') payload.ink = val(cosmeticForm, 'ink');
      }
      submitForm(cosmeticForm, '/api/admin/cosmetics', payload, 'cosmeticos');
    });
  }

  // ---- Difusión ------------------------------------------------------------
  const bcForm = page.querySelector('[data-admin-form="broadcast"]');
  if (bcForm) {
    const typeSel = bcForm.querySelector('[data-bc-type]');
    const boxSel = bcForm.querySelector('[data-bc-box]');
    const cosmeticSel = bcForm.querySelector('[data-bc-cosmetic]');
    const submitBtn = bcForm.querySelector('[data-bc-submit]');

    function showPane(type) {
      bcForm.querySelectorAll('[data-bc-pane]').forEach((pane) => {
        pane.hidden = pane.dataset.bcPane !== type;
      });
    }
    typeSel.addEventListener('change', () => showPane(typeSel.value));
    showPane(typeSel.value);

    bcForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const type = typeSel.value;
      const payload = { type, message: val(bcForm, 'message') || undefined };
      if (type === 'coins') payload.amount = parseInt(val(bcForm, 'amount'), 10) || 0;
      else if (type === 'lootbox') payload.key = boxSel.value;
      else payload.key = cosmeticSel.value;

      if (!window.confirm('Esto reparte el regalo a TODOS los usuarios. ¿Seguro?')) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Repartiendo…';
      try {
        const res = await window.api.post('/api/admin/broadcast', payload);
        window.toast.show(`Repartido a ${res.count} usuario(s): ${res.label} 🎁`, {
          type: 'success',
          duration: 4000,
        });
        bcForm.reset();
        showPane(typeSel.value);
      } catch (err) {
        window.toast.show(err.message, { type: 'warn' });
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Repartir a todos';
      }
    });
  }

  // ---- Acciones de las listas (borrar / habilitar) -------------------------
  const DELETE_PATH = {
    discount: (id) => `/api/admin/discounts/${encodeURIComponent(id)}`,
    override: (id) => `/api/admin/overrides/${encodeURIComponent(id)}`,
    lootbox: (id) => `/api/admin/lootboxes/${encodeURIComponent(id)}`,
    cosmetic: (id) => `/api/admin/cosmetics/${encodeURIComponent(id)}`,
  };

  page.addEventListener('click', async (ev) => {
    const del = ev.target.closest('[data-admin-delete]');
    const tog = ev.target.closest('[data-admin-toggle]');
    if (!del && !tog) return;

    const item = ev.target.closest('.admin-list-item');
    if (!item) return;
    const id = item.dataset.id;

    // Borrar
    if (del) {
      const type = del.dataset.adminDelete;
      if ((type === 'lootbox' || type === 'cosmetic') && !window.confirm('¿Borrar definitivamente?')) return;
      del.disabled = true;
      try {
        await window.api.del(DELETE_PATH[type](id));
        const list = item.closest('.admin-list');
        item.remove();
        if (list && !list.querySelector('.admin-list-item')) {
          const empty = page.querySelector(`[data-admin-empty="${type}"]`);
          if (empty) empty.hidden = false;
        }
        window.toast.show('Hecho.', { type: 'success' });
      } catch (err) {
        del.disabled = false;
        window.toast.show(err.message, { type: 'warn' });
      }
      return;
    }

    // Habilitar/deshabilitar caja u ocultar/mostrar cosmético
    if (tog) {
      const type = tog.dataset.adminToggle;
      tog.disabled = true;
      try {
        if (type === 'lootbox') {
          const enabled = item.dataset.enabled === '1';
          await window.api.post(`/api/admin/lootboxes/${encodeURIComponent(id)}/toggle`, { enabled: !enabled });
          reloadTo('cajas');
        } else {
          const hidden = item.dataset.hidden === '1';
          await window.api.post(`/api/admin/cosmetics/${encodeURIComponent(id)}/toggle`, { hidden: !hidden });
          reloadTo('cosmeticos');
        }
      } catch (err) {
        tog.disabled = false;
        window.toast.show(err.message, { type: 'warn' });
      }
    }
  });
})();
