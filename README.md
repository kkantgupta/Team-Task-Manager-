# TaskFlow — Team Task Manager

A web app for teams to create projects, assign tasks, and track progress together — with different access levels for Admins and Members.

---

## What is this?

TaskFlow helps teams stay organized. You can:

- Create projects and invite teammates
- Create tasks, assign them to people, and set due dates
- Track progress with statuses: **To Do → In Progress → Done**
- See overdue tasks highlighted on your dashboard
- Control who can do what using roles (Admin / Member)

---

## How to Run

### First time only — install dependencies
Open a terminal inside the `backend` folder and run:
```
npm install
```

### Start the server
**Option A — Double-click** `start.bat` (easiest)

**Option B — Terminal**
```
cd team-task-manager/backend
node server.js
```

Then open your browser at: **http://localhost:3000**

---

### If you see "Port 3000 already in use" error

Run these two commands in PowerShell:

```powershell
# Step 1 — find the PID (last number on the LISTENING line)
netstat -ano | findstr :3000

# Step 2 — kill it (replace 12345 with actual PID)
taskkill /PID 12345 /F
```

Then start the server again.

---

## How to Use

### 1. Create an account
Go to **http://localhost:3000** and click **Sign Up**.
Choose a role:
- **Admin** — full control over everything
- **Member** — access only to their own projects and tasks

### 2. Create a project
Go to **Projects → New Project**, give it a name and description.

### 3. Add teammates
On the Projects page, click **Members** on any project card to add other registered users.

### 4. Create and assign tasks
Go to **Tasks**, select a project, and click **+ Add Task**.
Fill in the title, priority, due date, and who to assign it to.

### 5. Track progress
Update task status directly from the task table — no need to open anything.
Your **Dashboard** shows a live summary.

---

## Admin vs Member — What's Different?

### Dashboard
| | Admin | Member |
|---|---|---|
| Tasks shown | All tasks across every project | Only their own tasks (created or assigned) |
| Overdue alerts | Every overdue task system-wide | Only their own overdue tasks |
| Stats | System-wide counts | Personal counts only |

### Projects
| | Admin | Member |
|---|---|---|
| Projects visible | Every project in the system | Only projects they own or were added to |
| Edit / Delete project | Yes (any project) | Only their own |
| Add / Remove members | Yes (any project) | Only if they're a Project Admin |

### Tasks
| | Admin | Member |
|---|---|---|
| Edit any task | Yes | Only tasks they created or are assigned to |
| Delete any task | Yes | Only tasks they created |
| Update task status | Yes | Only on tasks assigned to them or created by them |

---

## Pages at a Glance

| Page | What it does |
|---|---|
| **/** (Login/Signup) | Create an account or log in |
| **/dashboard** | Overview of your tasks, stats, and overdue alerts |
| **/projects** | Create and manage projects and team members |
| **/tasks** | View, create, edit, and track tasks inside a project |
