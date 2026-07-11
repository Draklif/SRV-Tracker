'use strict';

/**
 * Notas de parche. Fuente de la verdad de la página /novedades y del aviso en
 * la navegación: la `version` de la primera entrada es "la última publicada".
 *
 * Reglas al añadir una versión:
 *  - se pone arriba del todo (el array va de más nueva a más vieja);
 *  - la `version` es única y sube respecto a la anterior;
 *  - cada item lleva `type`: 'important' (pide algo del usuario: si no lo hace,
 *    algo no funcionará como espera), 'new' (algo que antes no existía),
 *    'change' (algo que funcionaba distinto), 'fix' (algo que estaba roto) o
 *    'remove' (algo que ya no está). 'important' va siempre el primero de su
 *    versión, y se usa con cuentagotas: si todo es importante, nada lo es.
 *
 * Se escribe para quien usa la app, no para quien la programa: nada de nombres
 * de tabla ni de commits. Lo que cambia para él y por qué le conviene.
 */
const CHANGELOG = Object.freeze([
  {
    version: '0.4.0',
    date: '2026-07-11',
    title: 'Dimensiones de vida',
    items: [
      {
        type: 'important',
        text:
          'Repasa tus hábitos de siempre. Al cambiar los recursos por las dimensiones, cada ' +
          'hábito tuvo que caer en alguna, y ese reparto es solo una suposición nuestra. Edita ' +
          'cada uno y elige la dimensión que de verdad lo describe para tener un registro correcto en tu perfil!',
      },
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
          'Se van los recursos antiguos (agua, energía, conocimiento y comida). Eran una ' +
          'metáfora que no decía nada sobre ti.',
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
          'Esta misma página. A partir de ahora los cambios se cuentan aquí! ',
      },
    ],
  },

  {
    version: '0.3.0',
    date: '2026-07-10',
    title: 'Recordatorios y app instalable',
    items: [
      {
        type: 'new',
        text:
          'Notificaciones en el móvil. Eliges una hora y, si a esa hora te faltan hábitos por ' +
          'completar, te avisamos. Son opcionales y las activas dispositivo por dispositivo, ' +
          'desde Perfil.',
      },
      {
        type: 'new',
        text:
          'Aviso de racha en peligro: si lo activas, por la noche te avisamos cuando tu racha ' +
          'está a punto de romperse. Solo cuando de verdad peligra.',
      },
      {
        type: 'new',
        text:
          'Puedes instalar la app en la pantalla de inicio, con su icono, y usarla como una ' +
          'aplicación más. En iPhone hace falta instalarla para que lleguen las notificaciones.',
      },
      {
        type: 'fix',
        text:
          'El móvil ya no se queda con una versión vieja de la app en la caché. Cuando ' +
          'publicamos algo, lo ves al recargar en vez de días después.',
      },
    ],
  },

  {
    version: '0.2.1',
    date: '2026-07-09',
    title: 'Retoques del color de acento',
    items: [
      {
        type: 'fix',
        text:
          'El color de acento se aplicaba a medias: la barra de navegación y algunos botones ' +
          'seguían en azul. Ahora el color que eliges manda en toda la app, en tema claro y ' +
          'en oscuro.',
      },
    ],
  },

  {
    version: '0.2.0',
    date: '2026-07-09',
    title: 'La semana de un vistazo',
    items: [
      {
        type: 'new',
        text:
          'Tu tablero muestra cómo va la semana, no solo el día. Los hábitos semanales enseñan ' +
          'cuánto llevas de la cuota y cuánto te queda, así que ya no tienes que llevar la ' +
          'cuenta de cabeza.',
      },
      {
        type: 'new',
        text:
          'Registrar es más rápido: la app rellena por ti el valor que sueles poner, y solo lo ' +
          'tocas si hoy fue distinto.',
      },
      {
        type: 'new',
        text:
          'Colores de acento. Además del tema claro u oscuro, eliges el color de la app entre ' +
          'azul, rojo, verde, morado y rosa. Se cambia en Perfil.',
      },
    ],
  },

  {
    version: '0.1.3',
    date: '2026-07-04',
    title: 'Hábitos semanales',
    items: [
      {
        type: 'new',
        text:
          'No todo es diario. Un hábito puede pedirte una cuota a la semana (por ejemplo, ' +
          'correr tres veces) y tú decides qué días la cumples. La racha lo entiende: cuenta ' +
          'semanas, no días.',
      },
      {
        type: 'new',
        text:
          'Cada hábito aporta a un recurso (agua, energía, conocimiento o comida) y el perfil ' +
          'enseña cómo los repartes.',
      },
      {
        type: 'fix',
        text: 'Arreglos de la vista en móvil y avisos que se quedaban pegados en pantalla.',
      },
    ],
  },

  {
    version: '0.1.2',
    date: '2026-07-04',
    title: 'Esto se hace con amigos',
    items: [
      {
        type: 'new',
        text:
          'Un muro donde ves lo que van registrando tus amigos, y ellos lo tuyo. Puedes ' +
          'reaccionar con 👏 🔥 💪 ❤️ 🎉 🌱, que es la mitad de la gracia.',
      },
      {
        type: 'new',
        text:
          'Amigos de verdad: buscar gente, mandar solicitud, aceptarla, y ver el perfil de ' +
          'cada uno con sus logros y su nivel.',
      },
      {
        type: 'new',
        text:
          'Códigos de invitación. Cada persona puede invitar a alguien; se entra por código, ' +
          'así que esto no se llena de desconocidos.',
      },
      {
        type: 'change',
        text:
          'Registrarse es más corto, y al compartir el enlace de la app ya sale una vista ' +
          'previa decente en vez de un enlace pelado.',
      },
    ],
  },

  {
    version: '0.1.1',
    date: '2026-07-04',
    title: 'XP, niveles y logros',
    items: [
      {
        type: 'new',
        text:
          'Registrar un hábito da XP, y el XP te sube de nivel. Nunca se resta: fallar un día ' +
          'te rompe la racha, pero no te quita lo que ya hiciste.',
      },
      {
        type: 'new',
        text:
          'Logros. Se desbloquean solos según lo que vas haciendo y se quedan en la vitrina de ' +
          'tu perfil.',
      },
      {
        type: 'new',
        text: 'Historial: puedes mirar atrás y ver qué registraste cada día.',
      },
      {
        type: 'fix',
        text:
          'Los hábitos de duración medidos en horas se guardaban mal, y el XP se contaba dos ' +
          'veces en algún caso. Los dos arreglados.',
      },
    ],
  },

  {
    version: '0.1.0',
    date: '2026-07-03',
    title: 'Los primeros hábitos',
    items: [
      {
        type: 'new',
        text:
          'Bienvenido a Tracker! Te creas una cuenta, tienes tu perfil con avatar y bio, y ya puedes ' +
          'empezar a apuntar lo que haces cada día.',
      },
      {
        type: 'new',
        text:
          'Los hábitos no son solo casillas. Puedes medirlos de seis formas: ✅ sí/no, ' +
          '🔢 cantidad (vasos de agua, pasos), ⏱️ duración (dormir, estudiar), 📊 escala del ' +
          '1 al 5 (ánimo, energía), 📈 un número puntual (peso) o ✍️ una frase.',
      },
      {
        type: 'new',
        text:
          'Un tablero con lo de hoy: entras, registras lo que has hecho y te vas.',
      },
      {
        type: 'new',
        text: 'Cada día seguido cuenta: si no fallas, la racha crece 🔥',
      },
    ],
  },
]);

module.exports = CHANGELOG;
