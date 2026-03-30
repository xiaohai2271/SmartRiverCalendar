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
  external_id TEXT,
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

-- 外部账户表
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  server_url TEXT NOT NULL,
  username TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  display_name TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 同步状态表
CREATE TABLE IF NOT EXISTS sync_state (
  account_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  sync_token TEXT,
  last_sync_at INTEGER,
  sync_window_start INTEGER,
  sync_window_end INTEGER,
  PRIMARY KEY(account_id, calendar_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_events_calendar_id ON events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_external_id ON events(external_id);
CREATE INDEX IF NOT EXISTS idx_todos_calendar_id ON todos(calendar_id);
CREATE INDEX IF NOT EXISTS idx_sync_state_account_id ON sync_state(account_id);
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

    // 执行数据库迁移
    await runMigrations(db)

    console.log('Database initialized successfully')
    return db
  } catch (error) {
    console.error('Failed to initialize database:', error)
    throw error
  }
}

/**
 * 检查表中是否存在指定列
 */
async function columnExists(database: Database, table: string, column: string): Promise<boolean> {
  const rows = await database.select<{ name: string }[]>(`PRAGMA table_info(${table})`)
  return rows.some(row => row.name === column)
}

/**
 * 执行数据库迁移
 * 用于处理旧版本数据库缺少列的问题
 */
async function runMigrations(database: Database): Promise<void> {
  try {
    // 迁移 1: 检查 events 表是否有 external_id 列
    const eventsHasExternalId = await columnExists(database, 'events', 'external_id')
    if (!eventsHasExternalId) {
      console.log('[Database Migration] 添加 events.external_id 列...')
      await database.execute('ALTER TABLE events ADD COLUMN external_id TEXT')
      console.log('[Database Migration] events.external_id 列添加成功')
    }

    // 迁移 2: 检查 events 表是否有 location 列（额外检查）
    const eventsHasLocation = await columnExists(database, 'events', 'location')
    if (!eventsHasLocation) {
      console.log('[Database Migration] 添加 events.location 列...')
      await database.execute('ALTER TABLE events ADD COLUMN location TEXT')
      console.log('[Database Migration] events.location 列添加成功')
    }

    console.log('[Database Migration] 迁移完成')
  } catch (error) {
    console.error('[Database Migration] 迁移失败:', error)
    // 迁移失败不应阻止应用启动，仅记录错误
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
    repeatRule: row.repeat_rule ? JSON.parse(row.repeat_rule) : undefined,
    externalId: row.external_id
  }))
}

export async function saveEvent(event: any) {
  const database = await getDatabase()
  
  // 查询是否已存在该事件（用于保留 createdAt）
  const existing = await database.select<any[]>(
    'SELECT created_at FROM events WHERE id = ?',
    [event.id]
  )
  
  // 如果已存在，保留原有的 createdAt；否则使用当前时间
  const createdAt = existing.length > 0 ? existing[0].created_at : (event.createdAt ?? Date.now())
  
  await database.execute(
    `INSERT OR REPLACE INTO events (id, title, description, start_time, end_time, all_day, calendar_id, color, reminder, repeat_rule, location, external_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      event.externalId || null,
      createdAt,
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

// External Account CRUD
export async function getAllExternalAccounts() {
  const database = await getDatabase()
  const rows = await database.select<any[]>('SELECT * FROM accounts ORDER BY created_at DESC')
  console.log('[Database] getAllExternalAccounts rows:', rows)
  return rows.map(row => ({
    ...row,
    id: row.id,  // 确保 id 字段存在
    serverUrl: row.server_url,
    encryptedPassword: row.encrypted_password,
    displayName: row.display_name,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

// 检查账号是否已存在（按服务器地址和用户名）
export async function getAccountByServerUrl(serverUrl: string, username: string) {
  const database = await getDatabase()
  const rows = await database.select<any[]>(
    'SELECT * FROM accounts WHERE server_url = ? AND username = ?',
    [serverUrl, username]
  )
  if (rows.length === 0) return null
  const row = rows[0]
  return {
    ...row,
    serverUrl: row.server_url,
    encryptedPassword: row.encrypted_password,
    displayName: row.display_name,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// 清理重复账号（保留最早创建的）
export async function cleanupDuplicateAccounts() {
  const database = await getDatabase()
  // 查找重复的账号（相同 server_url 和 username）
  const duplicates = await database.select<any[]>(`
    SELECT server_url, username, COUNT(*) as cnt, MIN(id) as keep_id
    FROM accounts
    GROUP BY server_url, username
    HAVING cnt > 1
  `)

  for (const dup of duplicates) {
    // 删除重复的账号（保留最早创建的）
    await database.execute(
      'DELETE FROM accounts WHERE server_url = ? AND username = ? AND id != ?',
      [dup.server_url, dup.username, dup.keep_id]
    )
    console.log('[Database] 清理重复账号:', dup.server_url, dup.username)
  }
}

export async function saveExternalAccount(account: any) {
  const database = await getDatabase()
  await database.execute(
    `INSERT OR REPLACE INTO accounts (id, type, server_url, username, encrypted_password, display_name, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      account.id,
      account.type,
      account.serverUrl,
      account.username,
      account.encryptedPassword,
      account.displayName || null,
      account.enabled ? 1 : 0,
      account.createdAt || Date.now(),
      Date.now()
    ]
  )
}

export async function deleteExternalAccount(id: string) {
  const database = await getDatabase()
  await database.execute('DELETE FROM accounts WHERE id = ?', [id])
}

// Sync State CRUD
export async function getSyncState(accountId: string, calendarId: string) {
  const database = await getDatabase()
  const rows = await database.select<any[]>(
    'SELECT * FROM sync_state WHERE account_id = ? AND calendar_id = ?',
    [accountId, calendarId]
  )
  if (rows.length === 0) return null
  const row = rows[0]
  return {
    accountId: row.account_id,
    calendarId: row.calendar_id,
    syncToken: row.sync_token,
    lastSyncAt: row.last_sync_at,
    syncWindowStart: row.sync_window_start,
    syncWindowEnd: row.sync_window_end
  }
}

export async function saveSyncState(syncState: any) {
  const database = await getDatabase()
  await database.execute(
    `INSERT OR REPLACE INTO sync_state (account_id, calendar_id, sync_token, last_sync_at, sync_window_start, sync_window_end)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      syncState.accountId,
      syncState.calendarId,
      syncState.syncToken || null,
      syncState.lastSyncAt || null,
      syncState.syncWindowStart || null,
      syncState.syncWindowEnd || null
    ]
  )
}

export async function updateSyncToken(accountId: string, calendarId: string, syncToken: string) {
  const database = await getDatabase()
  await database.execute(
    `UPDATE sync_state SET sync_token = ?, last_sync_at = ? WHERE account_id = ? AND calendar_id = ?`,
    [syncToken, Date.now(), accountId, calendarId]
  )
}