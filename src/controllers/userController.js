'use strict';

const fs = require('fs');
const path = require('path');

const config = require('../config');
const userService = require('../services/userService');
const achievementService = require('../services/achievementService');
const userRepository = require('../models/userRepository');
const streakRepository = require('../models/streakRepository');
const { NotFoundError } = require('../utils/errors');
const { levelProgress } = require('../utils/level');
const { profileSchema, passwordChangeSchema, TIMEZONES, THEMES } = require('../validators/profileValidators');
const asyncHandler = require('../utils/asyncHandler');
const { toFieldErrors } = require('../utils/validation');
const { addFlash } = require('../utils/flash');
const { avatarPathFor } = require('../middlewares/uploadAvatar');

/** Re-render de la página de perfil con el estado actual de los formularios. */
function renderProfile(req, res, { status = 200, profileErrors = {}, passwordErrors = {}, values } = {}) {
  return res.status(status).render('pages/profile', {
    title: 'Tu perfil',
    timezones: TIMEZONES,
    themes: THEMES,
    achievements: achievementService.listForUser(req.user.id),
    level: levelProgress(req.user.xp),
    profileErrors,
    passwordErrors,
    values: values || {
      displayName: req.user.display_name,
      bio: req.user.bio || '',
      timezone: req.user.timezone,
      theme: req.user.theme,
    },
  });
}

const showProfile = (req, res) => renderProfile(req, res, {});

const updateProfile = asyncHandler(async (req, res) => {
  try {
    const data = profileSchema.parse(req.body);
    userService.updateProfile(req.user.id, data);
    addFlash(req, 'success', 'Perfil actualizado ✨');
    return res.redirect('/profile');
  } catch (err) {
    const errors = toFieldErrors(err);
    if (!errors) throw err;
    return renderProfile(req, res, {
      status: 422,
      profileErrors: errors,
      values: {
        displayName: req.body.displayName,
        bio: req.body.bio,
        timezone: req.body.timezone,
        theme: req.body.theme,
      },
    });
  }
});

const changePassword = asyncHandler(async (req, res) => {
  try {
    const data = passwordChangeSchema.parse(req.body);
    await userService.changePassword(req.user.id, data.currentPassword, data.newPassword);
    addFlash(req, 'success', 'Contraseña actualizada 🔒');
    return res.redirect('/profile');
  } catch (err) {
    const errors = toFieldErrors(err);
    if (!errors) throw err;
    return renderProfile(req, res, { status: 422, passwordErrors: errors });
  }
});

const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    addFlash(req, 'info', 'Elige una imagen para tu avatar.');
    return res.redirect('/profile');
  }

  const previous = req.user.avatar_path;
  userService.setAvatar(req.user.id, avatarPathFor(req.file.filename));

  // Borrado best-effort del avatar anterior para no acumular archivos.
  if (previous && previous.startsWith('/uploads/avatars/')) {
    fs.unlink(path.join(config.rootDir, 'public', previous), () => {});
  }

  addFlash(req, 'success', '¡Nuevo avatar! 🎉');
  return res.redirect('/profile');
});

/** GET /u/:username — perfil público de un amigo (grupo cerrado). */
const showFriend = (req, res) => {
  const friend = userRepository.findByUsername(req.params.username);
  if (!friend) throw new NotFoundError('No encontramos a esa persona.');
  // Tu propio perfil se gestiona en /profile.
  if (friend.id === req.user.id) return res.redirect('/profile');

  const achievements = achievementService.listForUser(friend.id);
  return res.render('pages/friend-profile', {
    title: friend.display_name,
    friend,
    level: levelProgress(friend.xp),
    unlocked: achievements.filter((a) => a.unlocked_at),
    totalAchievements: achievements.length,
    topStreaks: streakRepository.topByUser(friend.id, 3),
  });
};

module.exports = { showProfile, updateProfile, changePassword, uploadAvatar, showFriend };
