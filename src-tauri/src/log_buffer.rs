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

/// 当前日志级别（全局可变状态）
static CURRENT_LOG_LEVEL: std::sync::atomic::AtomicU8 = std::sync::atomic::AtomicU8::new(3); // Info = 3

/// 将 LevelFilter 转换为 u8（用于原子存储）
fn level_filter_to_u8(level: LevelFilter) -> u8 {
    match level {
        LevelFilter::Off => 0,
        LevelFilter::Error => 1,
        LevelFilter::Warn => 2,
        LevelFilter::Info => 3,
        LevelFilter::Debug => 4,
        LevelFilter::Trace => 5,
    }
}

/// 将 u8 转换为 LevelFilter
fn u8_to_level_filter(val: u8) -> LevelFilter {
    match val {
        0 => LevelFilter::Off,
        1 => LevelFilter::Error,
        2 => LevelFilter::Warn,
        3 => LevelFilter::Info,
        4 => LevelFilter::Debug,
        _ => LevelFilter::Trace,
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
        let current = u8_to_level_filter(CURRENT_LOG_LEVEL.load(std::sync::atomic::Ordering::Relaxed));
        metadata.level() <= current
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
    // 默认 Info 级别
    CURRENT_LOG_LEVEL.store(level_filter_to_u8(LevelFilter::Info), std::sync::atomic::Ordering::Relaxed);
    log::set_max_level(LevelFilter::Info);
}

/// 获取当前日志级别
pub fn get_log_level() -> LevelFilter {
    u8_to_level_filter(CURRENT_LOG_LEVEL.load(std::sync::atomic::Ordering::Relaxed))
}

/// 设置日志级别
pub fn set_log_level(level: LevelFilter) {
    CURRENT_LOG_LEVEL.store(level_filter_to_u8(level), std::sync::atomic::Ordering::Relaxed);
    // 同步更新 log crate 的全局过滤，确保 debug! 等宏能通过
    log::set_max_level(level);
}

/// 获取所有日志
pub fn get_logs() -> Vec<LogEntry> {
    get_log_buffer().get_all()
}

/// 清空日志
pub fn clear_logs() {
    get_log_buffer().clear()
}
