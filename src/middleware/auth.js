/**
 * Authentication & Authorization Middleware
 * Course Reference: Unit-5 Security & Access Control
 */

const { ObjectId } = require('mongodb');

// Require logged-in session
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in to continue.'
    });
  }
  next();
}

// Require specific user role
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.'
      });
    }

    if (req.session.user.role !== role && req.session.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: `Forbidden: This action requires '${role}' privileges.`
      });
    }

    next();
  };
}

// Require administrator role
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: 'Administrator authentication required.'
    });
  }

  if (req.session.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Administrator privileges required.'
    });
  }

  next();
}

// Helper to convert string to safe ObjectId
function toObjectId(id) {
  try {
    return new ObjectId(id);
  } catch (err) {
    return null;
  }
}

module.exports = {
  requireAuth,
  requireRole,
  requireAdmin,
  toObjectId
};
