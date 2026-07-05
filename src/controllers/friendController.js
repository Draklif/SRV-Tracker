'use strict';

const friendshipService = require('../services/friendshipService');
const userRepository = require('../models/userRepository');
const asyncHandler = require('../utils/asyncHandler');
const renderPartial = require('../utils/renderPartial');
const { friendRequestSchema } = require('../validators/friendValidators');

/**
 * Controlador del sistema de amigos. Cada mutación devuelve:
 *  - `actionHtml`: el bloque de botones de la fila (para el perfil /u/:username).
 *  - Si la petición viene del hub (`?hub=1`): las tres listas ya re-renderizadas
 *    (amigos, solicitudes y directorio con el término `?q=`), para mantener
 *    todas las pestañas sincronizadas sin recargar.
 *  - `pendingCount`/`friendsCount`: para refrescar badges y contadores.
 */

/** Renderiza el bloque de botones de una fila de usuario para un estado dado. */
function actionHtml(res, { rel, friendshipId, rowUser }) {
  return renderPartial(res, 'partials/user-row-action', { rel, friendshipId, rowUser });
}

/** Fragmentos del hub (listas completas) para sincronizar todas las pestañas. */
async function hubFragments(req, res) {
  const userId = req.user.id;
  const overview = friendshipService.overview(userId);
  const search = typeof req.query.q === 'string' ? req.query.q : '';
  const directory = friendshipService.directory(userId, search);
  const [friendsHtml, requestsHtml, discoverHtml] = await Promise.all([
    renderPartial(res, 'partials/friends-panel-body', { friends: overview }),
    renderPartial(res, 'partials/requests-panel-body', { friends: overview }),
    renderPartial(res, 'partials/discover-list', { directory }),
  ]);
  return {
    friendsHtml,
    requestsHtml,
    discoverHtml,
    friendsCount: overview.friends.length,
    pendingCount: overview.pendingCount,
  };
}

/** Respuesta común: base + (si es del hub) las listas re-renderizadas. */
async function respond(req, res, base) {
  const body = { ok: true, pendingCount: friendshipService.incomingCount(req.user.id), ...base };
  if (req.query.hub === '1') Object.assign(body, await hubFragments(req, res));
  res.json(body);
}

/** POST /api/friends/request — envía (o auto-acepta) una solicitud. */
const request = asyncHandler(async (req, res) => {
  const { username } = friendRequestSchema.parse(req.body);
  const { friendship, autoAccepted } = friendshipService.request(req.user.id, username);
  const rowUser = userRepository.findByUsername(username);
  const rel = autoAccepted ? 'friends' : 'pending_out';
  await respond(req, res, {
    rel,
    autoAccepted,
    actionHtml: await actionHtml(res, { rel, friendshipId: friendship.id, rowUser }),
  });
});

/** POST /api/friends/:id/accept — acepta una solicitud entrante. */
const accept = asyncHandler(async (req, res) => {
  const friendship = friendshipService.accept(req.user.id, req.params.id);
  await respond(req, res, {
    rel: 'friends',
    actionHtml: await actionHtml(res, { rel: 'friends', friendshipId: friendship.id }),
  });
});

/** Fábrica de handlers para acciones que borran la relación (rel → none). */
function makeDeleteHandler(serviceFn) {
  return asyncHandler(async (req, res) => {
    const otherUserId = serviceFn(req.user.id, req.params.id);
    const rowUser = userRepository.findById(otherUserId);
    await respond(req, res, {
      rel: 'none',
      actionHtml: await actionHtml(res, { rel: 'none', friendshipId: null, rowUser }),
    });
  });
}

const decline = makeDeleteHandler(friendshipService.decline);
const cancel = makeDeleteHandler(friendshipService.cancel);
const remove = makeDeleteHandler(friendshipService.remove);

module.exports = { request, accept, decline, cancel, remove };
