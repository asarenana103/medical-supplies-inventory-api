const jwt = require('jsonwebtoken');
const database = require('../utils/db');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'development-secret-change-me';
}

async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      res.status(401);
      throw new Error('Authentication token is required.');
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await database.get(
      'SELECT id, full_name, email, role, created_at FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user) {
      res.status(401);
      throw new Error('User account no longer exists.');
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      res.status(401);
      return next(new Error('Invalid or expired authentication token.'));
    }

    return next(error);
  }
}

module.exports = {
  protect,
  getJwtSecret
};
