'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

/**
 * Conexión única (singleton) a SQLite.
 * Es el único módulo que instancia la base de datos; los repositorios la importan.
 */

// Asegura que exista el directorio del archivo de base de datos.
fs.mkdirSync(path.dirname(config.database.path), { recursive: true });

const db = new Database(config.database.path);

// WAL mejora la concurrencia lectura/escritura; NORMAL es seguro con WAL.
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
// SQLite no aplica claves foráneas por defecto: lo activamos explícitamente.
db.pragma('foreign_keys = ON');

module.exports = db;
