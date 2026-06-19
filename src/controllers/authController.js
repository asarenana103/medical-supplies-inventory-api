const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const database = require('../utils/db');
const { sendCreated, sendSuccess } = require('../utils/responses');
const { getJwtSecret } = require('../middleware/authMiddleware');

const allowedRoles = ['admin', 'manager', 'staff'];

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateRegisterPayload(payload) {
  const errors = [];

  if (!payload.full_name || String(payload.full_name).trim() === '') {
    errors.push('Full name is required.');
  }

  if (!payload.email || String(payload.email).trim() === '') {
    errors.push('Email is required.');
  } else if (!validateEmail(String(payload.email).trim())) {
    errors.push('Email must be valid.');
  }

  if (!payload.password || String(payload.password).length < 6) {
    errors.push('Password must be at least 6 characters.');
  }

  if (payload.role && !allowedRoles.includes(String(payload.role).toLowerCase())) {
    errors.push('Role must be admin, manager, or staff.');
  }

  return errors;
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role
    },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d'
    }
  );
}

function sanitizeUser(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    created_at: user.created_at
  };
}

async function register(req, res, next) {
  try {
    const errors = validateRegisterPayload(req.body);

    if (errors.length) {
      res.status(400);
      throw new Error(errors.join(' '));
    }

    const fullName = String(req.body.full_name).trim();
    const email = String(req.body.email).trim().toLowerCase();
    const role = req.body.role ? String(req.body.role).toLowerCase() : 'staff';

    const existingUser = await database.get('SELECT id FROM users WHERE email = ?', [email]);

    if (existingUser) {
      res.status(409);
      throw new Error('Email is already registered.');
    }

    const hashedPassword = await bcrypt.hash(String(req.body.password), 10);
    const result = await database.run(
      `INSERT INTO users (full_name, email, password, role)
      VALUES (?, ?, ?, ?)`,
      [fullName, email, hashedPassword, role]
    );

    const user = await database.get(
      'SELECT id, full_name, email, role, created_at FROM users WHERE id = ?',
      [result.id]
    );

    return sendCreated(res, 'User registered successfully', {
      user: sanitizeUser(user),
      token: createToken(user)
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const email = req.body.email ? String(req.body.email).trim().toLowerCase() : '';
    const password = req.body.password ? String(req.body.password) : '';

    if (!email || !password) {
      res.status(400);
      throw new Error('Email and password are required.');
    }

    const user = await database.get('SELECT * FROM users WHERE email = ?', [email]);

    if (!user) {
      res.status(401);
      throw new Error('Invalid email or password.');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      res.status(401);
      throw new Error('Invalid email or password.');
    }

    return sendSuccess(res, 'Login successful', {
      user: sanitizeUser(user),
      token: createToken(user)
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login
};
