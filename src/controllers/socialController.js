'use strict';

const activityService = require('../services/activityService');
const reactionService = require('../services/reactionService');
const realtimeService = require('../services/realtimeService');
const asyncHandler = require('../utils/asyncHandler');
const renderPartial = require('../utils/renderPartial');
const { timeAgo } = require('../utils/format');
const { REACTIONS } = require('../config/constants');

/** GET /social — feed del grupo. */
const page = (req, res) => {
  const events = activityService.feed(req.user.id);
  res.render('pages/social', {
    title: 'Amigos',
    events,
    reactionEmojis: REACTIONS,
    timeAgo,
    lastId: events.length ? events[0].id : 0,
  });
};

/** GET /api/feed/latest?after=N — items nuevos ya renderizados (para SSE). */
const latest = asyncHandler(async (req, res) => {
  const after = Number(req.query.after) || 0;
  const events = activityService.feedAfter(req.user.id, after);
  const htmlItems = [];
  for (const event of events) {
    htmlItems.push(
      await renderPartial(res, 'partials/feed-item', {
        event,
        reactionEmojis: REACTIONS,
        timeAgo,
      })
    );
  }
  res.json({
    lastId: events.length ? events[events.length - 1].id : after,
    items: htmlItems,
  });
});

/** POST /api/activity/:id/react — alterna una reacción. */
const react = asyncHandler(async (req, res) => {
  const result = reactionService.toggle(Number(req.params.id), req.user.id, req.body.emoji);
  res.json(result);
});

/** GET /api/stream — conexión SSE (feed y reacciones en vivo). */
const stream = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`: conectado (${realtimeService.clientCount() + 1} en línea)\n\n`);

  const removeClient = realtimeService.addClient(res);
  req.on('close', removeClient);
};

module.exports = { page, latest, react, stream };
