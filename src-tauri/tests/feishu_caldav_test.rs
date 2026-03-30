//! 飞书 CalDAV 集成测试
//!
//! 专门用于测试飞书 CalDAV 服务器连接的集成测试。
//!
//! ## 使用方法
//!
//! ### 方式一：使用环境变量（推荐）
//! ```bash
//! # 设置环境变量
//! set FEISHU_CALDAV_USER=your_user_id
//! set FEISHU_CALDAV_PASSWORD=your_app_token
//! set FEISHU_CALDAV_CALENDAR_URL=your_calendar_url (可选)
//! 
//! # 运行测试
//! cargo test --test feishu_caldav_test -- --ignored --nocapture
//! ```
//!
//! ### 方式二：直接修改代码中的测试凭证
//! 在 `get_feishu_credentials()` 函数中修改硬编码的凭证值
//!
//! ## 飞书 CalDAV 配置说明
//!
//! - **服务器地址**: `https://caldav.feishu.cn`
//! - **用户名**: 飞书用户 Open ID 或 Union ID
//! - **密码**: 飞书应用配置中生成的 CalDAV 密码/Token
//!
//! ### 获取飞书 CalDAV 凭证
//!
//! 1. 登录飞书开放平台: https://open.feishu.cn/
//! 2. 创建或选择应用
//! 3. 在应用设置中启用 CalDAV 功能
//! 4. 获取用户 ID 和 CalDAV 密码

use xiaohe_calendar_lib::caldav::{CalDavClient, CalendarInfo, EventInfo};

/// 飞书 CalDAV 服务器地址
const FEISHU_CALDAV_SERVER: &str = "https://caldav.feishu.cn";

/// 获取飞书 CalDAV 测试凭证
///
/// 优先从环境变量读取，如果环境变量未设置则使用硬编码值（用于开发测试）
///
/// ## 环境变量
/// - `FEISHU_CALDAV_USER`: 飞书用户 ID
/// - `FEISHU_CALDAV_PASSWORD`: 飞书 CalDAV 密码/Token
/// - `FEISHU_CALDAV_CALENDAR_URL`: 指定日历 URL（可选）
fn get_feishu_credentials() -> Option<(String, String)> {
    // 优先使用环境变量
    if let (Ok(user), Ok(password)) = (
        std::env::var("FEISHU_CALDAV_USER"),
        std::env::var("FEISHU_CALDAV_PASSWORD"),
    ) {
        if !user.is_empty() && !password.is_empty() {
            println!("[凭证] 使用环境变量中的飞书 CalDAV 凭证");
            return Some((user, password));
        }
    }

    // 硬编码测试凭证（用于本地开发测试）
    // 注意：提交代码前请确保不要泄露真实的凭证信息
    let user = "u_xptl9894";
    let password = "Sx4xXaYFpv";
    if !user.is_empty() && !password.is_empty() {
        println!("[凭证] 使用硬编码的飞书 CalDAV 凭证");
        return Some((user.to_string(), password.to_string()));
    }

    None
}

/// 打印分隔线
fn print_separator(title: &str) {
    println!("\n{}", "=".repeat(60));
    println!("  {}", title);
    println!("{}\n", "=".repeat(60));
}

/// 打印日历信息
fn print_calendar_info(calendars: &[CalendarInfo]) {
    println!("\n📅 日历列表 (共 {} 个):\n", calendars.len());
    for (i, cal) in calendars.iter().enumerate() {
        println!("  [{}] {}", i + 1, cal.name);
        println!("      ID: {}", cal.id);
        println!("      URL: {}", cal.url);
        if let Some(ref color) = cal.color {
            println!("      颜色: {}", color);
        }
        println!("      只读: {}", if cal.read_only { "是" } else { "否" });
        println!();
    }
}

/// 打印事件信息
fn print_event_info(events: &[EventInfo]) {
    println!("\n📆 事件列表 (共 {} 个):\n", events.len());
    for (i, event) in events.iter().enumerate() {
        println!("  [{}] {}", i + 1, event.title);
        println!("      ID: {}", event.id);
        println!("      开始时间: {} (时间戳: {})", event.start_time, event.start_time);
        println!("      结束时间: {} (时间戳: {})", event.end_time, event.end_time);
        println!("      全天事件: {}", if event.all_day { "是" } else { "否" });
        if let Some(ref desc) = event.description {
            println!("      描述: {}", desc);
        }
        if let Some(ref loc) = event.location {
            println!("      地点: {}", loc);
        }
        println!();
    }
}

/// 获取指定的日历 URL
///
/// 优先从环境变量读取，如果未设置则使用硬编码值
fn get_calendar_url() -> Option<String> {
    // 优先使用环境变量
    if let Ok(url) = std::env::var("FEISHU_CALDAV_CALENDAR_URL") {
        if !url.is_empty() {
            println!("[日历URL] 使用环境变量中的日历 URL");
            return Some(url);
        }
    }

    // 硬编码日历 URL
    let url = "https://caldav.feishu.cn/u_xptl9894/66DEC3A3-D95F-4002-66DE-C3A3D95F4002/";
    if !url.is_empty() {
        println!("[日历URL] 使用硬编码的日历 URL");
        return Some(url.to_string());
    }

    None
}

/// 测试飞书 CalDAV 连接
///
/// 验证能否成功连接到飞书 CalDAV 服务器
#[tokio::test]
#[ignore = "需要真实的飞书 CalDAV 凭证，不应在 CI 中运行"]
async fn test_feishu_caldav_connect() {
    print_separator("飞书 CalDAV 连接测试");

    let Some((user, password)) = get_feishu_credentials() else {
        println!("⚠️  跳过测试: 未配置飞书 CalDAV 凭证");
        println!("\n请设置以下环境变量:");
        println!("  - FEISHU_CALDAV_USER: 飞书用户 ID");
        println!("  - FEISHU_CALDAV_PASSWORD: 飞书 CalDAV 密码");
        println!("\n或在代码中配置硬编码凭证后重新运行测试");
        return;
    };

    println!("📡 服务器: {}", FEISHU_CALDAV_SERVER);
    println!("👤 用户: {}", user);
    println!();

    // 创建 CalDAV 客户端
    let client = CalDavClient::new(
        FEISHU_CALDAV_SERVER.to_string(),
        user.clone(),
        password,
    );

    println!("🔌 正在连接飞书 CalDAV 服务器...");
    let result = client.connect().await;

    match &result {
        Ok(()) => {
            println!("✅ 成功连接到飞书 CalDAV 服务器!");
            println!("   服务器支持 CalDAV 协议");
        }
        Err(e) => {
            println!("❌ 连接失败: {}", e);
            println!("\n可能的原因:");
            println!("  1. 用户名或密码错误");
            println!("  2. 飞书应用未启用 CalDAV 功能");
            println!("  3. 网络连接问题");
            println!("  4. 服务器暂时不可用");
        }
    }

    assert!(result.is_ok(), "飞书 CalDAV 连接应该成功");
}

/// 测试飞书 CalDAV 获取日历列表
///
/// 验证能否成功获取飞书账户的日历列表
#[tokio::test]
#[ignore = "需要真实的飞书 CalDAV 凭证，不应在 CI 中运行"]
async fn test_feishu_caldav_list_calendars() {
    print_separator("飞书 CalDAV 日历列表测试");

    let Some((user, password)) = get_feishu_credentials() else {
        println!("⚠️  跳过测试: 未配置飞书 CalDAV 凭证");
        return;
    };

    println!("📡 服务器: {}", FEISHU_CALDAV_SERVER);
    println!("👤 用户: {}", user);
    println!();

    let client = CalDavClient::new(
        FEISHU_CALDAV_SERVER.to_string(),
        user.clone(),
        password,
    );

    // 先验证连接
    println!("🔌 步骤 1: 验证连接...");
    match client.connect().await {
        Ok(()) => println!("✅ 连接成功"),
        Err(e) => {
            println!("❌ 连接失败: {}", e);
            return;
        }
    }

    // 获取日历列表
    println!("\n📋 步骤 2: 获取日历列表...");
    let result = client.list_calendars().await;

    match &result {
        Ok(calendars) => {
            println!("✅ 成功获取日历列表!");
            print_calendar_info(calendars);

            if calendars.is_empty() {
                println!("⚠️  注意: 该账户下没有可用的日历");
            }
        }
        Err(e) => {
            println!("❌ 获取日历列表失败: {}", e);
            println!("\n可能的原因:");
            println!("  1. 用户没有日历访问权限");
            println!("  2. CalDAV 服务配置问题");
            println!("  3. 服务器响应格式异常");
        }
    }

    assert!(result.is_ok(), "获取飞书日历列表应该成功");
}

/// 测试飞书 CalDAV 完整工作流程
///
/// 执行完整的 CalDAV 操作流程：连接 -> 发现 principal -> 获取日历主路径 -> 列出日历
#[tokio::test]
#[ignore = "需要真实的飞书 CalDAV 凭证，不应在 CI 中运行"]
async fn test_feishu_caldav_full_workflow() {
    print_separator("飞书 CalDAV 完整工作流程测试");

    let Some((user, password)) = get_feishu_credentials() else {
        println!("⚠️  跳过测试: 未配置飞书 CalDAV 凭证");
        return;
    };

    println!("📡 服务器: {}", FEISHU_CALDAV_SERVER);
    println!("👤 用户: {}", user);
    println!();

    // 1. 创建客户端
    let client = CalDavClient::new(
        FEISHU_CALDAV_SERVER.to_string(),
        user.clone(),
        password,
    );

    // 2. 验证连接
    println!("📥 步骤 1: 验证服务器连接");
    println!("   发送 OPTIONS 请求检查 DAV 支持...");

    match client.connect().await {
        Ok(()) => println!("   ✅ 连接验证通过，服务器支持 CalDAV"),
        Err(e) => {
            println!("   ❌ 连接失败: {}", e);
            panic!("无法连接到飞书 CalDAV 服务器");
        }
    }

    // 3. 发现 principal URL
    println!("\n📥 步骤 2: 发现用户 Principal URL");
    println!("   发送 PROPFIND 请求获取 current-user-principal...");

    match client.discover_principal().await {
        Ok(principal_url) => {
            println!("   ✅ Principal URL: {}", principal_url);
        }
        Err(e) => {
            println!("   ❌ 发现 Principal 失败: {}", e);
        }
    }

    // 4. 获取日历列表
    println!("\n📥 步骤 3: 获取日历列表");
    println!("   发送 PROPFIND 请求获取 calendar-home-set...");
    println!("   发送 PROPFIND 请求获取日历集合...");

    match client.list_calendars().await {
        Ok(calendars) => {
            println!("   ✅ 成功获取 {} 个日历", calendars.len());
            print_calendar_info(&calendars);
        }
        Err(e) => {
            println!("   ❌ 获取日历列表失败: {}", e);
        }
    }

    println!("\n{}", "=".repeat(60));
    println!("  飞书 CalDAV 完整工作流程测试完成");
    println!("{}", "=".repeat(60));
}

/// 测试飞书 CalDAV Principal 发现
///
/// 专门测试 principal URL 的发现过程
#[tokio::test]
#[ignore = "需要真实的飞书 CalDAV 凭证，不应在 CI 中运行"]
async fn test_feishu_caldav_discover_principal() {
    print_separator("飞书 CalDAV Principal 发现测试");

    let Some((user, password)) = get_feishu_credentials() else {
        println!("⚠️  跳过测试: 未配置飞书 CalDAV 凭证");
        return;
    };

    println!("📡 服务器: {}", FEISHU_CALDAV_SERVER);
    println!("👤 用户: {}", user);
    println!();

    let client = CalDavClient::new(
        FEISHU_CALDAV_SERVER.to_string(),
        user.clone(),
        password,
    );

    println!("🔍 发送 PROPFIND 请求获取 current-user-principal...");
    println!("   请求体:");
    println!(r#"   <?xml version="1.0" encoding="utf-8" ?>
   <D:propfind xmlns:D="DAV:">
       <D:prop>
           <D:current-user-principal/>
       </D:prop>
   </D:propfind>"#);
    println!();

    let result = client.discover_principal().await;

    match &result {
        Ok(principal_url) => {
            println!("✅ 成功发现 Principal URL:");
            println!("   {}", principal_url);
        }
        Err(e) => {
            println!("❌ Principal 发现失败: {}", e);
            println!("\n可能的原因:");
            println!("  1. 服务器不支持 current-user-principal 扩展");
            println!("  2. 认证信息错误");
            println!("  3. 用户权限不足");
        }
    }

    assert!(result.is_ok(), "Principal 发现应该成功");
}

/// 测试飞书 CalDAV 日历主路径获取
///
/// 专门测试 calendar-home-set 的获取过程
#[tokio::test]
#[ignore = "需要真实的飞书 CalDAV 凭证，不应在 CI 中运行"]
async fn test_feishu_caldav_get_calendar_home() {
    print_separator("飞书 CalDAV 日历主路径测试");

    let Some((user, password)) = get_feishu_credentials() else {
        println!("⚠️  跳过测试: 未配置飞书 CalDAV 凭证");
        return;
    };

    println!("📡 服务器: {}", FEISHU_CALDAV_SERVER);
    println!("👤 用户: {}", user);
    println!();

    let client = CalDavClient::new(
        FEISHU_CALDAV_SERVER.to_string(),
        user.clone(),
        password,
    );

    // 先获取 principal URL
    println!("📥 步骤 1: 获取 Principal URL...");
    let _principal_url = match client.discover_principal().await {
        Ok(url) => {
            println!("   ✅ Principal URL: {}", url);
            url
        }
        Err(e) => {
            println!("   ❌ 获取 Principal URL 失败: {}", e);
            return;
        }
    };

    // 获取日历主路径
    println!("\n📥 步骤 2: 获取日历主路径...");
    println!("   发送 PROPFIND 请求到 Principal URL...");

    // 注意：get_calendar_home_set 是私有方法，这里通过 list_calendars 间接测试
    match client.list_calendars().await {
        Ok(calendars) => {
            println!("   ✅ 日历主路径获取成功");
            println!("   找到 {} 个日历", calendars.len());

            if let Some(first_cal) = calendars.first() {
                // 从第一个日历 URL 推断日历主路径
                let url_parts: Vec<&str> = first_cal.url.rsplitn(2, '/').collect();
                if url_parts.len() >= 2 {
                    println!("   日历主路径可能是: {}", url_parts[1]);
                }
            }
        }
        Err(e) => {
            println!("   ❌ 获取日历主路径失败: {}", e);
        }
    }
}

/// 测试飞书 CalDAV 获取日程事件
///
/// 验证能否成功获取飞书日历中的事件
#[tokio::test]
#[ignore = "需要真实的飞书 CalDAV 凭证，不应在 CI 中运行"]
async fn test_feishu_caldav_fetch_events() {
    print_separator("飞书 CalDAV 获取事件测试");

    let Some((user, password)) = get_feishu_credentials() else {
        println!("⚠️  跳过测试: 未配置飞书 CalDAV 凭证");
        return;
    };

    println!("📡 服务器: {}", FEISHU_CALDAV_SERVER);
    println!("👤 用户: {}", user);
    println!();

    let client = CalDavClient::new(
        FEISHU_CALDAV_SERVER.to_string(),
        user.clone(),
        password,
    );

    // 1. 验证连接
    println!("🔌 步骤 1: 验证连接...");
    match client.connect().await {
        Ok(()) => println!("✅ 连接成功"),
        Err(e) => {
            println!("❌ 连接失败: {}", e);
            return;
        }
    }

    // 2. 获取日历 URL
    println!("\n📋 步骤 2: 获取日历 URL...");
    let calendar_url = match get_calendar_url() {
        Some(url) => {
            println!("   ✅ 使用指定日历 URL: {}", url);
            url
        }
        None => {
            // 如果没有指定日历 URL，则从日历列表中获取第一个
            println!("   未指定日历 URL，尝试从日历列表获取...");
            match client.list_calendars().await {
                Ok(calendars) => {
                    if let Some(first_cal) = calendars.first() {
                        println!("   ✅ 使用第一个日历: {}", first_cal.name);
                        first_cal.url.clone()
                    } else {
                        println!("   ❌ 没有找到任何日历");
                        return;
                    }
                }
                Err(e) => {
                    println!("   ❌ 获取日历列表失败: {}", e);
                    return;
                }
            }
        }
    };

    // 3. 获取事件
    println!("\n📥 步骤 3: 获取日程事件...");
    
    // 获取当前时间范围（前后 30 天）
    let now = chrono::Utc::now();
    let start = now - chrono::Duration::days(30);
    let end = now + chrono::Duration::days(30);
    
    println!("   时间范围: {} ~ {}", 
        start.format("%Y-%m-%d %H:%M:%S"),
        end.format("%Y-%m-%d %H:%M:%S"));
    println!("   开始时间戳: {}", start.timestamp());
    println!("   结束时间戳: {}", end.timestamp());
    println!();

    let result = client.fetch_events(
        &calendar_url,
        start.timestamp(),
        end.timestamp(),
    ).await;

    match &result {
        Ok(events) => {
            println!("✅ 成功获取事件列表!");
            print_event_info(events);

            if events.is_empty() {
                println!("⚠️  注意: 该日历在指定时间范围内没有事件");
            } else {
                // 验证事件结构
                for event in events {
                    assert!(!event.id.is_empty(), "事件 ID 不应为空");
                    assert!(!event.title.is_empty(), "事件标题不应为空");
                    assert!(event.start_time > 0, "开始时间应大于 0");
                    assert!(event.end_time >= event.start_time, "结束时间应大于等于开始时间");
                }
                println!("✅ 所有事件结构验证通过");
            }
        }
        Err(e) => {
            println!("❌ 获取事件列表失败: {}", e);
            println!("\n可能的原因:");
            println!("  1. 日历 URL 不正确");
            println!("  2. 没有访问该日历的权限");
            println!("  3. CalDAV 服务器响应格式异常");
            println!("  4. 网络连接问题");
        }
    }

    assert!(result.is_ok(), "获取飞书事件列表应该成功");
}

/// 测试飞书 CalDAV 事件 CRUD 完整流程
///
/// 执行完整的事件操作流程：获取 -> 创建 -> 更新 -> 删除
#[tokio::test]
#[ignore = "需要真实的飞书 CalDAV 凭证，不应在 CI 中运行"]
async fn test_feishu_caldav_event_crud() {
    print_separator("飞书 CalDAV 事件 CRUD 测试");

    let Some((user, password)) = get_feishu_credentials() else {
        println!("⚠️  跳过测试: 未配置飞书 CalDAV 凭证");
        return;
    };

    let Some(calendar_url) = get_calendar_url() else {
        println!("⚠️  跳过测试: 未配置日历 URL");
        return;
    };

    println!("📡 服务器: {}", FEISHU_CALDAV_SERVER);
    println!("👤 用户: {}", user);
    println!("📅 日历: {}", calendar_url);
    println!();

    let client = CalDavClient::new(
        FEISHU_CALDAV_SERVER.to_string(),
        user.clone(),
        password,
    );

    // 1. 验证连接
    println!("🔌 步骤 1: 验证连接...");
    match client.connect().await {
        Ok(()) => println!("✅ 连接成功"),
        Err(e) => {
            println!("❌ 连接失败: {}", e);
            return;
        }
    }

    // 2. 创建测试事件
    println!("\n📝 步骤 2: 创建测试事件...");
    let test_event_id = format!("test-event-{}", chrono::Utc::now().format("%Y%m%d%H%M%S"));
    let test_event = EventInfo {
        id: test_event_id.clone(),
        title: "自动化测试事件 - CalDAV".to_string(),
        description: Some("这是一个由自动化测试创建的事件，测试完成后会自动删除".to_string()),
        start_time: (chrono::Utc::now() + chrono::Duration::hours(1)).timestamp(),
        end_time: (chrono::Utc::now() + chrono::Duration::hours(2)).timestamp(),
        all_day: false,
        location: Some("测试地点".to_string()),
    };

    println!("   事件 ID: {}", test_event.id);
    println!("   事件标题: {}", test_event.title);

    let create_result = client.create_event(&calendar_url, &test_event).await;
    
    match &create_result {
        Ok(event_url) => {
            println!("✅ 事件创建成功!");
            println!("   事件 URL: {}", event_url);

            // 3. 获取事件验证
            println!("\n📥 步骤 3: 验证事件已创建...");
            let now = chrono::Utc::now();
            let fetch_result = client.fetch_events(
                &calendar_url,
                (now - chrono::Duration::hours(1)).timestamp(),
                (now + chrono::Duration::hours(3)).timestamp(),
            ).await;

            match &fetch_result {
                Ok(events) => {
                    let found = events.iter().find(|e| e.id == test_event_id);
                    if let Some(event) = found {
                        println!("✅ 找到创建的事件: {}", event.title);
                    } else {
                        println!("⚠️  未在事件列表中找到刚创建的事件");
                    }
                }
                Err(e) => {
                    println!("⚠️  获取事件列表失败: {}", e);
                }
            }

            // 4. 删除测试事件
            println!("\n🗑️  步骤 4: 清理测试事件...");
            let delete_result = client.delete_event(event_url).await;
            match &delete_result {
                Ok(()) => println!("✅ 测试事件已删除"),
                Err(e) => println!("⚠️  删除事件失败: {}", e),
            }
        }
        Err(e) => {
            println!("❌ 创建事件失败: {}", e);
            println!("\n可能的原因:");
            println!("  1. 日历是只读的");
            println!("  2. 没有写权限");
            println!("  3. CalDAV 服务器不支持 PUT 方法创建事件");
        }
    }
}

/// 调试测试：详细打印飞书 CalDAV 事件获取过程
///
/// 此测试用于调试事件获取问题，打印完整的请求和响应信息
#[tokio::test]
#[ignore = "调试测试，需要真实凭证，不应在 CI 中运行"]
async fn test_feishu_caldav_fetch_events_debug() {
    print_separator("飞书 CalDAV 事件获取调试测试");

    // 使用硬编码凭证
    let user = "u_xptl9894";
    let password = "Sx4xXaYFpv";
    let server = "https://caldav.feishu.cn";
    let calendar_url = "https://caldav.feishu.cn/u_xptl9894/66DEC3A3-D95F-4002-66DE-C3A3D95F4002/";

    println!("📡 服务器: {}", server);
    println!("👤 用户: {}", user);
    println!("📅 日历 URL: {}", calendar_url);
    println!();

    // 创建 HTTP 客户端
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .expect("创建 HTTP 客户端失败");

    // 1. 验证连接 (OPTIONS)
    println!("{}", "=".repeat(60));
    println!("步骤 1: 验证连接 (OPTIONS 请求)");
    println!("{}", "=".repeat(60));

    let credentials = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        format!("{}:{}", user, password),
    );

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::AUTHORIZATION,
        reqwest::header::HeaderValue::from_str(&format!("Basic {}", credentials))
            .expect("创建认证头失败"),
    );

    let options_response = client
        .request(reqwest::Method::OPTIONS, server)
        .headers(headers.clone())
        .send()
        .await;

    match options_response {
        Ok(resp) => {
            println!("✅ OPTIONS 响应状态: {}", resp.status());
            if let Some(dav) = resp.headers().get("DAV") {
                println!("   DAV 头: {:?}", dav);
            }
        }
        Err(e) => {
            println!("❌ OPTIONS 请求失败: {}", e);
        }
    }

    // 2. 获取事件 (REPORT calendar-query)
    println!("\n{}", "=".repeat(60));
    println!("步骤 2: 获取日程事件 (REPORT calendar-query)");
    println!("{}", "=".repeat(60));

    // 使用固定时间范围：2026年3月
    let start = chrono::NaiveDate::from_ymd_opt(2026, 3, 1)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc();
    let end = chrono::NaiveDate::from_ymd_opt(2026, 3, 31)
        .unwrap()
        .and_hms_opt(23, 59, 59)
        .unwrap()
        .and_utc();

    let start_str = start.format("%Y%m%dT%H%M%SZ").to_string();
    let end_str = end.format("%Y%m%dT%H%M%SZ").to_string();

    let report_body = format!(
        r#"<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:calendar-data/>
    <D:getetag/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="{}" end="{}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>"#,
        start_str, end_str
    );

    println!("\n📤 REPORT 请求 URL:");
    println!("   {}", calendar_url);
    println!("\n📤 REPORT 请求体:");
    println!("{}", report_body);
    println!("\n📤 时间范围:");
    println!("   开始: {} (timestamp: {})", start.format("%Y-%m-%d %H:%M:%S UTC"), start.timestamp());
    println!("   结束: {} (timestamp: {})", end.format("%Y-%m-%d %H:%M:%S UTC"), end.timestamp());

    let mut report_headers = reqwest::header::HeaderMap::new();
    report_headers.insert(
        reqwest::header::AUTHORIZATION,
        reqwest::header::HeaderValue::from_str(&format!("Basic {}", credentials))
            .expect("创建认证头失败"),
    );
    report_headers.insert(
        reqwest::header::CONTENT_TYPE,
        reqwest::header::HeaderValue::from_static("application/xml"),
    );
    report_headers.insert(
        "Depth",
        reqwest::header::HeaderValue::from_static("1"),
    );

    let report_response = client
        .request(
            reqwest::Method::from_bytes(b"REPORT").unwrap(),
            calendar_url,
        )
        .headers(report_headers)
        .body(report_body.clone())
        .send()
        .await;

    match report_response {
        Ok(resp) => {
            let status = resp.status();
            println!("\n📥 REPORT 响应状态: {}", status);

            // 打印响应头
            println!("\n📥 响应头:");
            for (key, value) in resp.headers() {
                println!("   {}: {:?}", key, value);
            }

            // 读取响应体
            let response_text = resp.text().await.unwrap_or_else(|e| format!("读取响应失败: {}", e));

            println!("\n📥 响应体长度: {} 字节", response_text.len());
            println!("\n📥 完整响应体 (XML):");
            println!("{}", "-".repeat(60));
            println!("{}", response_text);
            println!("{}", "-".repeat(60));

            // 3. 尝试解析事件
            println!("\n{}", "=".repeat(60));
            println!("步骤 3: 解析事件列表");
            println!("{}", "=".repeat(60));

            // 使用 CalDavClient 解析
            let caldav_client = xiaohe_calendar_lib::caldav::CalDavClient::new(
                server.to_string(),
                user.to_string(),
                password.to_string(),
            );

            // 调用 fetch_events 获取事件
            let events_result = caldav_client.fetch_events(
                calendar_url,
                start.timestamp(),
                end.timestamp(),
            ).await;

            match events_result {
                Ok(events) => {
                    println!("\n✅ 解析成功，共获取 {} 个事件", events.len());
                    for (i, event) in events.iter().enumerate() {
                        println!("\n事件 #{}:", i + 1);
                        println!("   ID: {}", event.id);
                        println!("   标题: {}", event.title);
                        println!("   开始时间: {} (timestamp: {})", event.start_time, event.start_time);
                        println!("   结束时间: {} (timestamp: {})", event.end_time, event.end_time);
                        println!("   全天事件: {}", if event.all_day { "是" } else { "否" });
                        if let Some(ref desc) = event.description {
                            println!("   描述: {}", desc);
                        }
                        if let Some(ref loc) = event.location {
                            println!("   地点: {}", loc);
                        }
                    }

                    if events.is_empty() {
                        println!("\n⚠️ 警告: 未获取到任何事件!");
                        println!("   请检查:");
                        println!("   1. 日历 URL 是否正确");
                        println!("   2. 时间范围是否覆盖有事件的日期");
                        println!("   3. 服务器响应是否包含 calendar-data 元素");
                    }
                }
                Err(e) => {
                    println!("\n❌ 解析事件失败: {}", e);
                }
            }
        }
        Err(e) => {
            println!("\n❌ REPORT 请求失败: {}", e);
        }
    }

    println!("\n{}", "=".repeat(60));
    println!("调试测试完成");
    println!("{}", "=".repeat(60));
}
