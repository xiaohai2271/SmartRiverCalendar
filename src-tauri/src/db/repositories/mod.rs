// 数据库 Repository 模块
// 实现数据访问层，封装各种实体的 CRUD 操作

pub mod account;
pub mod calendar;
pub mod event;
pub mod local_user;
pub mod settings;
pub mod sync_log;
pub mod sync_state;
pub mod todo;

// 重新导出 Repository 类型
pub use account::{Account, AccountRepository, CreateAccountParams, UpdateAccountParams};
pub use calendar::CalendarRepository;
pub use event::{CreateEvent, Event, EventRepository, UpdateEvent};
pub use local_user::{
    CreateLocalUserParams, LocalUser, LocalUserRepository, UpdateLocalUserParams,
};
pub use settings::{SettingEntry, SettingsRepository, UserHoliday, UserHolidaysRepository};
pub use sync_log::{CreateSyncLogParams, SyncLogEntry, SyncLogRepository};
pub use sync_state::{NewSyncState, SyncState, SyncStateRepository, UpdateSyncState};
pub use todo::{CreateTodoInput, Todo, TodoRepository, UpdateTodoInput};
