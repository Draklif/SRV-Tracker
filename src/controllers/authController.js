'use strict';

const authService = require('../services/authService');
const { registerSchema, loginSchema } = require('../validators/authValidators');
const asyncHandler = require('../utils/asyncHandler');
const { toFieldErrors } = require('../utils/validation');
const { addFlash } = require('../utils/flash');
const { startSession, endSession } = require('../utils/sessionAuth');

/** Solo redirige a rutas locales (evita open redirect). */
function safeRedirect(target) {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : '/';
}

const showRegister = (req, res) => {
  res.render('pages/register', { title: 'Crear cuenta', values: {}, inviteCode: '', errors: {} });
};

const register = asyncHandler(async (req, res) => {
  const values = {
    username: req.body.username,
    displayName: req.body.displayName,
    email: req.body.email,
  };
  try {
    const data = registerSchema.parse(req.body);
    const user = await authService.register(data);
    await startSession(req, user.id);
    addFlash(req, 'success', `¡Hola, ${user.display_name}! Bienvenido a Tracker 🌱`);
    return res.redirect('/');
  } catch (err) {
    const errors = toFieldErrors(err);
    if (!errors) throw err;
    return res.status(422).render('pages/register', {
      title: 'Crear cuenta',
      values,
      inviteCode: req.body.inviteCode || '',
      errors,
    });
  }
});

const showLogin = (req, res) => {
  res.render('pages/login', { title: 'Entrar', values: {}, errors: {}, error: null });
};

const login = asyncHandler(async (req, res) => {
  const values = { username: req.body.username };
  const returnTo = safeRedirect(req.session && req.session.returnTo);
  try {
    const data = loginSchema.parse(req.body);
    const user = await authService.login(data.username, data.password);
    await startSession(req, user.id);
    addFlash(req, 'success', `¡Qué bueno verte, ${user.display_name}! 👋`);
    return res.redirect(returnTo);
  } catch (err) {
    const errors = toFieldErrors(err);
    if (!errors && err.status !== 401) throw err;
    return res.status(err.status || 422).render('pages/login', {
      title: 'Entrar',
      values,
      errors: errors || {},
      error: errors ? null : 'Usuario o contraseña incorrectos.',
    });
  }
});

const logout = asyncHandler(async (req, res) => {
  await endSession(req);
  res.clearCookie('tracker.sid');
  res.redirect('/');
});

module.exports = { showRegister, register, showLogin, login, logout };
