// 数据库操作模块
// 负责日历数据的本地存储和检索

pub mod connection;
pub mod errors;
pub mod repositories;
pub mod schema;

// 重新导出常用类型，便于外部使用
pub use connection::DatabaseConnection;
pub use errors::{DatabaseError, DatabaseResult};
pub use repositories::{
    calendar::{Calendar, CreateCalendarRequest, UpdateCalendarRequest},
    todo::{CreateTodoInput, Todo, TodoRepository, UpdateTodoInput},
    CalendarRepository, CreateEvent, Event, EventRepository, UpdateEvent,
};
pub use schema::{create_tables, init_database};
