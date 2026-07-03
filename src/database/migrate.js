'use strict';

const fs = require('fs');
const path = require('path');
const db = require('./connection');

/**
 * Runner de migraciones minimalista.
 * Aplica en orden los archivos `migrations/NNNN_*.sql` que aún no se hayan aplicado,
 * registrando cada uno en la tabla `schema_migrations`. Cada migración corre en una
 * transacción para que un fallo no deje el esquema a medias.
 */

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function ensureMigrationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function appliedMigrations() {
  return new Set(db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name));
}

function pendingMigrations(applied) {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => !applied.has(f));
}

function runMigrations() {
  ensureMigrationsTable();
  const pending = pendingMigrations(appliedMigrations());

  if (pending.length === 0) {
    console.log('[migrate] Base de datos al día, sin migraciones pendientes.');
    return;
  }

  const record = db.prepare('INSERT INTO schema_migrations (name) VALUES (?)');

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const apply = db.transaction(() => {
      db.exec(sql);
      record.run(file);
    });
    apply();
    console.log(`[migrate] Aplicada ${file}`);
  }

  console.log(`[migrate] Listo. ${pending.length} migración(es) aplicada(s).`);
}

// Permite `npm run migrate` (ejecución directa) e importar la función desde el arranque.
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
