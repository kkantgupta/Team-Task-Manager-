const router = require('express').Router();
const db = require('../db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

router.use(authenticate);

router.get('/', (req, res) => {
  let projects;
  if (req.user.role === 'admin') {
    projects = db.prepare(`
      SELECT p.*, u.name AS owner_name,
             (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS task_count
      FROM projects p
      JOIN users u ON u.id = p.owner_id
      ORDER BY p.created_at DESC
    `).all();
  } else {
    projects = db.prepare(`
      SELECT p.*, u.name AS owner_name,
             (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS task_count
      FROM projects p
      JOIN users u ON u.id = p.owner_id
      WHERE p.owner_id = ? OR EXISTS (
        SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ?
      )
      ORDER BY p.created_at DESC
    `).all(req.user.id, req.user.id);
  }
  res.json({ projects });
});

router.post('/', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  const result = db.prepare(
    'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)'
  ).run(name, description || null, req.user.id);

  db.prepare(
    'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
  ).run(result.lastInsertRowid, req.user.id, 'admin');

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ project });
});

router.get('/:id', requireProjectAccess(), (req, res) => {
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, pm.role
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?
  `).all(req.project.id);

  res.json({ project: req.project, members });
});

router.put('/:id', requireProjectAccess('admin'), (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  db.prepare(
    'UPDATE projects SET name = ?, description = ? WHERE id = ?'
  ).run(name, description || null, req.project.id);

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.project.id);
  res.json({ project: updated });
});

router.delete('/:id', requireProjectAccess('admin'), (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.project.id);
  res.json({ message: 'Project deleted' });
});

router.get('/:projectId/members', requireProjectAccess(), (req, res) => {
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, pm.role
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?
  `).all(req.project.id);
  res.json({ members });
});

router.post('/:projectId/members', requireProjectAccess('admin'), (req, res) => {
  const { userId, role } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const existing = db.prepare(
    'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(req.project.id, userId);
  if (existing) return res.status(409).json({ error: 'User already in project' });

  const memberRole = ['admin', 'member'].includes(role) ? role : 'member';
  db.prepare(
    'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
  ).run(req.project.id, userId, memberRole);

  res.status(201).json({ message: 'Member added', user, role: memberRole });
});

router.delete('/:projectId/members/:userId', requireProjectAccess('admin'), (req, res) => {
  const { userId } = req.params;

  if (parseInt(userId) === req.project.owner_id) {
    return res.status(400).json({ error: 'Cannot remove project owner' });
  }

  db.prepare(
    'DELETE FROM project_members WHERE project_id = ? AND user_id = ?'
  ).run(req.project.id, userId);

  res.json({ message: 'Member removed' });
});

module.exports = router;
