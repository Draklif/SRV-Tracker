'use strict';

/**
 * Notas de parche. Fuente de la verdad de la página /novedades y del aviso en
 * la navegación: la `version` de la primera entrada es "la última publicada".
 *
 * Reglas al añadir una versión:
 *  - se pone arriba del todo (el array va de más nueva a más vieja);
 *  - la `version` es única y sube respecto a la anterior;
 *  - cada item lleva `type`: 'new' (algo que antes no existía), 'change' (algo
 *    que funcionaba distinto), 'fix' (algo que estaba roto) o 'remove' (algo
 *    que ya no está).
 *
 * Se escribe para quien usa la app, no para quien la programa: nada de nombres
 * de tabla ni de commits. Lo que cambia para él y por qué le conviene.
 */
const CHANGELOG = Object.freeze([
  {
    version: '0.2.0',
    date: '2026-07-11',
    title: 'Dimensiones de vida',
    items: [
      {
        type: 'new',
        text:
          'Tus hábitos ahora pertenecen a una de seis dimensiones: 🏃 Cuerpo, 📚 Mente, ' +
          '🧘 Calma, 💬 Social, 🎨 Oficio y 🧹 Orden. Son áreas de tu vida, no materiales: ' +
          'describen lo que de verdad estás cuidando cuando registras algo.',
      },
      {
        type: 'remove',
        text:
          'Se van los recursos antiguos (agua, energía, conocimiento y comida). Venían de la ' +
          'colonia, que ya no existe, y no tenían mucho que ver con lo que apuntas cada día. ' +
          'Tus hábitos se han repartido entre las nuevas dimensiones; si alguno quedó en la ' +
          'que no era, cámbialo y listo.',
      },
      {
        type: 'new',
        text:
          'En tu perfil tienes un radar con las seis: el polígono a trazos es tu ritmo de ' +
          'siempre y el relleno son tus últimos 7 días. De un vistazo ves qué área tienes ' +
          'encendida y cuál llevas de capa caída.',
      },
      {
        type: 'new',
        text:
          'Cada dimensión sube de nivel por su cuenta. No hace falta tenerlas todas al máximo: ' +
          'la idea es ver la forma, no rellenarla entera.',
      },
      {
        type: 'change',
        text:
          'Si le cambias la dimensión a un hábito, todo su histórico se recoloca solo. ' +
          'Ya no se queda nada mal clasificado en el pasado, así que puedes corregir sin miedo.',
      },
      {
        type: 'new',
        text:
          'Esta misma página. A partir de ahora los cambios se cuentan aquí, con un punto ' +
          'discreto en Perfil cuando haya algo nuevo. Sin ventanas emergentes mientras ' +
          'registras tus hábitos.',
      },
    ],
  },
]);

module.exports = CHANGELOG;
