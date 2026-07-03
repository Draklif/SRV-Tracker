'use strict';

/**
 * Errores de dominio. Llevan `status` HTTP y `expose` (si el mensaje es seguro
 * de mostrar al usuario). `fields` mapea errores por campo para re-renderizar
 * formularios ({ username: 'Ya está en uso' }).
 *
 * El errorHandler central los traduce a JSON (API) o a la página de error (web);
 * los controladores de formularios los capturan para re-pintar el form.
 */
class AppError extends Error {
  constructor(message, { status = 400, expose = true, details = null, fields = null } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.expose = expose;
    this.details = details;
    this.fields = fields;
  }
}

class ValidationError extends AppError {
  constructor(fields, message = 'Revisa los datos e inténtalo de nuevo.') {
    super(message, { status: 422, fields });
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, { status: 409 });
  }
}

class AuthError extends AppError {
  constructor(message = 'Usuario o contraseña incorrectos.') {
    super(message, { status: 401 });
  }
}

class NotFoundError extends AppError {
  constructor(message = 'No encontrado.') {
    super(message, { status: 404 });
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'No tienes permiso para esto.') {
    super(message, { status: 403 });
  }
}

module.exports = {
  AppError,
  ValidationError,
  ConflictError,
  AuthError,
  NotFoundError,
  ForbiddenError,
};
