-- 0021_gifts.sql — Regalos entre usuarios (amigo→amigo) y difusiones de admin.
--
-- Un regalo es una entrega PENDIENTE de reclamar: monedas, una caja o un
-- cosmético que un usuario manda a un amigo (pagándolo al enviar) o que el admin
-- reparte a todos (sin cobro) por una caída de servidor, un evento, etc. El
-- receptor lo ve en su bandeja (dentro de la tienda) y lo reclama; reclamar concede el
-- contenido. El mismo mecanismo sirve para 1:1 y para difusión.
--
-- El pago del emisor (en los 1:1) pasa por coin_spends con reason='gift_send',
-- así que la invariante del saldo sigue cuadrando. La concesión al reclamar
-- reutiliza las vías de siempre (coinService.credit / lootboxRepository.add /
-- cosmeticsService.grant) y por tanto también respeta los ledgers.

CREATE TABLE gifts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- NULL = sistema/admin (difusión)
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT    NOT NULL,                    -- 'coins' | 'lootbox' | 'cosmetic'
  payload_key  TEXT,                                -- box_key o item_key (NULL en 'coins')
  amount       INTEGER CHECK (amount > 0),          -- monedas (NULL en los otros tipos)
  message      TEXT,                                -- nota opcional, con tope de longitud
  status       TEXT    NOT NULL DEFAULT 'pending',  -- 'pending' | 'claimed'
  broadcast_id INTEGER,                             -- agrupa una misma difusión; NULL en 1:1
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  claimed_at   TEXT
);

-- La bandeja del receptor consulta por (destinatario, estado) y ordena por fecha.
CREATE INDEX idx_gifts_recipient ON gifts(recipient_id, status, created_at);
-- Para inspeccionar/agrupar una difusión concreta.
CREATE INDEX idx_gifts_broadcast ON gifts(broadcast_id);
