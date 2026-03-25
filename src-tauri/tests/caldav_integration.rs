//! CalDAV 集成测试
//!
//! 使用环境变量中的真实账号测试 CalDAV 连接功能。
//! 环境变量:
//!   - TEST_CALDAV_ACCOUNT: CalDAV 用户名
//!   - TEST_CALDAV_PASSWORD: CalDAV 密码
//!   - TEST_CALDAV_ADDRESS: CalDAV 服务器地址

use xiaohe_calendar_lib::caldav::CalDavClient;

fn get_test_credentials() -> Option<(String, String, String)> {
    let account = std::env::var("TEST_CALDAV_ACCOUNT").ok()?;
    let password = std::env::var("TEST_CALDAV_PASSWORD").ok()?;
    let address = std::env::var("TEST_CALDAV_ADDRESS").ok()?;

    if account.is_empty() || password.is_empty() || address.is_empty() {
        return None;
    }

    Some((account, password, address))
}

/// 构建完整的服务器 URL
fn build_server_url(address: &str) -> String {
    if address.starts_with("http") {
        address.to_string()
    } else {
        format!("https://{}", address)
    }
}

/// 测试 CalDAV 客户端连接
#[tokio::test]
async fn test_caldav_connect() {
    let Some((account, password, address)) = get_test_credentials() else {
        eprintln!("跳过测试: 未设置 CalDAV 环境变量");
        return;
    };

    println!("测试 CalDAV 连接...");
    println!("  服务器: {}", address);
    println!("  账号: {}", account);

    // 尝试使用 https:// 前缀
    let server_url = if address.starts_with("http") {
        address.clone()
    } else {
        format!("https://{}", address)
    };

    println!("  完整 URL: {}", server_url);

    let client = CalDavClient::new(server_url, account.clone(), password);
    let result = client.connect().await;

    match &result {
        Ok(()) => println!("✓ 成功连接到 CalDAV 服务器"),
        Err(e) => eprintln!("✗ 连接失败: {}", e),
    }

    assert!(result.is_ok(), "CalDAV 连接应该成功");
}

/// 测试 CalDAV 获取日历列表
#[tokio::test]
async fn test_caldav_list_calendars() {
    let Some((account, password, address)) = get_test_credentials() else {
        eprintln!("跳过测试: 未设置 CalDAV 环境变量");
        return;
    };

    let server_url = build_server_url(&address);
    let client = CalDavClient::new(server_url, account.clone(), password);

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
                println!("  - {}: {}", cal.name, cal.url);
            }
        }
        Err(e) => eprintln!("✗ 获取日历列表失败: {}", e),
    }

    assert!(result.is_ok(), "获取日历列表应该成功");
}

/// 测试 CalDAV 获取事件
#[tokio::test]
async fn test_caldav_fetch_events() {
    let Some((account, password, address)) = get_test_credentials() else {
        eprintln!("跳过测试: 未设置 CalDAV 环境变量");
        return;
    };

    let server_url = build_server_url(&address);
    let client = CalDavClient::new(server_url, account.clone(), password);

    // 验证连接
    let connect_result = client.connect().await;
    if connect_result.is_err() {
        eprintln!("跳过测试: 连接失败");
        return;
    }

    // 获取日历列表
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

    // 获取最近 7 天的事件
    let now = chrono::Utc::now().timestamp();
    let week_ago = now - 7 * 24 * 3600;

    let calendar_url = &calendars[0].url;
    let result = client.fetch_events(calendar_url, week_ago, now).await;

    match &result {
        Ok(events) => {
            println!("✓ 成功获取事件列表 (日历: {})", calendars[0].name);
            println!("  找到 {} 个事件", events.len());
        }
        Err(e) => eprintln!("✗ 获取事件列表失败: {}", e),
    }

    assert!(result.is_ok(), "获取事件列表应该成功");
}

/// 测试 CalDAV 完整工作流程
#[tokio::test]
async fn test_caldav_full_workflow() {
    let Some((account, password, address)) = get_test_credentials() else {
        eprintln!("跳过测试: 未设置 CalDAV 环境变量");
        return;
    };

    let server_url = build_server_url(&address);
    println!("开始 CalDAV 完整工作流程测试...");
    println!("  服务器: {}", server_url);
    println!("  账号: {}", account);

    // 1. 创建客户端
    let client = CalDavClient::new(server_url.clone(), account.clone(), password);

    // 2. 验证连接
    println!("步骤 1: 验证连接...");
    let connect_result = client.connect().await;
    if connect_result.is_err() {
        eprintln!("✗ 连接失败: {}", connect_result.unwrap_err());
        return;
    }
    println!("✓ 连接成功");

    // 3. 获取日历列表
    println!("步骤 2: 获取日历列表...");
    let calendars_result = client.list_calendars().await;
    assert!(calendars_result.is_ok(), "获取日历列表应该成功");

    let calendars = calendars_result.unwrap();
    println!("✓ 找到 {} 个日历", calendars.len());

    if !calendars.is_empty() {
        // 4. 获取事件
        println!("步骤 3: 获取最近 7 天的事件...");
        let now = chrono::Utc::now().timestamp();
        let week_ago = now - 7 * 24 * 3600;

        let events_result = client.fetch_events(&calendars[0].url, week_ago, now).await;
        assert!(events_result.is_ok(), "获取事件应该成功");

        let events = events_result.unwrap();
        println!("✓ 找到 {} 个事件", events.len());
    }

    println!("\n=== CalDAV 完整工作流程测试通过 ===");
}