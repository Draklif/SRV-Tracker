'use strict';

/**
 * Utilidades de fecha centradas en la zona horaria del usuario. El "día" de un
 * hábito es la fecha LOCAL del usuario, no UTC — clave para rachas correctas.
 * Las fechas se manejan como cadenas 'YYYY-MM-DD' (fechas de calendario, sin
 * hora), de modo que la aritmética de días es inmune a DST.
 */

/** Fecha local de hoy ('YYYY-MM-DD') en la zona horaria dada. */
function todayFor(timezone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Suma (o resta, con n negativo) días a una fecha 'YYYY-MM-DD'. */
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function previousDay(dateStr) {
  return addDays(dateStr, -1);
}

/** Días de calendario entre a y b (positivo si a es posterior a b). */
function diffDays(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
}

/** Día de la semana ISO de una fecha 'YYYY-MM-DD': 1=lunes … 7=domingo. */
function isoWeekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=domingo … 6=sábado
  return ((dow + 6) % 7) + 1;
}

/** Lunes (inicio de semana ISO) de la semana que contiene a la fecha dada. */
function weekStart(dateStr) {
  return addDays(dateStr, -(isoWeekday(dateStr) - 1));
}

module.exports = { todayFor, addDays, previousDay, diffDays, isoWeekday, weekStart };
