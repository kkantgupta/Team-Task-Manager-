const router = require('express').Router();
const db = require('../db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

router.use(authenticate);

router.get('/dashboard', (req, res) => {
  const uid = req.user.id;
  const isAdmin = req.user.role === 'admin';

  const base = isAdmin
    ? db.prepare(`
        SELECT t.*, p.name AS project_name, u.name AS assignee_name
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = t.assignee_id
        ORDER BY t.due_date ASC, t.created_at DESC
      `).all()
    : db.prepare(`
        SELECT t.*, p.name AS project_name, u.name AS assignee_name
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = t.assignee_id
        WHERE t.assignee_id = ? OR t.creator_id = ?
        ORDER BY t.due_date ASC, t.created_at DESC
      `).all(uid, uid);

  const now = new Date().toISOString().split('T')[0];

  const stats = {
    total: base.length,
    todo: base.filter(t => t.status === 'todo').length,
    in_progress: base.filter(t => t.status === 'in_progress').length,
    done: base.filter(t => t.status === 'done').length,
    overdue: base.filter(t => t.due_date && t.due_date < now && t.status !== 'done').length,
  };

  const overdue = base.filter(t => t.due_date && t.due_date < now && t.status !== 'done');
  const recent = base.slice(0, 10);

  res.json({ stats, overdue, recent });
});

router.get('/project/:projectId', requireProjectAccess(), (req, res) => {
  const tasks = db.prepare(`
    SELECT t.*, u.name AS assignee_name, c.name AS creator_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    JOIN users c ON c.id = t.creator_id
    WHERE t.project_id = ?
    ORDER BY
      CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      t.due_date ASC,
      t.created_at DESC
  `).all(req.project.id);

  res.json({ tasks });
});

router.post('/project/:projectId', requireProjectAccess(), (req, res) => {
  const { title, description, assignee_id, due_date, priority } = req.body;

  if (!title) return res.status(400).json({ error: 'Task title is required' });

  if (assignee_id) {
    const member = db.prepare(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(req.project.id, assignee_id);
    if (!member) return res.status(400).json({ error: 'Assignee must be a project member' });
  }

  const validPriority = ['low', 'medium', 'high'].includes(priority) ? priority : 'medium';

  const result = db.prepare(`
    INSERT INTO tasks (title, description, project_id, assignee_id, creator_id, due_date, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    description || null,
    req.project.id,
    assignee_id || null,
    req.user.id,
    due_date || null,
    validPriority
  );

  const task = db.prepare(`
    SELECT t.*, u.name AS assignee_name, c.name AS creator_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    JOIN users c ON c.id = t.creator_id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ task });
});

router.get('/:id', (req, res) => {
  const task = db.prepare(`
    SELECT t.*, u.name AS assignee_name, c.name AS creator_name, p.name AS project_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    JOIN users c ON c.id = t.creator_id
    JOIN projects p ON p.id = t.project_id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!task) return res.status(404).json({ error: 'Task not found' });

  const canAccess = req.user.role === 'admin' ||
    task.creator_id === req.user.id ||
    task.assignee_id === req.user.id ||
    db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(task.project_id, req.user.id);

  if (!canAccess) return res.status(403).json({ error: 'Access denied' });

  res.json({ task });
});

router.put('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const isMember = db.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(task.project_id, req.user.id);

  const isOwner = task.creator_id === req.user.id || task.assignee_id === req.user.id;
  const isAdmin = req.user.role === 'admin' || (isMember && isMember.role === 'admin');

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Cannot edit this task' });
  }

  const { title, description, status, priority, assignee_id, due_date } = req.body;

  if (status && !['todo', 'in_progress', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (priority && !['low', 'medium', 'high'].includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority' });
  }

  db.prepare(`
    UPDATE tasks
    SET title = ?, description = ?, status = ?, priority = ?,
        assignee_id = ?, due_date = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title ?? task.title,
    description !== undefined ? description : task.description,
    status ?? task.status,
    priority ?? task.priority,
    assignee_id !== undefined ? assignee_id : task.assignee_id,
    due_date !== undefined ? due_date : task.due_date,
    task.id
  );

  const updated = db.prepare(`
    SELECT t.*, u.name AS assignee_name, c.name AS creator_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    JOIN users c ON c.id = t.creator_id
    WHERE t.id = ?
  `).get(task.id);

  res.json({ task: updated });
});

router.patch('/:id/status', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { status } = req.body;
  if (!['todo', 'in_progress', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const canUpdate = req.user.role === 'admin' ||
    task.creator_id === req.user.id ||
    task.assignee_id === req.user.id ||
    db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? AND role = ?')
      .get(task.project_id, req.user.id, 'admin');

  if (!canUpdate) return res.status(403).json({ error: 'Cannot update this task' });

  db.prepare("UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, task.id);

  res.json({ message: 'Status updated', status });
});

router.delete('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const isAdmin = req.user.role === 'admin';
  const isCreator = task.creator_id === req.user.id;
  const isProjectAdmin = db.prepare(
    'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? AND role = ?'
  ).get(task.project_id, req.user.id, 'admin');

  if (!isAdmin && !isCreator && !isProjectAdmin) {
    return res.status(403).json({ error: 'Cannot delete this task' });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
  res.json({ message: 'Task deleted' });
});

module.exports = router;
