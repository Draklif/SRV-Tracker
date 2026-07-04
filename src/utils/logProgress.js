'use strict';

/**
 * Un registro cuenta como "avance" solo si tiene contenido real: completado,
 * un valor numérico > 0 o texto. Un quantity/duration en 0 (o una nota vacía)
 * persiste el log pero no es un avance, así que no debe otorgar XP ni recursos.
 */
function isProgress(log) {
  if (!log) return false;
  if (log.completed) return true;
  if (log.value_num != null && log.value_num > 0) return true;
  if (log.value_text != null && String(log.value_text).trim() !== '') return true;
  return false;
}

module.exports = { isProgress };
