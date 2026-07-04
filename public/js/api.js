'use strict';

/**
 * Cliente HTTP mínimo para la API JSON. Adjunta el token CSRF (del <meta>) en
 * cada mutación y normaliza errores: lanza un Error con `.status` y `.fields`.
 */
(function () {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

  async function request(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      /* respuesta sin cuerpo JSON */
    }

    if (!res.ok) {
      const err = new Error((data && data.error) || 'Algo salió mal. Inténtalo de nuevo.');
      err.status = res.status;
      err.fields = (data && data.fields) || null;
      throw err;
    }
    return data;
  }

  window.api = {
    post: (url, body) => request('POST', url, body),
    patch: (url, body) => request('PATCH', url, body),
    del: (url) => request('DELETE', url),
  };
})();
