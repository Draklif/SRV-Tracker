'use strict';

/**
 * Copy de las notificaciones push, estilo Duolingo: juguetón, un pelín
 * chantajista y cariñoso. El scheduler elige uno al azar en cada envío para que
 * no se sientan repetitivas.
 *
 * Tokens: `{n}` = nº de hábitos pendientes; `{h}` = 'hábito'/'hábitos' según n.
 */

const reminder = [
  { title: '¿Y tus hábitos? 👀', body: 'Te quedan {n} {h} por completar hoy. ¡A por ello!' },
  { title: 'Toc toc 🚪', body: 'Tus hábitos preguntan por ti: {n} {h} sin marcar todavía.' },
  { title: 'Un momentito 🌱', body: 'Tienes {n} {h} para hoy. El yo del futuro te lo agradece.' },
  { title: 'No lo dejes para mañana 🙈', body: 'Aún tienes {n} {h} en tu lista de hoy. Tú puedes con esto.' },
  { title: 'Recordatorio suave 💌', body: 'Todavía estás a tiempo: {n} {h} por completar hoy.' },
  { title: 'Psst… 👋', body: 'Te faltan {n} {h} del día. Un empujoncito y listo.' },
];

const streakGuard = [
  { title: '🔥 Tu racha está en peligro', body: 'Si no registras hoy, la pierdes. ¡No dejes que se apague!' },
  { title: '¡Salva tu racha! 🔥', body: 'Te faltan hábitos y tu racha pende de un hilo. Aún hay tiempo.' },
  { title: 'Tu racha te necesita 😳', body: 'Un registro más hoy y sigue viva. No la dejes caer ahora.' },
  { title: 'Último aviso del día ⏰', body: 'Tu racha se rompe a medianoche si no completas tus hábitos.' },
];

/** Devuelve un mensaje al azar de la lista, con los tokens sustituidos. */
function pick(kind, pendingCount) {
  const list = kind === 'streak_guard' ? streakGuard : reminder;
  const msg = list[Math.floor(Math.random() * list.length)];
  const h = pendingCount === 1 ? 'hábito' : 'hábitos';
  const sub = (s) => s.replace(/\{n\}/g, String(pendingCount)).replace(/\{h\}/g, h);
  return { title: sub(msg.title), body: sub(msg.body) };
}

module.exports = { reminder, streakGuard, pick };
