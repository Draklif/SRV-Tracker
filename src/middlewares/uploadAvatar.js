'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');

const config = require('../config');
const { addFlash } = require('../utils/flash');

// Aseguramos que exista la carpeta de avatares.
fs.mkdirSync(config.paths.avatars, { recursive: true });

const MIME_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination: config.paths.avatars,
  filename: (req, file, cb) => {
    const ext = MIME_EXT[file.mimetype] || '.img';
    cb(null, `u${req.user.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    if (MIME_EXT[file.mimetype]) return cb(null, true);
    const err = new Error('Formato no soportado');
    err.friendly = 'Usa una imagen PNG, JPG, WEBP o GIF.';
    cb(err);
  },
}).single('avatar');

/**
 * Procesa la subida del avatar y traduce cualquier error de multer a un flash
 * amable + redirección a /profile (nunca una página de error abrupta).
 */
module.exports = function uploadAvatar(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'La imagen supera el límite de 2 MB.'
        : err.friendly || 'No pudimos subir la imagen. Inténtalo de nuevo.';
    addFlash(req, 'warn', message);
    return res.redirect('/profile');
  });
};

module.exports.avatarPathFor = (filename) => path.posix.join('/uploads/avatars', filename);
