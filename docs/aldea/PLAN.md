# La Colonia — Plan de implementación por fases

> Feature insignia de SRV-Tracker: un **survival cooperativo de colonia espacial** (Fallout Shelter × This War of Mine) alimentado por los **hábitos reales** de un grupo de amigos. Post-apocalíptico sci-fi, UI-first, sin motor de juego.

Estado: **diseño cerrado, sin empezar a implementar.** Ejecución progresiva, sin prisa. Cada fase deja algo jugable y ligado a hábitos.

---

## 1. Principios sagrados (no se rompen)

1. **Todo valor nace de hábitos reales.** Los 4 recursos primarios (💧agua · ⚡energía · 📚conocimiento · 🍞comida) y los 💰créditos solo entran al completar hábitos. Ningún edificio los genera de la nada; los edificios **transforman** (refinan, craftean, investigan, alimentan).
2. **Cooperativo puro (PvE).** Una colonia por grupo, **tesoro compartido**. El enemigo es externo (amenaza semanal, expediciones). Nunca miembro-vs-miembro → cero culpa.
3. **Anti-castigo.** Fallar un día nunca borra progreso construido. La amenaza semanal, si no cae, se va sin drama.
4. **Botín funcional, cero cosmético.** Armas, armaduras, equipo, materiales, planos, colonos.
5. **Cero dinero real.** El único modo de conseguir créditos es la constancia. El "gacha" es habit-gated.

Pilares completos: ver `~/.claude/.../memory/project_aldea_design.md`.

---

## 2. Modelo visual (UI-first, casi sin assets)

La base es una **rejilla de salas en HTML/CSS** estilo *FTL*: salas conectadas, cada una un panel estilizado.

- **Rejilla de la base**: un grid con el nombre de la colonia arriba. Cada celda es una **sala** (panel) o un **hueco vacío** con borde punteado (`＋ Construir`).
- **Sala**: icono/etiqueta del tipo, nivel, estado (barra de timer si está en construcción), y los **colonos asignados como íconos** dentro.
- **Click en sala** → panel de detalle: qué hace, botón de construir/mejorar (directo, sin voto), colonos asignados.
- **Click en colono** → panel del colono: nombre, rareza, stats, rasgos, equipo, ánimo, vínculos.
- **Barra superior**: recursos 💧⚡📚🍞, créditos, y el banner de la **amenaza semanal** con su barra de vida.
- **Assets**: como mucho un fondo por tipo de sala (~docena), opcionalmente retratos de colono. **Todo arranca con placeholders** (emoji / color) y se cambia por imágenes después sin tocar la lógica. Fuentes: Kenney.nl (CC0) + generadores de pixel art por IA para piezas custom.

**El arte nunca bloquea la lógica.**

---

## 3. Cómo encaja con lo que ya existe

| Existente | Se reutiliza para |
|---|---|
| `resource_events` (ledger per-usuario, append-only) | Se mantiene intacto. La colonia **espeja** las aportaciones en su tesoro mutable propio. |
| Event bus + `subscribers/resource.js` (`HABIT_LOGGED`) | Nuevo subscriber `colony.js`: cada hábito acredita el tesoro compartido, suma daño a la amenaza y otorga créditos. |
| Patrón `friendships` / `village_members` (ya anticipado en `0005`) | Membresía de la colonia. |
| `inviteRepository` / `inviteService` (TTL 60 min) | Invitaciones a la colonia. |
| `activityRepository` + feed | Eventos de colonia en el feed (`ACTIVITY_TYPES` nuevos: sala construida, amenaza vencida, colono caído…). |
| `utils/schedule.js` | Rollover semanal de la amenaza y timers de construcción (evaluados perezosamente al leer; no hay job runner). |
| Patrón controllers → services → repositories → migraciones SQL | Todo el código nuevo sigue el mismo layering. |

**Regla del tesoro**: `resource_events` nunca se resta (sagrado). El **tesoro de la colonia es mutable** (`village_resources.balance` sube por aportación, baja por gasto), con un ledger de transacciones aparte para historial/feed. Los dos mundos no se pisan.

---

## 4. Fases

### Fase 1 — Colonia + salas + construcción directa  *(el esqueleto base-builder)*

**Objetivo:** crear una colonia, invitar amigos, ver la rejilla de salas, aportar recursos con hábitos, y construir/mejorar salas **directamente** (cualquier miembro manda a construir; la construcción toma tiempo). Sin colonos ni combate todavía.

**Gobernanza: sin propuestas ni votos.** Cualquier miembro activo gasta del tesoro compartido y manda a construir/mejorar directo; el grupo se organiza hablando. (Se descartó el sistema de voto por ser más pesado.)

**Migraciones / tablas nuevas (5):**

```
villages
  id, name, created_by → users(id), created_at

village_members
  id, village_id, user_id, role ('admin'|'member'),
  status ('pending'|'active'), invited_by, joined_at
  UNIQUE(village_id, user_id)        -- (por ahora: 1 colonia activa por usuario)

village_resources                     -- tesoro mutable compartido
  village_id, resource_type, balance  -- balance >= 0
  PK(village_id, resource_type)

village_transactions                  -- ledger de tesoro (historial/feed)
  id, village_id, resource_type, amount (+/-), reason,
  actor_id, source_type, source_id, day, created_at
  UNIQUE parcial dedupe de aportes WHERE reason LIKE 'resource_%'

village_rooms
  id, village_id, room_type, slot_index, level,
  status ('built'|'constructing'), construct_finish_at, created_at
  UNIQUE(village_id, slot_index)
```

**Flujo de contribución:** en `HABIT_LOGGED`, el nuevo subscriber acredita `village_resources` (+ fila idempotente en `village_transactions`) para la colonia del usuario. El ledger personal sigue igual.

**Flujo de construcción (directo):** un miembro manda construir/mejorar → se valida slot libre y tesoro suficiente → en una transacción se **descuenta el coste del tesoro** y la sala pasa a `constructing` con `construct_finish_at`; al vencer el timer (resuelto de forma **perezosa al leer** la página, no hay scheduler) → `built`.

**Código nuevo (siguiendo el layering):**
- `models/`: `villageRepository`, `villageMemberRepository`, `villageResourceRepository`, `villageRoomRepository`.
- `services/`: `villageService` (crear/unir/invitar/aportar/**construir/mejorar**/resolver timers).
- `events/subscribers/village.js` + eventos nuevos (`VILLAGE_ROOM_BUILT`, `VILLAGE_JOINED`).
- `config/constants.js`: `ROOM_TYPES` + `ROOM_META` (coste, recurso, efecto, tiempo de construcción) siguiendo el patrón de `HABIT_TYPE_META`.
- Rutas: `routes/web/villageRoutes.js` (página) + `routes/api/villageApiRoutes.js` (create/invite/accept/build/upgrade).
- Vistas: `pages/village.ejs` (la rejilla), `partials/village/room-tile.ejs`, `partials/village/room-detail.ejs` (modal), `partials/village/invite-modal.ejs`.

**Entregable jugable:** el grupo crea su colonia, ve la base crecer sala a sala, y siente que sus hábitos alimentan un proyecto común. Bucle completo aunque mínimo.

---

### Fase 2 — Amenaza semanal  *(el latido)*

**Objetivo:** cada lunes aparece una amenaza con vida; cada hábito de cualquier miembro le pega. El domingo se resuelve con botín.

**Tabla clave:** `village_threats(village_id, week, type, weakness_resource, max_hp, current_hp, status, started_at, ends_at, loot)`.

**Mecánica de daño** (en el subscriber de hábitos):
```
daño = dañoBase(nivel Fabricador) × elemental(×2 si el hábito es del tipo débil) × crítico(prob = 5%·nivel Laboratorio, ×2)
```
Sin Laboratorio no se revela la debilidad. `max_hp` escala con nº de miembros activos y nivel de colonia. Rollover semanal por `schedule.js`.

**Entregable:** un objetivo compartido con caducidad suave que da razón para registrar hoy. Ya es adictivo con lo mínimo.

---

### Fase 3 — Colonos  *(la gestión)*

**Objetivo:** población que llega por hitos de constancia (tope = Cápsulas), se asigna a salas (potencia efectos), consume raciones (upkeep) y tiene stats/rareza.

**Tablas:** `colonists(id, village_id, name, rarity, traits, str/dex/int/health, level, xp, assigned_room_id, mood, status)`. Se introduce la moneda 💰**créditos** (de hábitos) y el "roll" de colonos (gacha habit-gated). `village_resources` gana columna de créditos.

**Entregable:** la colonia deja de ser edificios vacíos: tiene gente a la que cuidar.

---

### Fase 4 — Expediciones + crafteo + permadeath  *(las apuestas)*

**Objetivo:** craftear equipo (Fabricador + recetas de investigación), comprar cajas con créditos, mandar escuadrones a zonas (timer real), traer botín… o perder colonos.

**Tablas:** `equipment`, `expeditions`, `village_tech` (árbol de investigación: desbloquea tipos de sala, mejoras y recetas), y materiales secundarios (🔩 de expediciones/refinado, comprables con créditos). **Muerte = pérdida total** (colono + su equipo). Éxito = f(stats escuadrón + equipo + raciones vs dificultad de zona).

**Entregable:** la tensión de arriesgar a tu gente por mejor botín. El núcleo del juego.

---

### Fase 5 — Capa social/emocional  *(el alma)*

**Objetivo:** los colonos se relacionan (amigos/rivales/parejas), tienen ánimo movido por comida, hacinamiento, victorias y **muertes** (el duelo baja la moral en cascada). Vínculos que mejoran expediciones. Eventos con decisión moral (This War of Mine).

**Tablas:** `colonist_relationships`, ampliación del sistema de `mood`, eventos.

**Entregable:** historias emergentes. Lo que hace que el grupo se encariñe y vuelva.

---

## 5. Notas de ejecución

- **Orden estricto por fases**; cada una se mergea y disfruta antes de la siguiente.
- Aterrizar sobre la marcha (no bloquea empezar): catálogo fino de materiales secundarios, árbol de investigación concreto, tablas de botín por zona.
- Placeholders visuales desde el día 1; los assets entran en paralelo cuando se quiera.
- Al arrancar cada fase, convertirla en tareas concretas.
