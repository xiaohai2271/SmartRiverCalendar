// clock_hook 模块入口
// Windows 系统时钟区域点击检测功能

pub mod clock_finder;
pub mod hook;
pub mod manager;
pub mod region_updater;
pub mod toggle;

// 公开导出管理器
pub use manager::ClockHookManager;
