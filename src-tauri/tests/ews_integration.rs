//! EWS (Exchange Web Services) 集成测试
//!
//! 使用环境变量中的真实账号测试 Exchange 连接功能。
//! 环境变量:
//!   - TEST_EXCHANGE_ACCOUNT: Exchange 账号（邮箱）
//!   - TEST_EXCHANGE_PASSWORD: 密码
//!   - TEST_EXCHANGE_SERVER: Exchange 服务器地址（可选）
//!
//! 腾讯企业邮箱服务器: ex.exmail.qq.com
//! 微软 Office 365: outlook.office365.com

use xiaohe_calendar_lib::ews::{CalendarInfo, EwsClient, EventInfo};

/// 从环境变量获取测试账号信息
fn get_test_credentials() -> Option<(String, String)> {
    let account = std::env::var("TEST_EXCHANGE_ACCOUNT").ok()?;
    let password = std::env::var("TEST_EXCHANGE_PASSWORD").ok()?;

    if account.is_empty() || password.is_empty() {
        return None;
    }

    Some((account, password))
}

/// 获取 EWS 服务器地址
fn get_ews_server_url() -> String {
    // 如果指定了服务器地址，使用指定的
    if let Ok(server) = std::env::var("TEST_EXCHANGE_SERVER") {
        if !server.is_empty() {
            // 确保路径正确
            // 腾讯企业邮箱使用 exchange.ewd 路径
            if server.contains("exmail.qq.com") {
                return "https://ex.exmail.qq.com/exchange.ewd".to_string();
            } else if server.ends_with("/EWS/Exchange.asmx") {
                return server;
            } else if server.ends_with("/") {
                return format!("{}EWS/Exchange.asmx", server);
            } else {
                return format!("https://{}/EWS/Exchange.asmx", server);
            }
        }
    }

    // 默认使用 Office 365
    "https://outlook.office365.com/EWS/Exchange.asmx".to_string()
}

/// 测试 EWS 客户端基本连接
///
/// 验证使用正确的账号密码可以成功连接到 Exchange 服务器
/// 如果服务器返回 403 或 503（EWS 未开通），测试会跳过而不是失败
#[tokio::test]
async fn test_ews_connect_with_server() {
    let Some((account, password)) = get_test_credentials() else {
        eprintln!("跳过测试: 未设置 TEST_EXCHANGE_ACCOUNT 或 TEST_EXCHANGE_PASSWORD 环境变量");
        return;
    };

    let server_url = get_ews_server_url();
    println!("测试连接...");
    println!("  服务器: {}", server_url);
    println!("  账号: {}", account);

    let client = EwsClient::new(server_url, account.clone(), password);

    let result = client.connect().await;

    match &result {
        Ok(()) => println!("✓ 成功连接到 Exchange 服务器"),
        Err(e) => {
            // 检查是否是 EWS 未开通的情况（403/503）
            if e.contains("403 Forbidden") || e.contains("503") {
                eprintln!("⚠ 服务器返回错误，可能是 EWS 功能未开通: {}", e);
                eprintln!("  跳过此测试，请联系管理员开通 EWS 功能");
                return;
            }
            eprintln!("✗ 连接失败: {}", e);
        }
    }

    // 只有成功连接才通过测试
    // 如果是 403/503 错误，则跳过测试
    match &result {
        Ok(()) => {}
        Err(e) if e.contains("403 Forbidden") || e.contains("503") => {
            // EWS 未开通，跳过测试
            return;
        }
        Err(_) => {
            assert!(false, "使用有效账号连接应该成功");
        }
    }
}

/// 测试 EWS 连接失败 - 错误密码
///
/// 验证使用错误密码时连接会失败
#[tokio::test]
async fn test_ews_connect_wrong_password() {
    let Some((account, _)) = get_test_credentials() else {
        eprintln!("跳过测试: 未设置 TEST_EXCHANGE_ACCOUNT 环境变量");
        return;
    };

    let server_url = get_ews_server_url();
    let client = EwsClient::new(server_url, account, "wrong_password_12345".to_string());

    let result = client.connect().await;

    assert!(result.is_err(), "使用错误密码连接应该失败");

    if let Err(e) = result {
        println!("✓ 正确返回错误: {}", e);
    }
}

/// 测试 EWS 连接失败 - 错误服务器地址
///
/// 验证使用错误服务器地址时连接会失败
#[tokio::test]
async fn test_ews_connect_wrong_server() {
    let Some((account, password)) = get_test_credentials() else {
        eprintln!("跳过测试: 未设置 TEST_EXCHANGE_ACCOUNT 或 TEST_EXCHANGE_PASSWORD 环境变量");
        return;
    };

    let client = EwsClient::new(
        "https://invalid-server.example.com/EWS/Exchange.asmx".to_string(),
        account,
        password,
    );

    let result = client.connect().await;

    assert!(result.is_err(), "使用错误服务器地址连接应该失败");

    if let Err(e) = result {
        println!("✓ 正确返回错误: {}", e);
    }
}

/// 测试获取日历文件夹列表
///
/// 验证可以成功获取用户的日历文件夹
#[tokio::test]
async fn test_ews_list_calendars() {
    let Some((account, password)) = get_test_credentials() else {
        eprintln!("跳过测试: 未设置 TEST_EXCHANGE_ACCOUNT 或 TEST_EXCHANGE_PASSWORD 环境变量");
        return;
    };

    let server_url = get_ews_server_url();
    let client = EwsClient::new(server_url, account.clone(), password);

    // 先验证连接
    let connect_result = client.connect().await;
    if connect_result.is_err() {
        eprintln!("跳过测试: 连接失败");
        return;
    }

    // 获取日历列表
    let result = client.list_calendars().await;

    match &result {
        Ok(calendars) => {
            println!("✓ 成功获取日历列表 (账号: {})", account);
            for cal in calendars {
                println!("  - {}: {}", cal.id, cal.name);
            }
        }
        Err(e) => eprintln!("✗ 获取日历列表失败: {}", e),
    }

    assert!(result.is_ok(), "获取日历列表应该成功");

    let calendars = result.unwrap();
    assert!(!calendars.is_empty(), "日历列表不应为空");
}

/// 测试获取事件列表
///
/// 验证可以成功获取指定时间范围内的日历事件
#[tokio::test]
async fn test_ews_fetch_events() {
    let Some((account, password)) = get_test_credentials() else {
        eprintln!("跳过测试: 未设置 TEST_EXCHANGE_ACCOUNT 或 TEST_EXCHANGE_PASSWORD 环境变量");
        return;
    };

    let server_url = get_ews_server_url();
    let client = EwsClient::new(server_url, account.clone(), password);

    // 先验证连接
    let connect_result = client.connect().await;
    if connect_result.is_err() {
        eprintln!("跳过测试: 连接失败");
        return;
    }

    // 获取日历列表以获取有效的日历 ID
    let calendars = client.list_calendars().await;
    if calendars.is_err() {
        eprintln!("跳过测试: 无法获取日历列表");
        return;
    }

    let calendars = calendars.unwrap();
    if calendars.is_empty() {
        eprintln!("跳过测试: 日历列表为空");
        return;
    }

    let calendar_id = &calendars[0].id;

    // 获取最近 7 天的事件
    let now = chrono::Utc::now().timestamp();
    let week_ago = now - 7 * 24 * 3600;

    let result = client.fetch_events(calendar_id, week_ago, now).await;

    match &result {
        Ok(events) => {
            println!("✓ 成功获取事件列表 (账号: {}, 日历: {})", account, calendars[0].name);
            println!("  找到 {} 个事件", events.len());
            for event in events.iter().take(5) {
                println!("  - {}: {}", event.id, event.title);
            }
        }
        Err(e) => eprintln!("✗ 获取事件列表失败: {}", e),
    }

    assert!(result.is_ok(), "获取事件列表应该成功");
}

/// 测试完整的工作流程
///
/// 连接 -> 获取日历 -> 获取事件
#[tokio::test]
async fn test_ews_full_workflow() {
    let Some((account, password)) = get_test_credentials() else {
        eprintln!("跳过测试: 未设置 TEST_EXCHANGE_ACCOUNT 或 TEST_EXCHANGE_PASSWORD 环境变量");
        return;
    };

    let server_url = get_ews_server_url();
    println!("开始测试完整工作流程...");
    println!("  服务器: {}", server_url);
    println!("  账号: {}", account);

    // 1. 创建客户端
    println!("步骤 1: 创建客户端...");
    let client = EwsClient::new(server_url, account.clone(), password);

    // 2. 验证连接
    println!("步骤 2: 验证连接...");
    let connect_result = client.connect().await;
    if connect_result.is_err() {
        eprintln!("✗ 连接失败: {}", connect_result.unwrap_err());
        eprintln!("跳过测试");
        return;
    }
    println!("✓ 连接成功");

    // 3. 获取日历列表
    println!("步骤 3: 获取日历列表...");
    let calendars_result = client.list_calendars().await;
    assert!(calendars_result.is_ok(), "获取日历列表应该成功");

    let calendars = calendars_result.unwrap();
    assert!(!calendars.is_empty(), "日历列表不应为空");
    println!("✓ 找到 {} 个日历", calendars.len());

    // 4. 获取事件（使用第一个日历）
    println!("步骤 4: 获取最近 7 天的事件...");
    let calendar_id = &calendars[0].id;
    let now = chrono::Utc::now().timestamp();
    let week_ago = now - 7 * 24 * 3600;

    let events_result = client.fetch_events(calendar_id, week_ago, now).await;
    assert!(events_result.is_ok(), "获取事件列表应该成功");

    let events = events_result.unwrap();
    println!("✓ 找到 {} 个事件", events.len());

    println!("\n=== 完整工作流程测试通过 ===");
}

/// 测试结构体序列化
///
/// 验证 CalendarInfo 和 EventInfo 可以正确序列化为 JSON
#[test]
fn test_calendar_info_json_serialization() {
    let info = CalendarInfo {
        id: "test-calendar-id".to_string(),
        name: "测试日历".to_string(),
        color: Some("#FF5733".to_string()),
    };

    let json = serde_json::to_string(&info).unwrap();
    assert!(json.contains("test-calendar-id"));
    assert!(json.contains("测试日历"));
    assert!(json.contains("#FF5733"));

    println!("✓ CalendarInfo JSON 序列化正确: {}", json);
}

#[test]
fn test_event_info_json_serialization() {
    let event = EventInfo {
        id: "test-event-id".to_string(),
        title: "测试会议".to_string(),
        description: Some("会议描述".to_string()),
        start_time: 1700000000,
        end_time: 1700003600,
        all_day: false,
        location: Some("会议室A".to_string()),
    };

    let json = serde_json::to_string(&event).unwrap();
    assert!(json.contains("test-event-id"));
    assert!(json.contains("测试会议"));
    assert!(json.contains("会议室A"));

    println!("✓ EventInfo JSON 序列化正确: {}", json);
}
