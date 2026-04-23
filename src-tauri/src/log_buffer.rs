use log::{Level, LevelFilter, Log, Metadata, Record};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Mutex;

/// 日志条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub target: String,
    pub message: String,
}

/// 内存日志缓冲区
pub struct LogBuffer {
    entries: Mutex<VecDeque<LogEntry>>,
    max_entries: usize,
}

impl LogBuffer {
    /// 创建新的日志缓冲区
    pub fn new(max_entries: usize) -> Self {
        Self {
            entries: Mutex::new(VecDeque::with_capacity(max_entries)),
            max_entries,
        }
    }

    /// 添加日志条目
    pub fn push(&self, entry: LogEntry) {
        let mut entries = self.entries.lock().unwrap();
        if entries.len() >= self.max_entries {
            entries.pop_front();
        }
        entries.push_back(entry);
    }

    /// 获取所有日志条目
    pub fn get_all(&self) -> Vec<LogEntry> {
        let entries = self.entries.lock().unwrap();
        entries.iter().cloned().collect()
    }

    /// 清空日志
    pub fn clear(&self) {
        let mut entries = self.entries.lock().unwrap();
        entries.clear();
    }
}

/// 复合 Logger：同时写入控制台和缓冲区
pub struct CombinedLogger {
    buffer: &'static LogBuffer,
}

impl CombinedLogger {
    pub fn new(buffer: &'static LogBuffer) -> Self {
        Self { buffer }
    }
}

impl Log for CombinedLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= LevelFilter::Info
    }

    fn log(&self, record: &Record) {
        if self.enabled(record.metadata()) {
            let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
            let level_str = match record.level() {
                Level::Error => "ERROR",
                Level::Warn => "WARN",
                Level::Info => "INFO",
                Level::Debug => "DEBUG",
                Level::Trace => "TRACE",
            };
            
            // 写入缓冲区
            let entry = LogEntry {
                timestamp: timestamp.clone(),
                level: record.level().to_string(),
                target: record.target().to_string(),
                message: record.args().to_string(),
            };
            self.buffer.push(entry);

            // 同时输出到控制台
            println!(
                "[{} {} {}] {}",
                timestamp, level_str, record.target(), record.args()
            );
        }
    }

    fn flush(&self) {}
}

/// 全局日志缓冲区（最多存储 1000 条日志）
static LOG_BUFFER: once_cell::sync::Lazy<LogBuffer> =
    once_cell::sync::Lazy::new(|| LogBuffer::new(1000));

/// 获取全局日志缓冲区
pub fn get_log_buffer() -> &'static LogBuffer {
    &LOG_BUFFER
}

/// 初始化日志系统（使用复合 logger）
pub fn init_logger() {
    static COMBINED_LOGGER: once_cell::sync::Lazy<CombinedLogger> =
        once_cell::sync::Lazy::new(|| CombinedLogger::new(&LOG_BUFFER));

    log::set_logger(&*COMBINED_LOGGER).unwrap();
    log::set_max_level(LevelFilter::Info);
}

/// 获取所有日志
pub fn get_logs() -> Vec<LogEntry> {
    get_log_buffer().get_all()
}

/// 清空日志
pub fn clear_logs() {
    get_log_buffer().clear();
}
