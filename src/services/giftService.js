'use strict';

const giftRepository = require('../models/giftRepository');
const cosmeticRepository = require('../models/cosmeticRepository');
const lootboxRepository = require('../models/lootboxRepository');
const friendshipRepository = require('../models/friendshipRepository');
const userRepository = require('../models/userRepository');
const coinService = require('./coinService');
const discountService = require('./discountService');
const catalogService = require('./catalogService');
const pushService = require('./pushService');
const withTransaction = require('../database/withTransaction');
const { todayFor } = require('../utils/date');
const { DUP_REFUND } = require('../config/lootboxes');
const {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} = require('../utils/errors');

/**
 * Regalos: enviar monedas, una caja o un cosmético a otro usuario, y reclamarlos.
 *
 * Dos entradas, un solo mecanismo:
 *   - send()      → 1:1 entre amigos. El emisor PAGA al enviar (cobro atómico con
 *                   guarda). El receptor lo reclama después.
 *   - broadcast() → difusión de admin a todos (o a un segmento). Sin cobro
 *                   (sender_id = NULL). Misma tabla, mismas reclamaciones.
 *
 * Reclamar (claim) es idempotente por un UPDATE con guarda en la fila: dos
 * reclamaciones a la vez solo conceden una. El contenido se entrega por las vías
 * de siempre (credit / lootboxRepository.add / grant), que ya respetan los ledgers.
 */

const TYPES = Object.freeze(['coins', 'lootbox', 'cosmetic']);
const MAX_COINS_GIFT = 100000; // techo de cordura para un regalo de monedas
const MAX_MESSAGE = 200;

/** Normaliza y valida la nota opcional. */
function cleanMessage(message) {
  if (message == null) return null;
  const trimmed = String(message).trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_MESSAGE) {
    throw new ValidationError({ message: `La nota no puede pasar de ${MAX_MESSAGE} caracteres.` });
  }
  return trimmed;
}

/**
 * Resuelve el contenido de un regalo a { type, payloadKey, amount, cost, label }.
 * `cost` es lo que costaría enviarlo (el emisor lo paga; en difusión se ignora).
 * Valida que el tipo y la carga sean coherentes; el precio SIEMPRE lo pone el
 * servidor desde el catálogo, nunca el cliente.
 */
function resolvePayload({ type, key, amount }, day) {
  if (!TYPES.includes(type)) {
    throw new ValidationError({ type: 'Tipo de regalo no válido.' });
  }

  if (type === 'coins') {
    const n = Number(amount);
    if (!Number.isInteger(n) || n <= 0) {
      throw new ValidationError({ amount: 'Indica cuántas monedas quieres regalar.' });
    }
    if (n > MAX_COINS_GIFT) {
      throw new ValidationError({ amount: `Como mucho ${MAX_COINS_GIFT} monedas por regalo.` });
    }
    return { type, payloadKey: null, amount: n, cost: n, label: `${n} monedas` };
  }

  if (type === 'lootbox') {
    const box = catalogService.boxesByKey()[key];
    if (!box || box.enabled === false) throw new NotFoundError('Esa caja no existe.');
    return { type, payloadKey: box.key, amount: null, cost: box.price, label: box.name };
  }

  // cosmetic
  const item = catalogService.itemsByKey()[key];
  if (!item) throw new NotFoundError('Ese objeto no existe.');
  if (item.hidden || !(item.price > 0)) {
    throw new ForbiddenError('Ese objeto no se puede regalar.');
  }
  const cost = discountService.effectivePrice(item, day);
  return { type, payloadKey: item.key, amount: null, cost, label: item.name };
}

/** Dispara el push de "tienes un regalo" al receptor. Fire-and-forget. */
function notifyRecipient(recipientId, label, fromName) {
  const body = fromName ? `${fromName} te ha enviado ${label}.` : `Has recibido ${label}.`;
  pushService
    .sendToUser(recipientId, { title: '🎁 ¡Tienes un regalo!', body, url: '/tienda', tag: 'gift' })
    .catch(() => {});
}

/**
 * Regala una caja a un amigo. Entre usuarios SOLO se regalan cajas, y siempre
 * una que YA TIENES en tu inventario: se saca de tu inventario (con guarda) y no
 * se te cobra nada (ya la pagaste al comprarla). El amigo la recibe pendiente.
 *
 * Devuelve { gift, label, boxKey }.
 */
function send(sender, { recipientId, key, message }) {
  const rid = Number(recipientId);
  if (!Number.isInteger(rid)) throw new ValidationError({ recipientId: 'Destinatario no válido.' });
  if (rid === sender.id) throw new ValidationError({ recipientId: 'No puedes regalarte a ti mismo.' });

  const recipient = userRepository.findById(rid);
  if (!recipient) throw new NotFoundError('Ese usuario no existe.');
  if (!friendshipRepository.friendIds(sender.id).includes(rid)) {
    throw new ForbiddenError('Solo puedes regalar a tus amigos.');
  }

  const box = catalogService.boxesByKey()[key];
  if (!box || box.enabled === false) throw new NotFoundError('Esa caja no existe.');

  const note = cleanMessage(message);

  const gift = withTransaction(() => {
    // Sacar una caja de TU inventario, con guarda (qty > 0): si no la tienes, no
    // se crea el regalo. No hay cobro: la caja ya estaba pagada.
    if (!lootboxRepository.takeOne(sender.id, box.key)) {
      throw new ConflictError('No tienes esa caja en tu inventario.');
    }
    return giftRepository.create({
      senderId: sender.id,
      recipientId: rid,
      type: 'lootbox',
      payloadKey: box.key,
      message: note,
    });
  });

  notifyRecipient(rid, box.name, sender.display_name || sender.username);
  return { gift, label: box.name, boxKey: box.key };
}

/**
 * Reclama un regalo pendiente. Idempotente por el UPDATE con guarda: si ya se
 * reclamó (o no es del usuario), lanza ConflictError y no concede nada.
 * Devuelve { type, label, balance }.
 */
function claim(user, giftId) {
  const day = todayFor(user.timezone);

  return withTransaction(() => {
    const gift = giftRepository.findById(giftId);
    if (!gift || gift.recipient_id !== user.id) {
      throw new NotFoundError('Ese regalo no existe.');
    }
    if (!giftRepository.claim(gift.id, user.id)) {
      throw new ConflictError('Ese regalo ya lo habías reclamado.');
    }

    let label;
    if (gift.type === 'coins') {
      coinService.credit(user.id, gift.amount, 'gift_claim', day);
      label = `${gift.amount} monedas`;
    } else if (gift.type === 'lootbox') {
      lootboxRepository.add(user.id, gift.payload_key, 1);
      const box = catalogService.boxesByKey()[gift.payload_key];
      label = box ? box.name : 'una caja';
    } else {
      // cosmético: si ya lo tienes, en vez de desperdiciar el regalo se
      // reembolsa en monedas según su rareza (mismo criterio que los duplicados
      // de caja).
      const item = catalogService.itemsByKey()[gift.payload_key];
      if (item && cosmeticRepository.owns(user.id, gift.payload_key)) {
        const refund = DUP_REFUND[item.rarity] || 0;
        coinService.credit(user.id, refund, 'gift_dup_refund', day);
        label = `${item.name} (ya lo tenías → ${refund} monedas)`;
      } else {
        cosmeticRepository.grant(user.id, gift.payload_key, 'gift');
        label = item ? item.name : 'un cosmético';
      }
    }

    return { type: gift.type, label, balance: coinService.balance(user.id) };
  });
}

/**
 * Difusión de admin: reparte el mismo regalo a una lista de usuarios (todos por
 * defecto), sin cobro y con un broadcast_id común. Devuelve { count, broadcastId }.
 * El fan-out de push se hace DESPUÉS del commit para no atarlo a la transacción.
 */
function broadcast({ type, key, amount, message, recipientIds = null }) {
  const day = todayFor(null);
  const note = cleanMessage(message);
  const { payloadKey, amount: amt, label } = resolvePayload({ type, key, amount }, day);

  const ids = (recipientIds && recipientIds.length ? recipientIds : userRepository.allIds()).map(Number);
  const broadcastId = giftRepository.nextBroadcastId();

  withTransaction(() => {
    for (const rid of ids) {
      giftRepository.create({
        senderId: null,
        recipientId: rid,
        type,
        payloadKey,
        amount: amt,
        message: note,
        broadcastId,
      });
    }
  });

  // Aviso a cada receptor tras confirmar la escritura (fire-and-forget).
  for (const rid of ids) notifyRecipient(rid, label, null);

  return { count: ids.length, broadcastId, label };
}

/** Icono (nombre del SVG de partials/icon.ejs) según el tipo de regalo. */
function iconNameFor(type) {
  if (type === 'coins') return 'coin';
  if (type === 'cosmetic') return 'gem';
  return 'gift'; // lootbox
}

/**
 * Describe una fila de la bandeja para pintarla: qué es, de quién y su icono
 * (un nombre de SVG, no un emoji). No resuelve CSS.
 */
function describeRow(row) {
  let label;
  if (row.type === 'coins') {
    label = `${row.amount} monedas`;
  } else if (row.type === 'lootbox') {
    const box = catalogService.boxesByKey()[row.payload_key];
    label = box ? box.name : 'Una caja';
  } else {
    const item = catalogService.itemsByKey()[row.payload_key];
    label = item ? item.name : 'Un cosmético';
  }
  const from = row.sender_id
    ? row.sender_display_name || row.sender_username
    : null; // NULL = difusión del sistema/admin
  return {
    id: row.id,
    type: row.type,
    label,
    iconName: iconNameFor(row.type),
    from,
    message: row.message || null,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** La bandeja del usuario (regalos recibidos), ya resuelta para la vista. */
function inboxFor(userId) {
  return giftRepository.inbox(userId).map(describeRow);
}

/** Quita de la bandeja un regalo YA reclamado del usuario. */
function remove(user, giftId) {
  if (!giftRepository.removeClaimed(giftId, user.id)) {
    throw new ConflictError('Solo puedes quitar regalos ya reclamados.');
  }
}

/**
 * Lista de amigos para el selector de "enviar una caja" del modal de la tienda:
 * [{ id, name, username }].
 */
function friendsFor(userId) {
  return friendshipRepository.friends(userId).map((f) => ({
    id: f.id,
    name: f.display_name || f.username,
    username: f.username,
  }));
}

/** Cuántos regalos pendientes tiene el usuario (para el badge del nav). */
function pendingCount(userId) {
  return giftRepository.pendingCount(userId);
}

module.exports = {
  send,
  claim,
  remove,
  broadcast,
  inboxFor,
  friendsFor,
  pendingCount,
  TYPES,
};
