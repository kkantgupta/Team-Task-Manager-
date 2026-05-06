const API = (() => {
  function token() { return localStorage.getItem('ttm_token'); }

  function currentUser() {
    const u = localStorage.getItem('ttm_user');
    return u ? JSON.parse(u) : null;
  }

  function logout() {
    localStorage.removeItem('ttm_token');
    localStorage.removeItem('ttm_user');
    window.location.href = '/index.html';
  }

  function requireAuth() {
    if (!token()) { window.location.href = '/index.html'; return false; }
    return true;
  }

  async function request(method, path, body) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token()}`
      }
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const r = await fetch('/api' + path, opts);
    const data = await r.json();
    if (r.status === 401) { logout(); return; }
    return { ok: r.ok, status: r.status, data };
  }

  const get = (path) => request('GET', path);
  const post = (path, body) => request('POST', path, body);
  const put = (path, body) => request('PUT', path, body);
  const patch = (path, body) => request('PATCH', path, body);
  const del = (path) => request('DELETE', path);

  return { get, post, put, patch, del, currentUser, logout, requireAuth };
})();

function renderSidebar(activePage) {
  const user = API.currentUser();
  if (!user) return;

  const nav = [
    { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>` },
    { id: 'projects', label: 'Projects', href: 'projects.html', icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>` },
    { id: 'tasks', label: 'My Tasks', href: 'tasks.html', icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>` },
  ];

  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = `
    <div class="sidebar-logo">
      <h1>&#9654; TaskFlow</h1>
      <span>Team Task Manager</span>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-label">Navigation</div>
      ${nav.map(n => `
        <a href="${n.href}" class="nav-item ${activePage === n.id ? 'active' : ''}" style="text-decoration:none">
          ${n.icon}
          <span>${n.label}</span>
        </a>
      `).join('')}
    </nav>
    <div class="sidebar-user">
      <div class="user-info">
        <div class="avatar">${user.name.charAt(0).toUpperCase()}</div>
        <div class="user-details">
          <p>${user.name}</p>
          <span class="badge-role ${user.role}">${user.role}</span>
        </div>
      </div>
      <button class="btn-logout" onclick="API.logout()">Sign Out</button>
    </div>
  `;
}

function showModal(html) {
  let bd = document.getElementById('modalBackdrop');
  if (!bd) {
    bd = document.createElement('div');
    bd.id = 'modalBackdrop';
    bd.className = 'modal-backdrop';
    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if (e.target === bd) closeModal(); });
  }
  bd.innerHTML = html;
  bd.classList.remove('hidden');
}

function closeModal() {
  const bd = document.getElementById('modalBackdrop');
  if (bd) bd.classList.add('hidden');
}

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `alert alert-${type === 'error' ? 'error' : 'success'}`;
  t.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999;min-width:220px;box-shadow:0 4px 12px rgba(0,0,0,.15)';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function badgeStatus(s) {
  const map = { todo: 'badge-todo', in_progress: 'badge-progress', done: 'badge-done' };
  const labels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
  return `<span class="badge ${map[s] || ''}">${labels[s] || s}</span>`;
}

function badgePriority(p) {
  return `<span class="badge badge-${p}">${p.charAt(0).toUpperCase() + p.slice(1)}</span>`;
}

function isOverdue(due_date, status) {
  if (!due_date || status === 'done') return false;
  return due_date < new Date().toISOString().split('T')[0];
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
