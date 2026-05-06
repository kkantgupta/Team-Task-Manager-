const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function requireProjectAccess(role = 'member') {
  return (req, res, next) => {
    const projectId = parseInt(req.params.projectId || req.params.id);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user.role === 'admin' || project.owner_id === req.user.id) {
      req.project = project;
      return next();
    }

    const membership = db.prepare(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(projectId, req.user.id);

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    if (role === 'admin' && membership.role !== 'admin') {
      return res.status(403).json({ error: 'Project admin access required' });
    }

    req.project = project;
    req.memberRole = membership.role;
    next();
  };
}

module.exports = { authenticate, requireRole, requireProjectAccess, JWT_SECRET };
