import Database from '@tauri-apps/plugin-sql'

let db: Database | null = null

// 数据库初始化 SQL
const INIT_SQL = `
-- 日历表
CREATE TABLE IF NOT EXISTS calendars (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'local',
  account_id TEXT,
  visible INTEGER NOT NULL DEFAULT 1,
  sync_enabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 日历事件表
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  calendar_id TEXT NOT NULL,
  color TEXT,
  reminder INTEGER,
  repeat_rule TEXT,
  location TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);

-- 待办事项表
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  due_date INTEGER,
  completed INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium',
  calendar_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_events_calendar_id ON events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_todos_calendar_id ON todos(calendar_id);
`

export async function initDatabase(): Promise<Database> {
  if (db) return db

  try {
    db = await Database.load('sqlite:calendar.db')

    // 执行初始化 SQL
    const statements = INIT_SQL.split(';').filter(s => s.trim())
    for (const statement of statements) {
      if (statement.trim()) {
        await db.execute(statement)
      }
    }

    console.log('Database initialized successfully')
    return db
  } catch (error) {
    console.error('Failed to initialize database:', error)
    throw error
  }
}

export async function getDatabase(): Promise<Database> {
  if (!db) {
    return initDatabase()
  }
  return db
}

// Calendar CRUD
export async function getAllCalendars() {
  const database = await getDatabase()
  return database.select<any[]>('SELECT * FROM calendars ORDER BY created_at DESC')
}

export async function saveCalendar(calendar: any) {
  const database = await getDatabase()
  await database.execute(
    `INSERT OR REPLACE INTO calendars (id, name, color, type, account_id, visible, sync_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      calendar.id,
      calendar.name,
      calendar.color,
      calendar.type,
      calendar.accountId || null,
      calendar.visible ? 1 : 0,
      calendar.syncEnabled ? 1 : 0,
      calendar.createdAt || Date.now(),
      Date.now()
    ]
  )
}

export async function deleteCalendar(id: string) {
  const database = await getDatabase()
  await database.execute('DELETE FROM calendars WHERE id = ?', [id])
}

// Event CRUD
export async function getAllEvents() {
  const database = await getDatabase()
  const rows = await database.select<any[]>('SELECT * FROM events ORDER BY start_time ASC')
  return rows.map(row => ({
    ...row,
    allDay: row.all_day === 1,
    calendarId: row.calendar_id,
    startTime: row.start_time,
    endTime: row.end_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    accountId: row.account_id,
    syncEnabled: row.sync_enabled === 1,
    repeatRule: row.repeat_rule ? JSON.parse(row.repeat_rule) : undefined
  }))
}

export async function saveEvent(event: any) {
  const database = await getDatabase()
  await database.execute(
    `INSERT OR REPLACE INTO events (id, title, description, start_time, end_time, all_day, calendar_id, color, reminder, repeat_rule, location, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.title,
      event.description || null,
      event.startTime,
      event.endTime,
      event.allDay ? 1 : 0,
      event.calendarId,
      event.color || null,
      event.reminder || null,
      event.repeatRule ? JSON.stringify(event.repeatRule) : null,
      event.location || null,
      event.createdAt,
      Date.now()
    ]
  )
}

export async function deleteEvent(id: string) {
  const database = await getDatabase()
  await database.execute('DELETE FROM events WHERE id = ?', [id])
}

// Todo CRUD
export async function getAllTodos() {
  const database = await getDatabase()
  const rows = await database.select<any[]>('SELECT * FROM todos ORDER BY created_at DESC')
  return rows.map(row => ({
    ...row,
    completed: row.completed === 1,
    calendarId: row.calendar_id,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

export async function saveTodo(todo: any) {
  const database = await getDatabase()
  await database.execute(
    `INSERT OR REPLACE INTO todos (id, title, description, due_date, completed, priority, calendar_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      todo.id,
      todo.title,
      todo.description || null,
      todo.dueDate || null,
      todo.completed ? 1 : 0,
      todo.priority,
      todo.calendarId,
      todo.createdAt || Date.now(),
      Date.now()
    ]
  )
}

export async function deleteTodo(id: string) {
  const database = await getDatabase()
  await database.execute('DELETE FROM todos WHERE id = ?', [id])
}