//! CalDAV 客户端模块
//!
//! 实现 CalDAV 协议的基本功能，包括：
//! - 服务器连接验证
//! - 用户主路径发现
//! - 日历列表获取

#![allow(dead_code)]

use log::{info, error};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use quick_xml::events::Event;
use chrono::{TimeZone, Utc};
use crate::xml_utils::{create_safe_reader, validate_xml_size};
use serde::Serialize;

/// 日历信息结构体
#[derive(Debug, Clone, Serialize)]
pub struct CalendarInfo {
    /// 日历唯一标识符
    pub id: String,
    /// 日历显示名称
    pub name: String,
    /// 日历颜色（可选）
    pub color: Option<String>,
    /// 日历资源 URL
    pub url: String,
    /// 是否只读（共享/订阅日历没有写权限）
    pub read_only: bool,
}

/// 事件信息结构体
#[derive(Debug, Clone, Serialize)]
pub struct EventInfo {
    /// 事件唯一标识符
    pub id: String,
    /// 事件标题
    pub title: String,
    /// 事件描述（可选）
    pub description: Option<String>,
    /// 开始时间（Unix 时间戳，秒）
    pub start_time: i64,
    /// 结束时间（Unix 时间戳，秒）
    pub end_time: i64,
    /// 是否全天事件
    pub all_day: bool,
    /// 事件地点（可选）
    pub location: Option<String>,
}

/// 事件引用结构体（用于两阶段获取）
///
/// 飞书等 CalDAV 服务器的 REPORT calendar-query 响应中
/// calendar-data 可能为空（返回 404），此时需要单独获取每个事件的 iCal 数据
#[derive(Debug, Clone)]
struct EventRef {
    /// 事件资源的 URL（相对或绝对路径）
    href: String,
    /// 事件的 ETag（用于缓存验证）
    etag: Option<String>,
    /// iCal 数据（如果 REPORT 响应中已包含）
    ical_data: Option<String>,
}

/// CalDAV 客户端
pub struct CalDavClient {
    /// CalDAV 服务器地址
    server_url: String,
    /// 用户名
    username: String,
    /// 密码
    password: String,
    /// HTTP 客户端
    client: reqwest::Client,
}

impl CalDavClient {
    /// 创建新的 CalDAV 客户端实例
    ///
    /// # 参数
    /// * `server_url` - CalDAV 服务器地址
    /// * `username` - 用户名
    /// * `password` - 密码
    pub fn new(server_url: String, username: String, password: String) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap_or_default();

        // 规范化服务器 URL：确保包含协议前缀
        let normalized_url = if server_url.starts_with("http://") || server_url.starts_with("https://") {
            server_url
        } else {
            // 默认使用 HTTPS
            format!("https://{}", server_url)
        };

        Self {
            server_url: normalized_url,
            username,
            password,
            client,
        }
    }

    /// 获取 Basic 认证头
    fn get_auth_header(&self) -> Result<HeaderValue, String> {
        let credentials = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            format!("{}:{}", self.username, self.password),
        );
        HeaderValue::from_str(&format!("Basic {}", credentials))
            .map_err(|e| format!("创建认证头失败: {}", e))
    }

    /// 验证服务器是否支持 CalDAV
    ///
    /// 发送 OPTIONS 请求检查服务器的 DAV 支持
    /// 如果服务器不返回 DAV 头部（如钉钉），尝试直接发送 PROPFIND 请求验证
    pub async fn connect(&self) -> Result<(), String> {
        info!("[CalDAV Client] 尝试连接到: {}", self.server_url);

        let auth_header = self.get_auth_header()?;

        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, auth_header.clone());

        info!("[CalDAV Client] 发送 OPTIONS 请求");

        let response = self
            .client
            .request(reqwest::Method::OPTIONS, &self.server_url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| {
                error!("[CalDAV Client] 请求失败: {}", e);
                format!("连接服务器失败: {}", e)
            })?;

        info!("[CalDAV Client] 收到响应, status: {}", response.status());

        if !response.status().is_success() {
            error!("[CalDAV Client] 服务器返回错误状态: {}", response.status());
            return Err(format!("服务器返回错误状态: {}", response.status()));
        }

        let dav_header = response.headers().get("DAV");
        match dav_header {
            Some(value) => {
                let dav_value = value.to_str().unwrap_or("");
                info!("[CalDAV Client] DAV 头: {}", dav_value);
                if !dav_value.contains("1") && !dav_value.contains("2") && !dav_value.contains("calendar-access") {
                    error!("[CalDAV Client] 服务器不支持 DAV 协议");
                    return Err("服务器不支持 DAV 协议".to_string());
                }
                info!("[CalDAV Client] 连接验证成功");
                Ok(())
            }
            None => {
                // 某些 CalDAV 服务器（如钉钉）不返回 DAV 头部
                // 尝试直接发送 PROPFIND 请求验证服务器是否支持 CalDAV
                info!("[CalDAV Client] 服务器未返回 DAV 头部，尝试 PROPFIND 验证");
                self.verify_caldav_by_propfind(&auth_header).await
            }
        }
    }

    /// 通过 PROPFIND 请求验证服务器是否支持 CalDAV
    ///
    /// 用于处理某些不返回 DAV 头部的服务器（如钉钉）
    async fn verify_caldav_by_propfind(&self, auth_header: &HeaderValue) -> Result<(), String> {
        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, auth_header.clone());
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/xml"));
        headers.insert("Depth", HeaderValue::from_static("0"));

        let body = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:">
    <D:prop>
        <D:current-user-principal/>
    </D:prop>
</D:propfind>"#;

        info!("[CalDAV Client] 发送 PROPFIND 验证请求到 {}", self.server_url);

        let response = self
            .client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &self.server_url)
            .headers(headers)
            .body(body)
            .send()
            .await
            .map_err(|e| {
                error!("[CalDAV Client] PROPFIND 请求失败: {}", e);
                format!("验证服务器失败: {}", e)
            })?;

        let status = response.status();
        info!("[CalDAV Client] PROPFIND 响应状态: {}", status);

        if status.is_success() {
            info!("[CalDAV Client] PROPFIND 成功，服务器支持 CalDAV");
            Ok(())
        } else if status.as_u16() == 401 {
            error!("[CalDAV Client] 认证失败");
            Err("认证失败，请检查用户名和密码".to_string())
        } else if status.as_u16() == 404 {
            // 404 可能表示 URL 路径不正确，但服务器本身可达
            // 尝试检查是否需要特定的路径
            info!("[CalDAV Client] PROPFIND 返回 404，可能需要特定路径");
            Err("服务器未返回 DAV 头部，且 PROPFIND 失败。请检查服务器地址是否正确".to_string())
        } else {
            error!("[CalDAV Client] PROPFIND 失败: {}", status);
            Err(format!("验证服务器失败: {}", status))
        }
    }

    /// 发现用户主路径
    ///
    /// 发送 PROPFIND 请求获取当前用户的 principal URL
    pub async fn discover_principal(&self) -> Result<String, String> {
        info!("[CalDAV Client] discover_principal: 开始发现 principal URL, server_url={}", self.server_url);
        
        let auth_header = self.get_auth_header()?;

        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, auth_header);
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/xml"));
        headers.insert(
            "Depth",
            HeaderValue::from_static("0"),
        );

        let body = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:">
    <D:prop>
        <D:current-user-principal/>
    </D:prop>
</D:propfind>"#;

        info!("[CalDAV Client] discover_principal: 发送 PROPFIND 请求到 {}", self.server_url);
        
        let response = self
            .client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &self.server_url)
            .headers(headers)
            .body(body)
            .send()
            .await
            .map_err(|e| {
                error!("[CalDAV Client] discover_principal: 请求失败: {}", e);
                format!("发送 PROPFIND 请求失败: {}", e)
            })?;

        let status = response.status();
        info!("[CalDAV Client] discover_principal: 响应状态: {}", status);
        
        if !status.is_success() {
            error!("[CalDAV Client] discover_principal: 请求失败, status={}", status);
            return Err(format!("PROPFIND 请求失败: {}", status));
        }

        let response_text = response
            .text()
            .await
            .map_err(|e| format!("读取响应失败: {}", e))?;

        // 打印响应内容（截取前2000字符避免日志过长）
        let preview_len = response_text.len().min(2000);
        info!("[CalDAV Client] discover_principal: 响应内容 (前{}字符): {}", preview_len, &response_text[..preview_len]);

        self.parse_principal_url(&response_text)
    }

    /// 解析 principal URL
    fn parse_principal_url(&self, xml: &str) -> Result<String, String> {
        info!("[CalDAV Client] parse_principal_url: 开始解析 XML, 长度={}", xml.len());
        
        validate_xml_size(xml)?;
        let mut reader = create_safe_reader(xml);

        let mut in_href = false;
        let mut in_current_user_principal = false;
        let mut principal_url = String::new();
        let mut found_hrefs: Vec<String> = Vec::new();
        // 用于 fallback：记录第一个有效的相对路径 href
        let mut first_relative_href = String::new();

        loop {
            match reader.read_event() {
                Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                    let local_name = e.local_name();
                    // 记录所有标签名用于调试
                    let name_str = String::from_utf8_lossy(local_name.as_ref()).to_string();
                    if local_name.as_ref() == b"href" {
                        in_href = true;
                        info!("[CalDAV Client] parse_principal_url: 发现 <href> 标签");
                    }
                    // 检测 current-user-principal 元素
                    if name_str.contains("current-user-principal") {
                        in_current_user_principal = true;
                        info!("[CalDAV Client] parse_principal_url: 发现 <current-user-principal> 标签");
                    }
                }
                Ok(Event::Text(ref e)) => {
                    if in_href {
                        let text = e.unescape().map_err(|e| {
                            error!("[CalDAV Client] parse_principal_url: 文本解析失败: {}", e);
                            format!("解析文本失败: {}", e)
                        })?;
                        info!("[CalDAV Client] parse_principal_url: href 内容: {}", text);
                        found_hrefs.push(text.to_string());
                        
                        // 优先：只有在 current-user-principal 元素内的 href 才是 principal URL
                        if in_current_user_principal {
                            principal_url = text.to_string();
                            info!("[CalDAV Client] parse_principal_url: 找到 principal URL (在 current-user-principal 内): {}", principal_url);
                        } else if first_relative_href.is_empty() {
                            // Fallback: 记录第一个有效的相对路径（以 / 开头但不是 //）
                            let trimmed = text.trim();
                            if trimmed.starts_with('/') && !trimmed.starts_with("//") {
                                first_relative_href = text.to_string();
                                info!("[CalDAV Client] parse_principal_url: 记录 fallback href: {}", first_relative_href);
                            }
                        }
                    }
                }
                Ok(Event::End(ref e)) => {
                    let local_name = e.local_name();
                    let name_str = String::from_utf8_lossy(local_name.as_ref()).to_string();
                    if local_name.as_ref() == b"href" {
                        in_href = false;
                    }
                    if name_str.contains("current-user-principal") {
                        in_current_user_principal = false;
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => {
                    // 打印更详细的 XML 解析错误信息
                    let preview = if xml.len() > 500 { &xml[..500] } else { xml };
                    error!("[CalDAV Client] parse_principal_url: XML 解析失败: {} | XML预览: {}", e, preview);
                    return Err(format!("解析 XML 失败: {}", e));
                }
                _ => {}
            }
        }

        // 记录所有找到的 href
        info!("[CalDAV Client] parse_principal_url: 共找到 {} 个 href 元素", found_hrefs.len());
        for (i, href) in found_hrefs.iter().enumerate() {
            info!("[CalDAV Client] parse_principal_url: href[{}] = {}", i, href);
        }

        // 如果没找到 principal URL，尝试使用 fallback
        if principal_url.is_empty() && !first_relative_href.is_empty() {
            principal_url = first_relative_href;
            info!("[CalDAV Client] parse_principal_url: 使用 fallback href: {}", principal_url);
        }

        if principal_url.is_empty() {
            let preview = if xml.len() > 500 { &xml[..500] } else { xml };
            error!("[CalDAV Client] parse_principal_url: 未找到 principal URL | XML预览: {}", preview);
            return Err("未找到 principal URL".to_string());
        }

        if principal_url.starts_with('/') {
            let base = self.server_url.trim_end_matches('/');
            let full_url = format!("{}{}", base, principal_url);
            info!("[CalDAV Client] parse_principal_url: 最终 principal URL (相对路径拼接): {}", full_url);
            Ok(full_url)
        } else {
            info!("[CalDAV Client] parse_principal_url: 最终 principal URL (绝对路径): {}", principal_url);
            Ok(principal_url)
        }
    }

    /// 获取日历主路径
    ///
    /// 从 principal URL 获取日历主路径 (calendar-home-set)
    async fn get_calendar_home_set(&self, principal_url: &str) -> Result<String, String> {
        info!("[CalDAV Client] get_calendar_home_set: 开始获取日历主路径, principal_url={}", principal_url);
        
        let auth_header = self.get_auth_header()?;

        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, auth_header);
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/xml"));
        headers.insert("Depth", HeaderValue::from_static("0"));

        let body = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
    <D:prop>
        <C:calendar-home-set/>
    </D:prop>
</D:propfind>"#;

        info!("[CalDAV Client] get_calendar_home_set: 发送 PROPFIND 请求到 {}", principal_url);
        
        let response = self
            .client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), principal_url)
            .headers(headers)
            .body(body)
            .send()
            .await
            .map_err(|e| {
                error!("[CalDAV Client] get_calendar_home_set: 请求失败: {}", e);
                format!("获取日历主路径失败: {}", e)
            })?;

        let status = response.status();
        info!("[CalDAV Client] get_calendar_home_set: 响应状态: {}", status);
        
        if !status.is_success() {
            error!("[CalDAV Client] get_calendar_home_set: 请求失败, status={}", status);
            return Err(format!("获取日历主路径失败: {}", status));
        }

        let response_text = response
            .text()
            .await
            .map_err(|e| format!("读取响应失败: {}", e))?;

        // 打印响应内容（截取前2000字符避免日志过长）
        let preview_len = response_text.len().min(2000);
        info!("[CalDAV Client] get_calendar_home_set: 响应内容 (前{}字符): {}", preview_len, &response_text[..preview_len]);

        self.parse_calendar_home_set(&response_text)
    }

    /// 解析日历主路径
    fn parse_calendar_home_set(&self, xml: &str) -> Result<String, String> {
        info!("[CalDAV Client] parse_calendar_home_set: 开始解析 XML, 长度={}", xml.len());
        
        validate_xml_size(xml)?;
        let mut reader = create_safe_reader(xml);

        let mut in_href = false;
        let mut in_calendar_home_set = false;
        let mut calendar_home = String::new();
        let mut found_hrefs: Vec<String> = Vec::new();
        // 用于 fallback：记录第一个有效的相对路径 href
        let mut first_relative_href = String::new();

        loop {
            match reader.read_event() {
                Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                    let local_name = e.local_name();
                    let name_str = String::from_utf8_lossy(local_name.as_ref()).to_string();
                    if local_name.as_ref() == b"href" {
                        in_href = true;
                        info!("[CalDAV Client] parse_calendar_home_set: 发现 <href> 标签");
                    }
                    // 检测 calendar-home-set 元素
                    if name_str.contains("calendar-home-set") {
                        in_calendar_home_set = true;
                        info!("[CalDAV Client] parse_calendar_home_set: 发现 <calendar-home-set> 标签");
                    }
                }
                Ok(Event::Text(ref e)) => {
                    if in_href {
                        let text = e.unescape().map_err(|e| {
                            error!("[CalDAV Client] parse_calendar_home_set: 文本解析失败: {}", e);
                            format!("解析文本失败: {}", e)
                        })?;
                        info!("[CalDAV Client] parse_calendar_home_set: href 内容: {}", text);
                        found_hrefs.push(text.to_string());
                        
                        // 优先：只有在 calendar-home-set 元素内的 href 才是日历主路径
                        if in_calendar_home_set {
                            calendar_home = text.to_string();
                            info!("[CalDAV Client] parse_calendar_home_set: 找到日历主路径 (在 calendar-home-set 内): {}", calendar_home);
                        } else if first_relative_href.is_empty() {
                            // Fallback: 记录第一个有效的相对路径（以 / 开头但不是 //）
                            let trimmed = text.trim();
                            if trimmed.starts_with('/') && !trimmed.starts_with("//") {
                                first_relative_href = text.to_string();
                                info!("[CalDAV Client] parse_calendar_home_set: 记录 fallback href: {}", first_relative_href);
                            }
                        }
                    }
                }
                Ok(Event::End(ref e)) => {
                    let local_name = e.local_name();
                    let name_str = String::from_utf8_lossy(local_name.as_ref()).to_string();
                    if local_name.as_ref() == b"href" {
                        in_href = false;
                    }
                    if name_str.contains("calendar-home-set") {
                        in_calendar_home_set = false;
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => {
                    let preview = if xml.len() > 500 { &xml[..500] } else { xml };
                    error!("[CalDAV Client] parse_calendar_home_set: XML 解析失败: {} | XML预览: {}", e, preview);
                    return Err(format!("解析 XML 失败: {}", e));
                }
                _ => {}
            }
        }

        // 记录所有找到的 href
        info!("[CalDAV Client] parse_calendar_home_set: 共找到 {} 个 href 元素", found_hrefs.len());
        for (i, href) in found_hrefs.iter().enumerate() {
            info!("[CalDAV Client] parse_calendar_home_set: href[{}] = {}", i, href);
        }

        // 如果没找到日历主路径，尝试使用 fallback
        if calendar_home.is_empty() && !first_relative_href.is_empty() {
            calendar_home = first_relative_href;
            info!("[CalDAV Client] parse_calendar_home_set: 使用 fallback href: {}", calendar_home);
        }

        if calendar_home.is_empty() {
            let preview = if xml.len() > 500 { &xml[..500] } else { xml };
            error!("[CalDAV Client] parse_calendar_home_set: 未找到日历主路径 | XML预览: {}", preview);
            return Err("未找到日历主路径".to_string());
        }

        if calendar_home.starts_with('/') {
            let base = self.server_url.trim_end_matches('/');
            let full_url = format!("{}{}", base, calendar_home);
            info!("[CalDAV Client] parse_calendar_home_set: 最终日历主路径 (相对路径拼接): {}", full_url);
            Ok(full_url)
        } else {
            info!("[CalDAV Client] parse_calendar_home_set: 最终日历主路径 (绝对路径): {}", calendar_home);
            Ok(calendar_home)
        }
    }

    /// 列出所有可用日历
    ///
    /// 发送 PROPFIND 请求获取日历列表
    /// 
    /// 采用渐进式发现策略：
    /// 1. 标准 CalDAV 发现流程（PROPFIND current-user-principal → calendar-home-set）
    /// 2. 如果失败，尝试基于用户名的常见路径模式（如 /dav/{username}/primary/）
    pub async fn list_calendars(&self) -> Result<Vec<CalendarInfo>, String> {
        info!("[CalDAV Client] 开始列出日历");

        // 策略 1: 标准 CalDAV 发现流程
        match self.standard_discovery().await {
            Ok(calendars) => {
                info!("[CalDAV Client] 标准发现成功，找到 {} 个日历", calendars.len());
                return Ok(calendars);
            }
            Err(e) => {
                info!("[CalDAV Client] 标准发现失败: {}, 尝试用户路径发现", e);
            }
        }

        // 策略 2: 基于用户名的路径发现
        self.user_path_discovery().await
    }

    /// 标准 CalDAV 发现流程
    async fn standard_discovery(&self) -> Result<Vec<CalendarInfo>, String> {
        let principal_url = self.discover_principal().await?;
        info!("[CalDAV Client] principal_url: {}", principal_url);

        let calendar_home = self.get_calendar_home_set(&principal_url).await?;
        info!("[CalDAV Client] calendar_home: {}", calendar_home);

        self.list_calendars_at_path(&calendar_home).await
    }

    /// 基于用户名的路径发现
    /// 
    /// 某些 CalDAV 服务器（如钉钉）不支持标准发现流程，
    /// 需要直接访问用户特定的日历路径。
    /// 常见模式：/dav/{username}/primary/
    async fn user_path_discovery(&self) -> Result<Vec<CalendarInfo>, String> {
        let base_url = self.server_url.trim_end_matches('/');
        
        // 常见的 CalDAV 用户路径模式
        let path_patterns = vec![
            format!("/dav/{}/primary/", self.username),           // 钉钉风格
            format!("/dav/{}/", self.username),                    // 简化风格
            format!("/calendars/{}/", self.username),              // 某些服务器
            format!("/{}/calendar/", self.username),               // 备选风格
        ];

        for path in path_patterns {
            let test_url = format!("{}{}", base_url, path);
            info!("[CalDAV Client] 尝试路径: {}", test_url);

            match self.list_calendars_at_path(&test_url).await {
                Ok(calendars) => {
                    if !calendars.is_empty() {
                        info!("[CalDAV Client] 用户路径发现成功，找到 {} 个日历", calendars.len());
                        return Ok(calendars);
                    }
                }
                Err(e) => {
                    info!("[CalDAV Client] 路径 {} 失败: {}", test_url, e);
                }
            }
        }

        Err("无法发现日历，请检查服务器地址和用户名是否正确".to_string())
    }

    /// 在指定路径列出日历
    async fn list_calendars_at_path(&self, calendar_home: &str) -> Result<Vec<CalendarInfo>, String> {
        let auth_header = self.get_auth_header()?;

        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, auth_header);
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/xml"));
        headers.insert("Depth", HeaderValue::from_static("1"));

        let body = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/">
    <D:prop>
        <D:resourcetype/>
        <D:displayname/>
        <CS:calendar-color/>
        <C:supported-calendar-component-set/>
        <D:current-user-privilege-set/>
    </D:prop>
</D:propfind>"#;

        info!("[CalDAV Client] 发送 PROPFIND 请求到: {}", calendar_home);

        let response = self
            .client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), calendar_home)
            .headers(headers)
            .body(body)
            .send()
            .await
            .map_err(|e| {
                error!("[CalDAV Client] PROPFIND 请求失败: {}", e);
                format!("获取日历列表失败: {}", e)
            })?;

        info!("[CalDAV Client] PROPFIND 响应状态: {}", response.status());

        if !response.status().is_success() {
            error!("[CalDAV Client] 获取日历列表失败, status: {}", response.status());
            return Err(format!("获取日历列表失败: {}", response.status()));
        }

        let response_text = response
            .text()
            .await
            .map_err(|e| format!("读取响应失败: {}", e))?;

        // 记录响应体内容（截取前 500 字符）
        let preview_len = response_text.len().min(500);
        info!("[CalDAV Client] list_calendars: 响应体 (前{}字符): {}", preview_len, &response_text[..preview_len]);
        info!("[CalDAV Client] list_calendars: 响应体总长度: {}", response_text.len());

        self.parse_calendars(&response_text, &calendar_home)
    }

    /// 解析日历列表
    fn parse_calendars(&self, xml: &str, base_url: &str) -> Result<Vec<CalendarInfo>, String> {
        info!("[CalDAV Client] parse_calendars: 开始解析 XML, 长度={}, base_url={}", xml.len(), base_url);
        
        validate_xml_size(xml)?;
        let mut reader = create_safe_reader(xml);

        let mut calendars = Vec::new();
        let mut current_href = String::new();
        let mut current_name = String::new();
        let mut current_color: Option<String> = None;
        let mut is_calendar = false;
        // 权限检测
        let mut in_privilege_set = false;
        let mut has_write = false;

        let mut in_href = false;
        let mut in_displayname = false;
        let mut in_color = false;
        let mut in_resourcetype = false;
        let mut response_count = 0;

        loop {
            match reader.read_event() {
                Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                    let local_name = e.local_name();
                    // 记录关键标签用于调试
                    let name_str = String::from_utf8_lossy(local_name.as_ref()).to_string();
                    match local_name.as_ref() {
                        b"href" => in_href = true,
                        b"displayname" => in_displayname = true,
                        b"calendar-color" => in_color = true,
                        b"resourcetype" => {
                            in_resourcetype = true;
                            info!("[CalDAV Client] parse_calendars: 发现 <resourcetype> 标签");
                        }
                        b"current-user-privilege-set" => in_privilege_set = true,
                        b"calendar" => {
                            if in_resourcetype {
                                is_calendar = true;
                                info!("[CalDAV Client] parse_calendars: 发现 <calendar> 标签，标记为日历资源");
                            }
                        }
                        // write 或 all 权限都视为有写权限
                        b"write" | b"write-content" | b"bind" => {
                            if in_privilege_set {
                                has_write = true;
                                info!("[CalDAV Client] parse_calendars: 发现写权限: {}", name_str);
                            }
                        }
                        _ => {}
                    }
                }
                Ok(Event::Text(ref e)) => {
                    let text = e.unescape().map_err(|e| {
                        error!("[CalDAV Client] parse_calendars: 文本解析失败: {}", e);
                        format!("解析文本失败: {}", e)
                    })?;
                    if in_href {
                        current_href = text.to_string();
                        info!("[CalDAV Client] parse_calendars: href = {}", current_href);
                    } else if in_displayname {
                        current_name = text.to_string();
                        info!("[CalDAV Client] parse_calendars: displayname = {}", current_name);
                    } else if in_color {
                        let c = text.trim();
                        info!("[CalDAV Client] parse_calendars: calendar-color = {}", c);
                        if (c.starts_with('#') && (c.len() == 7 || c.len() == 4 || c.len() == 9)) || (c.len() >= 6 && c.chars().all(|ch| ch.is_ascii_hexdigit())) {
                            current_color = Some(c.to_string());
                        }
                    }
                }
                Ok(Event::End(ref e)) => {
                    let local_name = e.local_name();
                    match local_name.as_ref() {
                        b"href" => in_href = false,
                        b"displayname" => in_displayname = false,
                        b"calendar-color" => in_color = false,
                        b"resourcetype" => in_resourcetype = false,
                        b"current-user-privilege-set" => in_privilege_set = false,
                        b"response" => {
                            response_count += 1;
                            info!("[CalDAV Client] parse_calendars: 处理 response #{}, is_calendar={}, href={}", 
                                  response_count, is_calendar, current_href);
                            
                            if is_calendar && !current_href.is_empty() {
                                let calendar_url = if current_href.starts_with('/') {
                                    let base = self.server_url.trim_end_matches('/');
                                    format!("{}{}", base, current_href)
                                } else if current_href.starts_with("http") {
                                    current_href.clone()
                                } else {
                                    format!("{}/{}", base_url.trim_end_matches('/'), current_href)
                                };

                                let id = current_href
                                    .trim_end_matches('/')
                                    .split('/')
                                    .last()
                                    .unwrap_or(&current_href)
                                    .to_string();

                                let name = if current_name.is_empty() {
                                    id.clone()
                                } else {
                                    current_name.clone()
                                };

                                info!("[CalDAV Client] parse_calendars: 发现日历! name={}, url={}, writable={}", name, calendar_url, has_write);

                                calendars.push(CalendarInfo {
                                    id,
                                    name,
                                    color: current_color.clone(),
                                    url: calendar_url,
                                    // 服务器返回了权限信息且无写权限时标记为只读
                                    read_only: !has_write,
                                });
                            } else {
                                if !is_calendar {
                                    info!("[CalDAV Client] parse_calendars: 跳过非日历资源: {}", current_href);
                                }
                                if current_href.is_empty() {
                                    info!("[CalDAV Client] parse_calendars: 跳过空 href");
                                }
                            }

                            current_href.clear();
                            current_name.clear();
                            current_color = None;
                            is_calendar = false;
                            has_write = false;
                        }
                        _ => {}
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => {
                    let preview = if xml.len() > 500 { &xml[..500] } else { xml };
                    error!("[CalDAV Client] parse_calendars: XML 解析失败: {} | XML预览: {}", e, preview);
                    return Err(format!("解析 XML 失败: {}", e));
                }
                _ => {}
            }
        }

        info!("[CalDAV Client] parse_calendars: 共处理 {} 个 response 元素", response_count);
        
        if calendars.is_empty() {
            let preview = if xml.len() > 500 { &xml[..500] } else { xml };
            info!("[CalDAV Client] parse_calendars: 没有发现任何日历 | XML预览: {}", preview);
        } else {
            info!("[CalDAV Client] parse_calendars: 共发现 {} 个日历", calendars.len());
        }

        Ok(calendars)
    }

    /// 获取日历中的事件列表
    ///
    /// 使用 REPORT calendar-query 请求获取指定时间范围内的事件
    /// 
    /// 对于飞书等服务器，REPORT 响应中的 calendar-data 可能为空，
    /// 此时需要额外对每个事件发送 GET 请求获取完整 iCal 数据
    pub async fn fetch_events(&self, calendar_url: &str, start: i64, end: i64) -> Result<Vec<EventInfo>, String> {
        let auth_header = self.get_auth_header()?;

        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, auth_header);
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/xml"));
        headers.insert("Depth", HeaderValue::from_static("1"));

        let start_dt = Utc.timestamp_opt(start, 0).single()
            .ok_or_else(|| "无效的开始时间戳".to_string())?;
        let end_dt = Utc.timestamp_opt(end, 0).single()
            .ok_or_else(|| "无效的结束时间戳".to_string())?;

        let start_str = start_dt.format("%Y%m%dT%H%M%SZ").to_string();
        let end_str = end_dt.format("%Y%m%dT%H%M%SZ").to_string();

        let body = format!(
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

        info!("[CalDAV] 发送 REPORT calendar-query 到: {}", calendar_url);
        
        let response = self
            .client
            .request(reqwest::Method::from_bytes(b"REPORT").unwrap(), calendar_url)
            .headers(headers)
            .body(body)
            .send()
            .await
            .map_err(|e| format!("获取事件列表失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            info!("[CalDAV] REPORT 失败: {}", status);
            return Err(format!("获取事件列表失败: {}", status));
        }

        let response_text = response
            .text()
            .await
            .map_err(|e| format!("读取响应失败: {}", e))?;

        info!("[CalDAV] REPORT 响应长度: {} 字节", response_text.len());

        // 第一阶段：解析事件引用列表
        let event_refs = self.parse_events_refs(&response_text, calendar_url)?;
        info!("[CalDAV] 解析到 {} 个事件引用", event_refs.len());

        // 检查是否所有事件都没有 iCal 数据（飞书等服务器的情况）
        let needs_multiget = event_refs.iter().all(|r| r.ical_data.is_none());
        
        if needs_multiget && !event_refs.is_empty() {
            // 使用 calendar-multiget 批量获取所有事件的 iCal 数据
            info!("[CalDAV] 所有事件都没有 iCal 数据，使用 calendar-multiget 批量获取");
            return self.fetch_events_multiget(calendar_url, &event_refs).await;
        }

        // 如果部分事件已有 iCal 数据，按原来的方式处理
        let mut events = Vec::new();
        for event_ref in event_refs {
            let ical_data = if let Some(ref ical) = event_ref.ical_data {
                // REPORT 响应中已包含 iCal 数据，直接使用
                info!("[CalDAV] 事件 {} 已有 iCal 数据", event_ref.href);
                ical.clone()
            } else {
                // 需要单独获取 iCal 数据
                info!("[CalDAV] 事件 {} 需要单独获取 iCal 数据", event_ref.href);
                match self.fetch_event_ical(&event_ref.href).await {
                    Ok(data) => data,
                    Err(e) => {
                        error!("[CalDAV] 获取事件 {} 的 iCal 数据失败: {}", event_ref.href, e);
                        continue;
                    }
                }
            };

            // 解析 iCal 数据，使用事件 href 作为 ID
            match self.parse_ical_event_with_href(&ical_data, &event_ref.href) {
                Ok(event) => events.push(event),
                Err(e) => {
                    error!("[CalDAV] 解析 iCal 事件失败: {} (href: {})", e, event_ref.href);
                }
            }
        }

        info!("[CalDAV] 成功获取 {} 个事件", events.len());
        Ok(events)
    }

    /// 使用 calendar-multiget 批量获取事件
    ///
    /// 当 REPORT calendar-query 返回的事件没有 calendar-data 时，
    /// 使用 calendar-multiget 批量获取所有事件的完整 iCal 数据
    async fn fetch_events_multiget(&self, calendar_url: &str, event_refs: &[EventRef]) -> Result<Vec<EventInfo>, String> {
        let auth_header = self.get_auth_header()?;

        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, auth_header);
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/xml"));
        headers.insert("Depth", HeaderValue::from_static("1"));

        // 构建 calendar-multiget 请求体
        let mut hrefs_xml = String::new();
        for event_ref in event_refs {
            // 提取相对路径
            let href = if event_ref.href.starts_with(&self.server_url) {
                event_ref.href.replace(&self.server_url, "")
            } else {
                event_ref.href.clone()
            };
            hrefs_xml.push_str(&format!("      <D:href>{}</D:href>\n", href));
        }

        let body = format!(
            r#"<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-multiget xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:calendar-data/>
    <D:getetag/>
  </D:prop>
{}
</C:calendar-multiget>"#,
            hrefs_xml
        );

        info!("[CalDAV] 发送 calendar-multiget 请求到: {}", calendar_url);

        let response = self
            .client
            .request(reqwest::Method::from_bytes(b"REPORT").unwrap(), calendar_url)
            .headers(headers)
            .body(body)
            .send()
            .await
            .map_err(|e| format!("calendar-multiget 请求失败: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            error!("[CalDAV] calendar-multiget 失败: {}", status);
            return Err(format!("calendar-multiget 失败: {}", status));
        }

        let response_text = response
            .text()
            .await
            .map_err(|e| format!("读取响应失败: {}", e))?;

        info!("[CalDAV] calendar-multiget 响应长度: {} 字节", response_text.len());

        // 解析 multiget 响应
        self.parse_multiget_response(&response_text)
    }

    /// 解析 calendar-multiget 响应
    fn parse_multiget_response(&self, xml: &str) -> Result<Vec<EventInfo>, String> {
        validate_xml_size(xml)?;
        let mut reader = create_safe_reader(xml);

        let mut events = Vec::new();
        let mut _in_response = false;
        let mut in_href = false;
        let mut in_calendar_data = false;
        let mut current_href = String::new();
        let mut current_ical = String::new();

        loop {
            match reader.read_event() {
                Ok(Event::Start(ref e)) => {
                    match e.local_name().as_ref() {
                        b"response" => {
                             _in_response = true;
                            current_href.clear();
                            current_ical.clear();
                        }
                        b"href" => {
                            in_href = true;
                        }
                        b"calendar-data" => {
                            in_calendar_data = true;
                            current_ical.clear();
                        }
                        _ => {}
                    }
                }
                Ok(Event::Text(ref e)) => {
                    if in_href {
                        let text = e.unescape().map_err(|e| format!("解析文本失败: {}", e))?;
                        current_href.push_str(&text);
                    } else if in_calendar_data {
                        let text = e.unescape().map_err(|e| format!("解析文本失败: {}", e))?;
                        current_ical.push_str(&text);
                    }
                }
                Ok(Event::CData(ref e)) => {
                    if in_calendar_data {
                        let text = String::from_utf8_lossy(e.as_ref()).to_string();
                        current_ical.push_str(&text);
                    }
                }
                Ok(Event::End(ref e)) => {
                    match e.local_name().as_ref() {
                        b"href" => {
                            in_href = false;
                        }
                        b"calendar-data" => {
                            in_calendar_data = false;
                            if !current_ical.is_empty() && !current_href.is_empty() {
                                // 将相对 href 转换为完整 URL
                                let full_href = if current_href.starts_with("http") {
                                    current_href.clone()
                                } else {
                                    format!("{}{}", self.server_url.trim_end_matches('/'), current_href)
                                };
                                
                                match self.parse_ical_event_with_href(&current_ical, &full_href) {
                                    Ok(event) => {
                                        events.push(event);
                                    }
                                    Err(e) => {
                                        error!("[CalDAV] 解析 multiget iCal 失败: {} (href: {})", e, full_href);
                                    }
                                }
                            }
                            current_ical.clear();
                        }
                        b"response" => {
                             _in_response = false;
                        }
                        _ => {}
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(format!("解析 XML 失败: {}", e)),
                _ => {}
            }
        }

        info!("[CalDAV] calendar-multiget 解析到 {} 个事件", events.len());
        Ok(events)
    }

    /// 获取单个事件的 iCal 数据
    ///
    /// 对事件 URL 发送 GET 请求获取完整的 iCal 内容
    async fn fetch_event_ical(&self, event_url: &str) -> Result<String, String> {
        let auth_header = self.get_auth_header()?;

        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, auth_header);
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("text/calendar"));

        info!("[CalDAV] GET 请求获取事件 iCal: {}", event_url);

        let response = self
            .client
            .get(event_url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("获取事件 iCal 失败: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            return Err(format!("获取事件 iCal 失败: HTTP {}", status));
        }

        let ical_data = response
            .text()
            .await
            .map_err(|e| format!("读取事件 iCal 失败: {}", e))?;

        info!("[CalDAV] 成功获取事件 iCal，长度: {} 字节", ical_data.len());
        Ok(ical_data)
    }

    /// 解析事件引用列表
    ///
    /// 从 REPORT calendar-query 响应中提取事件 href、etag 和 calendar-data
    fn parse_events_refs(&self, xml: &str, calendar_url: &str) -> Result<Vec<EventRef>, String> {
        info!("[CalDAV] parse_events_refs: 开始解析 XML, 长度={}", xml.len());
        
        validate_xml_size(xml)?;
        let mut reader = create_safe_reader(xml);

        let mut event_refs = Vec::new();
        let mut current_href = String::new();
        let mut current_etag = Option::<String>::None;
        let mut current_ical = Option::<String>::None;
        
        let mut in_href = false;
        let mut in_getetag = false;
        let mut in_status = false;
        let mut current_status;
        let mut response_count = 0;
        let mut calendar_data_status = String::new();

        loop {
            match reader.read_event() {
                Ok(Event::Start(ref e)) => {
                    let local_name = e.local_name();
                    
                    match local_name.as_ref() {
                        b"href" => {
                            in_href = true;
                            current_href.clear();
                        }
                        b"getetag" => {
                            in_getetag = true;
                        }
                        b"status" => {
                            in_status = true;
                        }
                        _ => {}
                    }
                }
                Ok(Event::Empty(ref e)) => {
                    // 空元素处理，如 <C:calendar-data/>
                    let local_name = e.local_name();
                    let name_str = String::from_utf8_lossy(local_name.as_ref()).to_string();
                    
                    // calendar-data 空元素表示服务器返回 404
                    if name_str.contains("calendar-data") {
                        info!("[CalDAV] parse_events_refs: calendar-data 为空元素，服务器返回 404");
                        current_ical = None;
                    }
                }
                Ok(Event::Text(ref e)) => {
                    let text = e.unescape().map_err(|e| format!("解析文本失败: {}", e))?;
                    
                    if in_href {
                        current_href = text.to_string();
                        info!("[CalDAV] parse_events_refs: href = {}", current_href);
                    } else if in_getetag {
                        current_etag = Some(text.to_string());
                        info!("[CalDAV] parse_events_refs: etag = {:?}", current_etag);
                    } else if in_status {
                        current_status = text.to_string();
                        info!("[CalDAV] parse_events_refs: status = {}", current_status);
                        
                        // 记录 calendar-data 相关的 propstat 状态
                        // 如果状态包含 404，表示 calendar-data 获取失败
                        if text.contains("404") {
                            calendar_data_status = text.to_string();
                        }
                    }
                }
                Ok(Event::CData(ref e)) => {
                    // CDATA 内容通常包含 iCal 数据
                    let text = String::from_utf8_lossy(e.as_ref()).to_string();
                    info!("[CalDAV] parse_events_refs: 获取到 CDATA iCal 数据, 长度={}", text.len());
                    current_ical = Some(text);
                }
                Ok(Event::End(ref e)) => {
                    let local_name = e.local_name();
                    
                    match local_name.as_ref() {
                        b"href" => in_href = false,
                        b"getetag" => in_getetag = false,
                        b"status" => in_status = false,
                        b"response" => {
                            response_count += 1;
                            info!("[CalDAV] parse_events_refs: 处理 response #{}, href={}", 
                                  response_count, current_href);
                            
                            // 一个 response 元素结束，保存事件引用
                            if !current_href.is_empty() {
                                // 处理相对 URL
                                let full_url = if current_href.starts_with("http") {
                                    current_href.clone()
                                } else if current_href.starts_with('/') {
                                    let base = self.server_url.trim_end_matches('/');
                                    format!("{}{}", base, current_href)
                                } else {
                                    format!("{}/{}", calendar_url.trim_end_matches('/'), current_href)
                                };

                                // 检查 iCal 数据是否有效
                                let ical_data = if let Some(ref ical) = current_ical {
                                    if ical.contains("BEGIN:VCALENDAR") {
                                        Some(ical.clone())
                                    } else {
                                        info!("[CalDAV] parse_events_refs: iCal 数据无效（不包含 BEGIN:VCALENDAR）");
                                        None
                                    }
                                } else {
                                    info!("[CalDAV] parse_events_refs: 无 iCal 数据");
                                    None
                                };

                                info!("[CalDAV] parse_events_refs: 添加事件引用 href={}, has_ical={}", 
                                      full_url, ical_data.is_some());

                                event_refs.push(EventRef {
                                    href: full_url,
                                    etag: current_etag.clone(),
                                    ical_data,
                                });
                            }
                            
                            // 重置状态
                            current_href.clear();
                            current_etag = None;
                            current_ical = None;
                            calendar_data_status.clear();
                        }
                        _ => {}
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => {
                    let preview = if xml.len() > 500 { &xml[..500] } else { xml };
                    return Err(format!("解析 XML 失败: {} | XML预览: {}", e, preview));
                }
                _ => {}
            }
        }

        info!("[CalDAV] parse_events_refs: 共解析到 {} 个事件引用", event_refs.len());
        Ok(event_refs)
    }

    /// 解析事件响应（用于标准 CalDAV 服务器，响应中包含完整 iCal 数据）
    ///
    /// 从 REPORT calendar-query 响应中解析事件列表
    fn parse_events_response(&self, xml: &str) -> Result<Vec<EventInfo>, String> {
        validate_xml_size(xml)?;
        let mut reader = create_safe_reader(xml);

        let mut events = Vec::new();
        let mut in_calendar_data = false;
        let mut current_ical = String::new();

        loop {
            match reader.read_event() {
                Ok(Event::Start(ref e)) => {
                    if e.local_name().as_ref() == b"calendar-data" {
                        in_calendar_data = true;
                        current_ical.clear();
                    }
                }
                Ok(Event::Text(ref e)) => {
                    if in_calendar_data {
                        let text = e.unescape().map_err(|e| format!("解析文本失败: {}", e))?;
                        current_ical.push_str(&text);
                    }
                }
                Ok(Event::CData(ref e)) => {
                    if in_calendar_data {
                        let text = String::from_utf8_lossy(e.as_ref()).to_string();
                        current_ical.push_str(&text);
                    }
                }
                Ok(Event::End(ref e)) => {
                    if e.local_name().as_ref() == b"calendar-data" {
                        in_calendar_data = false;
                        if !current_ical.is_empty() {
                            match self.parse_ical_event(&current_ical) {
                                Ok(event) => {
                                    events.push(event);
                                }
                                Err(e) => {
                                    error!("[CalDAV] 解析个别 iCal 事件失败: {} (iCal 长度: {})", e, current_ical.len());
                                }
                            }
                        }
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(format!("解析 XML 失败: {}", e)),
                _ => {}
            }
        }

        Ok(events)
    }

    /// 解析 iCal 事件数据
    /// 
    /// # 参数
    /// - `ical_data`: iCal 格式的事件数据
    /// - `event_href`: 事件的完整 URL（用于更新/删除操作）
    fn parse_ical_event_with_href(&self, ical_data: &str, event_href: &str) -> Result<EventInfo, String> {
        let parser = ical::IcalParser::new(ical_data.as_bytes());
        let mut events = Vec::new();

        for calendar in parser {
            let calendar = calendar.map_err(|e| format!("解析 iCal 失败: {}", e))?;
            for event in calendar.events {
                let mut id = String::new();
                let mut title = String::new();
                let mut description = None;
                let mut start_time = 0i64;
                let mut end_time = 0i64;
                let mut all_day = false;
                let mut location = None;

                for property in event.properties {
                    match property.name.as_str() {
                        "UID" => {
                            id = property.value.unwrap_or_default();
                        }
                        "SUMMARY" => {
                            title = property.value.unwrap_or_default();
                        }
                        "DESCRIPTION" => {
                            description = property.value;
                        }
                        "DTSTART" => {
                            if let Some(val) = property.value {
                                if let Some(params) = property.params {
                                    for (key, _) in params {
                                        if key == "VALUE" {
                                            all_day = true;
                                        }
                                    }
                                }
                                start_time = self.parse_ical_datetime(&val, all_day)?;
                            }
                        }
                        "DTEND" => {
                            if let Some(val) = property.value {
                                end_time = self.parse_ical_datetime(&val, all_day)?;
                            }
                        }
                        "LOCATION" => {
                            location = property.value;
                        }
                        _ => {}
                    }
                }

                if !title.is_empty() && (!id.is_empty() || !event_href.is_empty()) {
                    // 如果有 event_href，使用它作为 id（用于更新/删除）
                    // 否则使用 UID 作为 id（用于测试和向后兼容）
                    let final_id = if !event_href.is_empty() {
                        event_href.to_string()
                    } else {
                        id
                    };
                    
                    events.push(EventInfo {
                        id: final_id,
                        title,
                        description,
                        start_time,
                        end_time,
                        all_day,
                        location,
                    });
                }
            }
        }

        events.into_iter().next()
            .ok_or_else(|| "未找到 VEVENT 组件".to_string())
    }

    /// 解析 iCal 事件数据（保留旧方法以兼容测试）
    fn parse_ical_event(&self, ical_data: &str) -> Result<EventInfo, String> {
        self.parse_ical_event_with_href(ical_data, "")
    }

    /// 解析 iCal 日期时间
    ///
    /// 根据 iCal 规范 (RFC 5545) 处理不同格式的时间：
    /// - UTC 时间: 以 Z 结尾，如 20240320T090000Z
    /// - 本地时间/浮动时间: 不带 Z，如 20240320T090000
    /// - 全天事件: 仅日期，如 20240320
    ///
    /// 对于不带 Z 的时间，按照 iCal 规范将其解释为"浮动时间"（floating time），
    /// 即没有时区信息的时间。在日历应用中，这通常意味着"用户本地时区的时间"。
    ///
    /// 注意：当前实现不处理 TZID 参数，对于带时区 ID 的时间（如 TZID=Asia/Shanghai），
    /// 会按照不带 Z 的方式处理，可能会有时区偏差。
    fn parse_ical_datetime(&self, datetime: &str, all_day: bool) -> Result<i64, String> {
        if all_day {
            // 全天事件格式: YYYYMMDD
            // 全天事件按 UTC 日期处理，避免时区转换导致日期变化
            let date = chrono::NaiveDate::parse_from_str(datetime, "%Y%m%d")
                .map_err(|e| format!("解析日期失败: {}", e))?;
            let naive_datetime = date.and_hms_opt(0, 0, 0)
                .ok_or_else(|| "创建日期时间失败".to_string())?;
            // 使用 UTC 时区，保证全天事件的日期不因时区转换而变化
            Ok(naive_datetime.and_utc().timestamp())
        } else {
            // 带时间格式: YYYYMMDDTHHMMSSZ 或 YYYYMMDDTHHMMSS
            if datetime.ends_with('Z') {
                // UTC 时间格式: 以 Z 结尾表示 UTC
                let naive = chrono::NaiveDateTime::parse_from_str(datetime, "%Y%m%dT%H%M%SZ")
                    .map_err(|e| format!("解析日期时间失败(UTC): {} (原始数据: {})", e, datetime))?;
                // 直接转换为 UTC DateTime 并获取时间戳
                Ok(naive.and_utc().timestamp())
            } else {
                // 本地时间/浮动时间格式: 不带 Z
                // iCal 规范中，不带 Z 的时间是"浮动时间"，应解释为本地时区
                // 例如：飞书返回的 09:00 是北京时间，不是 UTC 时间
                let naive = chrono::NaiveDateTime::parse_from_str(datetime, "%Y%m%dT%H%M%S")
                    .map_err(|e| format!("解析日期时间失败(本地): {} (原始数据: {})", e, datetime))?;
                // 使用本地时区（Local）解释时间，然后转换为 UTC 时间戳
                // 这样北京时间 09:00 会正确转换为 UTC 01:00（而非错误的 UTC 09:00）
                let local_datetime = naive.and_local_timezone(chrono::Local)
                    .single()
                    .ok_or_else(|| format!("无法将时间转换为本地时区: {}", datetime))?;
                Ok(local_datetime.timestamp())
            }
        }
    }

    /// 创建事件
    ///
    /// 使用 PUT 请求上传 iCal 数据创建新事件
    pub async fn create_event(&self, calendar_url: &str, event: &EventInfo) -> Result<String, String> {
        let auth_header = self.get_auth_header()?;

        let ical_data = self.generate_ical_event(event)?;
        info!("[CalDAV] 生成的 iCal 数据（每行展示）:");
        for line in ical_data.replace("\r\n", "\n").lines() {
            info!("  iCal> {:?}", line);
        }

        let event_url = format!("{}/{}.ics", calendar_url.trim_end_matches('/'), event.id);
        info!("[CalDAV] 创建事件 URL (PUT): {}", event_url);

        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, auth_header.clone());
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("text/calendar; charset=utf-8"));

        let response = self
            .client
            .put(&event_url)
            .headers(headers)
            .body(ical_data.clone())
            .send()
            .await
            .map_err(|e| format!("创建事件请求失败: {}", e))?;

        let status = response.status();

        // 若 PUT 返回 409，降级尝试 POST 到日历集合 URL
        if status == 409 {
            info!("[CalDAV] PUT 返回 409，降级尝试 POST 到日历集合 URL: {}", calendar_url);
            let mut post_headers = HeaderMap::new();
            post_headers.insert(AUTHORIZATION, auth_header);
            post_headers.insert(CONTENT_TYPE, HeaderValue::from_static("text/calendar; charset=utf-8"));

            let post_response = self
                .client
                .post(calendar_url)
                .headers(post_headers)
                .body(ical_data)
                .send()
                .await
                .map_err(|e| format!("POST 创建事件请求失败: {}", e))?;

            let post_status = post_response.status();
            let post_headers_str = format!("{:?}", post_response.headers());
            if !post_status.is_success() {
                let body = post_response.text().await.unwrap_or_default();
                error!("[CalDAV] POST 创建事件也失败: {} - 响应头: {} - 响应体: {}", post_status, post_headers_str, body);
                return Err(format!("创建事件失败: PUT 409, POST {} - {}", post_status, body));
            }
            // POST 成功，从响应头 Location 获取事件 URL
            let location = post_response.headers()
                .get("location")
                .and_then(|v| v.to_str().ok())
                .unwrap_or(&event_url)
                .to_string();
            info!("[CalDAV] POST 创建事件成功, location: {}", location);
            return Ok(location);
        }

        let resp_headers = format!("{:?}", response.headers());
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            error!("[CalDAV] 创建事件失败: {} - 响应头: {} - 响应体: {}", status, resp_headers, body);
            return Err(format!("创建事件失败: {} - {}", status, body));
        }

        info!("[CalDAV] 事件创建成功: {}", event_url);
        Ok(event_url)
    }

    /// 生成 iCal 事件数据
    /// 生成 iCal 事件数据
    ///
    /// # 参数
    /// - `event`: 事件信息，id 字段存储的是事件 URL 或 UID
    ///
    /// # 注意
    /// - 如果 event.id 是 URL，会自动提取最后一部分作为 UID
    /// - 如果 event.id 不是 URL，直接作为 UID 使用
    fn generate_ical_event(&self, event: &EventInfo) -> Result<String, String> {
        let dtstamp = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();

        let start_dt = Utc.timestamp_opt(event.start_time, 0).single()
            .ok_or_else(|| "无效的开始时间戳".to_string())?;
        let end_dt = Utc.timestamp_opt(event.end_time, 0).single()
            .ok_or_else(|| "无效的结束时间戳".to_string())?;

        let (dtstart, dtend) = if event.all_day {
            (
                format!("DTSTART;VALUE=DATE:{}", start_dt.format("%Y%m%d")),
                format!("DTEND;VALUE=DATE:{}", end_dt.format("%Y%m%d")),
            )
        } else {
            (
                format!("DTSTART:{}", start_dt.format("%Y%m%dT%H%M%SZ")),
                format!("DTEND:{}", end_dt.format("%Y%m%dT%H%M%SZ")),
            )
        };

        // 从 URL 中提取 UID（如果 id 是 URL 格式）
        // 例如：https://.../primary/eXNOSm9qdVZvdmZZTHQ4TzJ3cCtPdz09 -> eXNOSm9qdVZvdmZZTHQ4TzJ3cCtPdz09
        let uid = if event.id.starts_with("http") {
            event.id.rsplit('/').next().unwrap_or(&event.id).to_string()
        } else {
            event.id.clone()
        };

        // 注意：iCal 格式要求每行不能有前导空格，使用独立的 push_str 避免 format! 续行引入空格
        let mut ical = String::new();
        ical.push_str("BEGIN:VCALENDAR\r\n");
        ical.push_str("VERSION:2.0\r\n");
        ical.push_str("CALSCALE:GREGORIAN\r\n");
        ical.push_str("PRODID:-//SmartRiverCalendar//CalDAV Client//CN\r\n");
        ical.push_str("BEGIN:VEVENT\r\n");
        ical.push_str(&format!("UID:{}\r\n", uid));
        ical.push_str(&format!("DTSTAMP:{}\r\n", dtstamp));
        ical.push_str(&format!("{}\r\n", dtstart));
        ical.push_str(&format!("{}\r\n", dtend));
        ical.push_str(&format!("SUMMARY:{}\r\n", event.title));

        // 只有 description 非空时才添加（空值会让部分 CalDAV 服务器返回 409）
        if let Some(ref desc) = event.description {
            if !desc.is_empty() {
                ical.push_str(&format!("DESCRIPTION:{}\r\n", desc.replace('\n', "\\n")));
            }
        }

        // 只有 location 非空时才添加
        if let Some(ref loc) = event.location {
            if !loc.is_empty() {
                ical.push_str(&format!("LOCATION:{}\r\n", loc));
            }
        }

        ical.push_str("END:VEVENT\r\n");
        ical.push_str("END:VCALENDAR\r\n");

        Ok(ical)
    }

    /// 更新事件
    ///
    /// 使用 PUT 请求更新现有事件
    /// 
    /// 策略：
    /// 1. 先 GET 获取原始事件数据
    /// 2. 在原始数据基础上修改用户指定的字段
    /// 3. PUT 更新回服务器
    /// 
    /// 这样可以保留服务器生成的属性（如 ORGANIZER, ATTENDEE, VALARM 等）
    pub async fn update_event(&self, event_url: &str, event: &EventInfo) -> Result<(), String> {
        info!("[CalDAV] ========== 更新事件开始 ==========");
        info!("[CalDAV] 更新事件 URL: {}", event_url);

        // 步骤 1: GET 获取当前事件数据
        info!("[CalDAV] 步骤1: GET 获取当前事件数据...");
        let get_response = self
            .client
            .get(event_url)
            .header(AUTHORIZATION, self.get_auth_header()?)
            .send()
            .await
            .map_err(|e| format!("GET 事件失败: {}", e))?;
        
        let get_status = get_response.status();
        if !get_status.is_success() {
            return Err(format!("获取原始事件失败: {}", get_status));
        }

        let original_ical = get_response.text().await.map_err(|e| format!("读取 GET 响应失败: {}", e))?;
        info!("[CalDAV] 原始事件数据 (前 300 字符):");
        let preview = if original_ical.len() > 300 { &original_ical[..300] } else { &original_ical };
        for line in preview.replace("\r\n", "\n").lines() {
            info!("  ORIG> {:?}", line);
        }

        // 步骤 2: 在原始数据基础上修改
        let updated_ical = self.update_ical_properties(&original_ical, event)?;
        
        info!("[CalDAV] 步骤2: 修改后的 iCal 数据:");
        for line in updated_ical.replace("\r\n", "\n").lines() {
            info!("  MOD> {:?}", line);
        }

        // 步骤 3: PUT 更新
        info!("[CalDAV] 步骤3: PUT 更新事件...");
        let auth_header = self.get_auth_header()?;
        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, auth_header);
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("text/calendar; charset=utf-8"));
        headers.insert("If-Match", HeaderValue::from_static("*"));

        let response = self
            .client
            .put(event_url)
            .headers(headers)
            .body(updated_ical.clone())
            .send()
            .await
            .map_err(|e| format!("更新事件失败: {}", e))?;

        let status = response.status();
        info!("[CalDAV] PUT 响应状态: {}", status);

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            error!("[CalDAV] 更新事件失败，响应体: {}", body);
            return Err(format!("更新事件失败: {} - {}", status, body));
        }

        info!("[CalDAV] ========== 更新事件成功 ==========");
        Ok(())
    }

    /// 在原始 iCal 数据基础上更新指定属性
    ///
    /// 保留原始事件的所有属性（ORGANIZER, ATTENDEE, VALARM 等），
    /// 只修改用户指定的字段（SUMMARY, DESCRIPTION, DTSTART, DTEND, LOCATION）
    fn update_ical_properties(&self, original: &str, event: &EventInfo) -> Result<String, String> {
        let mut lines: Vec<String> = original.lines().map(|s| s.to_string()).collect();
        
        // 需要更新的字段
        let update_summary = true;
        let update_description = event.description.is_some();
        let update_dtstart = true;
        let update_dtend = true;
        let update_location = event.location.is_some();
        
        // 时间格式转换
        let start_dt = Utc.timestamp_opt(event.start_time, 0).single()
            .ok_or_else(|| "无效的开始时间戳".to_string())?;
        let end_dt = Utc.timestamp_opt(event.end_time, 0).single()
            .ok_or_else(|| "无效的结束时间戳".to_string())?;
        
        let new_dtstart = if event.all_day {
            format!("DTSTART;VALUE=DATE:{}", start_dt.format("%Y%m%d"))
        } else {
            format!("DTSTART:{}", start_dt.format("%Y%m%dT%H%M%SZ"))
        };
        let new_dtend = if event.all_day {
            format!("DTEND;VALUE=DATE:{}", end_dt.format("%Y%m%d"))
        } else {
            format!("DTEND:{}", end_dt.format("%Y%m%dT%H%M%SZ"))
        };
        
        // 更新 DTSTAMP 为当前时间
        let new_dtstamp = format!("DTSTAMP:{}", Utc::now().format("%Y%m%dT%H%M%SZ"));

        // 遍历并更新行
        for i in 0..lines.len() {
            let line = &lines[i];
            
            if line.starts_with("SUMMARY:") && update_summary {
                lines[i] = format!("SUMMARY:{}", event.title);
            } else if line.starts_with("DESCRIPTION:") && update_description {
                if let Some(ref desc) = event.description {
                    lines[i] = format!("DESCRIPTION:{}", desc.replace('\n', "\\n"));
                }
            } else if line.starts_with("DTSTART") && update_dtstart {
                lines[i] = new_dtstart.clone();
            } else if line.starts_with("DTEND") && update_dtend {
                lines[i] = new_dtend.clone();
            } else if line.starts_with("LOCATION:") && update_location {
                if let Some(ref loc) = event.location {
                    lines[i] = format!("LOCATION:{}", loc);
                }
            } else if line.starts_with("DTSTAMP:") {
                lines[i] = new_dtstamp.clone();
            }
        }

        // 重新组合为 iCal 格式
        Ok(lines.join("\r\n"))
    }

    /// 删除事件
    ///
    /// 使用 DELETE 请求删除事件
    pub async fn delete_event(&self, event_url: &str) -> Result<(), String> {
        let auth_header = self.get_auth_header()?;

        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, auth_header);

        let response = self
            .client
            .delete(event_url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("删除事件失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("删除事件失败: {}", response.status()));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cal_dav_client_new() {
        let client = CalDavClient::new(
            "https://caldav.example.com".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        assert_eq!(client.server_url, "https://caldav.example.com");
        assert_eq!(client.username, "user");
        assert_eq!(client.password, "pass");
    }

    #[test]
    fn test_parse_principal_url() {
        let client = CalDavClient::new(
            "https://caldav.example.com".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let xml = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:">
    <D:response>
        <D:href>/</D:href>
        <D:propstat>
            <D:prop>
                <D:current-user-principal>
                    <D:href>/principals/users/john/</D:href>
                </D:current-user-principal>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
    </D:response>
</D:multistatus>"#;

        let result = client.parse_principal_url(xml);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "https://caldav.example.com/principals/users/john/");
    }

    #[test]
    fn test_parse_principal_url_absolute() {
        let client = CalDavClient::new(
            "https://caldav.example.com".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let xml = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:">
    <D:response>
        <D:href>/</D:href>
        <D:propstat>
            <D:prop>
                <D:current-user-principal>
                    <D:href>https://other.example.com/principals/users/jane/</D:href>
                </D:current-user-principal>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
    </D:response>
</D:multistatus>"#;

        let result = client.parse_principal_url(xml);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "https://other.example.com/principals/users/jane/");
    }

    #[test]
    fn test_parse_calendars() {
        let client = CalDavClient::new(
            "https://caldav.example.com".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let xml = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/">
    <D:response>
        <D:href>/calendars/user/personal/</D:href>
        <D:propstat>
            <D:prop>
                <D:resourcetype>
                    <D:collection/>
                    <C:calendar/>
                </D:resourcetype>
                <D:displayname>个人日历</D:displayname>
                <CS:calendar-color>#FF5733</CS:calendar-color>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
    </D:response>
    <D:response>
        <D:href>/calendars/user/work/</D:href>
        <D:propstat>
            <D:prop>
                <D:resourcetype>
                    <D:collection/>
                    <C:calendar/>
                </D:resourcetype>
                <D:displayname>工作日历</D:displayname>
                <CS:calendar-color>#3366FF</CS:calendar-color>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
    </D:response>
    <D:response>
        <D:href>/calendars/user/not-a-calendar/</D:href>
        <D:propstat>
            <D:prop>
                <D:resourcetype>
                    <D:collection/>
                </D:resourcetype>
                <D:displayname>普通集合</D:displayname>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
    </D:response>
</D:multistatus>"#;

        let result = client.parse_calendars(xml, "https://caldav.example.com/calendars/user/");
        assert!(result.is_ok());

        let calendars = result.unwrap();
        assert_eq!(calendars.len(), 2);

        assert_eq!(calendars[0].id, "personal");
        assert_eq!(calendars[0].name, "个人日历");
        assert_eq!(calendars[0].color, Some("#FF5733".to_string()));
        assert_eq!(calendars[0].url, "https://caldav.example.com/calendars/user/personal/");

        assert_eq!(calendars[1].id, "work");
        assert_eq!(calendars[1].name, "工作日历");
        assert_eq!(calendars[1].color, Some("#3366FF".to_string()));
        assert_eq!(calendars[1].url, "https://caldav.example.com/calendars/user/work/");
    }

    #[test]
    fn test_parse_calendars_no_name() {
        let client = CalDavClient::new(
            "https://caldav.example.com".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let xml = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
    <D:response>
        <D:href>/calendars/user/default/</D:href>
        <D:propstat>
            <D:prop>
                <D:resourcetype>
                    <D:collection/>
                    <C:calendar/>
                </D:resourcetype>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
    </D:response>
</D:multistatus>"#;

        let result = client.parse_calendars(xml, "https://caldav.example.com/calendars/user/");
        assert!(result.is_ok());

        let calendars = result.unwrap();
        assert_eq!(calendars.len(), 1);
        assert_eq!(calendars[0].id, "default");
        assert_eq!(calendars[0].name, "default"); // 没有名称时使用 id
        assert!(calendars[0].color.is_none());
    }

    #[test]
    fn test_parse_calendar_home_set() {
        let client = CalDavClient::new(
            "https://caldav.example.com".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let xml = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
    <D:response>
        <D:href>/principals/users/john/</D:href>
        <D:propstat>
            <D:prop>
                <C:calendar-home-set>
                    <D:href>/calendars/user/john/</D:href>
                </C:calendar-home-set>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
    </D:response>
</D:multistatus>"#;

        let result = client.parse_calendar_home_set(xml);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "https://caldav.example.com/calendars/user/john/");
    }

    #[test]
    fn test_parse_events_response() {
        let client = CalDavClient::new(
            "https://caldav.example.com".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let xml = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
    <D:response>
        <D:href>/calendars/user/personal/event1.ics</D:href>
        <D:propstat>
            <D:prop>
                <C:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:event1@example.com
DTSTAMP:20240101T120000Z
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
SUMMARY:测试事件
DESCRIPTION:这是一个测试事件
LOCATION:会议室A
END:VEVENT
END:VCALENDAR</C:calendar-data>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
    </D:response>
</D:multistatus>"#;

        let result = client.parse_events_response(xml);
        assert!(result.is_ok());

        let events = result.unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].id, "event1@example.com");
        assert_eq!(events[0].title, "测试事件");
        assert_eq!(events[0].description, Some("这是一个测试事件".to_string()));
        assert_eq!(events[0].location, Some("会议室A".to_string()));
        assert!(!events[0].all_day);
    }

    #[test]
    fn test_parse_ical_event() {
        let client = CalDavClient::new(
            "https://caldav.example.com".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let ical_data = r#"BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test-event-123
DTSTAMP:20240101T120000Z
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
SUMMARY:测试事件标题
DESCRIPTION:测试事件描述
LOCATION:测试地点
END:VEVENT
END:VCALENDAR"#;

        let result = client.parse_ical_event(ical_data);
        assert!(result.is_ok());

        let event = result.unwrap();
        assert_eq!(event.id, "test-event-123");
        assert_eq!(event.title, "测试事件标题");
        assert_eq!(event.description, Some("测试事件描述".to_string()));
        assert_eq!(event.location, Some("测试地点".to_string()));
        assert!(!event.all_day);
    }

    #[test]
    fn test_parse_ical_all_day_event() {
        let client = CalDavClient::new(
            "https://caldav.example.com".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let ical_data = r#"BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:all-day-event
DTSTAMP:20240101T120000Z
DTSTART;VALUE=DATE:20240115
DTEND;VALUE=DATE:20240116
SUMMARY:全天事件
END:VEVENT
END:VCALENDAR"#;

        let result = client.parse_ical_event(ical_data);
        assert!(result.is_ok());

        let event = result.unwrap();
        assert_eq!(event.id, "all-day-event");
        assert_eq!(event.title, "全天事件");
        assert!(event.all_day);
    }

    #[test]
    fn test_generate_ical_event() {
        let client = CalDavClient::new(
            "https://caldav.example.com".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let event = EventInfo {
            id: "test-event-456".to_string(),
            title: "生成的事件".to_string(),
            description: Some("事件描述".to_string()),
            start_time: 1705312800, // 2024-01-15 10:00:00 UTC
            end_time: 1705316400,   // 2024-01-15 11:00:00 UTC
            all_day: false,
            location: Some("会议室B".to_string()),
        };

        let result = client.generate_ical_event(&event);
        assert!(result.is_ok());

        let ical = result.unwrap();
        assert!(ical.contains("BEGIN:VCALENDAR"));
        assert!(ical.contains("END:VCALENDAR"));
        assert!(ical.contains("BEGIN:VEVENT"));
        assert!(ical.contains("END:VEVENT"));
        assert!(ical.contains("UID:test-event-456"));
        assert!(ical.contains("SUMMARY:生成的事件"));
        assert!(ical.contains("DESCRIPTION:事件描述"));
        assert!(ical.contains("LOCATION:会议室B"));
    }

    #[test]
    fn test_generate_ical_all_day_event() {
        let client = CalDavClient::new(
            "https://caldav.example.com".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let event = EventInfo {
            id: "all-day-456".to_string(),
            title: "全天事件".to_string(),
            description: None,
            start_time: 1705276800, // 2024-01-15 00:00:00 UTC
            end_time: 1705363200,   // 2024-01-16 00:00:00 UTC
            all_day: true,
            location: None,
        };

        let result = client.generate_ical_event(&event);
        assert!(result.is_ok());

        let ical = result.unwrap();
        assert!(ical.contains("DTSTART;VALUE=DATE:20240115"));
        assert!(ical.contains("DTEND;VALUE=DATE:20240116"));
    }

    #[test]
    fn test_parse_ical_datetime() {
        let client = CalDavClient::new(
            "https://caldav.example.com".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        // 测试带时区的格式
        let result = client.parse_ical_datetime("20240115T100000Z", false);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1705312800);

        // 测试全天事件格式
        let result = client.parse_ical_datetime("20240115", true);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1705276800);
    }

    // ========== 飞书 CalDAV 兼容性测试 ==========

    #[test]
    fn test_server_url_normalization() {
        // 测试不带协议的 URL
        let client = CalDavClient::new(
            "caldav.feishu.cn".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );
        assert_eq!(client.server_url, "https://caldav.feishu.cn");

        // 测试带 https 的 URL
        let client = CalDavClient::new(
            "https://caldav.feishu.cn".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );
        assert_eq!(client.server_url, "https://caldav.feishu.cn");

        // 测试带 http 的 URL
        let client = CalDavClient::new(
            "http://caldav.example.com".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );
        assert_eq!(client.server_url, "http://caldav.example.com");
    }

    #[test]
    fn test_parse_principal_url_feishu_format() {
        // 测试飞书风格的 principal URL（使用 /dav/users/ 路径）
        let client = CalDavClient::new(
            "https://caldav.feishu.cn".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let xml = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:">
    <D:response>
        <D:href>/</D:href>
        <D:propstat>
            <D:prop>
                <D:current-user-principal>
                    <D:href>/dav/users/ou_xxxxx/</D:href>
                </D:current-user-principal>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
    </D:response>
</D:multistatus>"#;

        let result = client.parse_principal_url(xml);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "https://caldav.feishu.cn/dav/users/ou_xxxxx/");
    }

    #[test]
    fn test_parse_principal_url_fallback_relative_path() {
        // 测试当没有 current-user-principal 标签时，使用第一个相对路径作为 fallback
        let client = CalDavClient::new(
            "https://caldav.feishu.cn".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        // 模拟某些服务器可能返回的格式（没有 current-user-principal 包装）
        let xml = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:">
    <D:response>
        <D:href>/dav/users/ou_xxxxx/</D:href>
        <D:propstat>
            <D:prop>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
    </D:response>
</D:multistatus>"#;

        let result = client.parse_principal_url(xml);
        assert!(result.is_ok());
        // 应该使用 fallback 机制
        assert_eq!(result.unwrap(), "https://caldav.feishu.cn/dav/users/ou_xxxxx/");
    }

    #[test]
    fn test_parse_calendar_home_set_feishu_format() {
        // 测试飞书风格的 calendar-home-set
        let client = CalDavClient::new(
            "https://caldav.feishu.cn".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let xml = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
    <D:response>
        <D:href>/dav/users/ou_xxxxx/</D:href>
        <D:propstat>
            <D:prop>
                <C:calendar-home-set>
                    <D:href>/dav/users/ou_xxxxx/calendars/</D:href>
                </C:calendar-home-set>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
    </D:response>
</D:multistatus>"#;

        let result = client.parse_calendar_home_set(xml);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "https://caldav.feishu.cn/dav/users/ou_xxxxx/calendars/");
    }

    #[test]
    fn test_parse_calendar_home_set_fallback() {
        // 测试 calendar-home-set 的 fallback 机制
        // 场景：响应中第一个 href 是响应标识（通常是 principal URL），第二个在 calendar-home-set 内
        let client = CalDavClient::new(
            "https://caldav.feishu.cn".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        // 模拟真实场景：响应中有多个 href，需要正确识别 calendar-home-set 内的那个
        let xml = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
    <D:response>
        <D:href>/dav/users/ou_xxxxx/</D:href>
        <D:propstat>
            <D:prop>
                <C:calendar-home-set>
                    <D:href>/dav/users/ou_xxxxx/calendars/</D:href>
                </C:calendar-home-set>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
    </D:response>
</D:multistatus>"#;

        let result = client.parse_calendar_home_set(xml);
        assert!(result.is_ok());
        // 应该正确识别 calendar-home-set 内的 href，而不是第一个 href
        assert_eq!(result.unwrap(), "https://caldav.feishu.cn/dav/users/ou_xxxxx/calendars/");
    }

    // ========== 飞书 CalDAV 事件测试 ==========

    /// 测试解析飞书格式的事件响应
    ///
    /// 飞书的 REPORT 响应格式可能包含特定的命名空间和结构
    #[test]
    fn test_parse_events_response_feishu() {
        let client = CalDavClient::new(
            "https://caldav.feishu.cn".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        // 模拟飞书 CalDAV 的 REPORT 响应格式
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <response>
    <href>/dav/users/ou_xxxxx/calendars/calendar-id/event-001.ics</href>
    <propstat>
      <prop>
        <C:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//FeiShu//CalDAV//CN
BEGIN:VEVENT
UID:event-001@feishu.cn
DTSTAMP:20240315T080000Z
DTSTART:20240320T090000Z
DTEND:20240320T100000Z
SUMMARY:飞书日历事件
DESCRIPTION:这是飞书日历的事件描述
LOCATION:飞书会议室
END:VEVENT
END:VCALENDAR</C:calendar-data>
        <getetag>"abc123"</getetag>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
  <response>
    <href>/dav/users/ou_xxxxx/calendars/calendar-id/event-002.ics</href>
    <propstat>
      <prop>
        <C:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//FeiShu//CalDAV//CN
BEGIN:VEVENT
UID:event-002@feishu.cn
DTSTAMP:20240315T080000Z
DTSTART;VALUE=DATE:20240321
DTEND;VALUE=DATE:20240322
SUMMARY:飞书全天事件
END:VEVENT
END:VCALENDAR</C:calendar-data>
        <getetag>"def456"</getetag>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>"#;

        let result = client.parse_events_response(xml);
        assert!(result.is_ok());

        let events = result.unwrap();
        assert_eq!(events.len(), 2);

        // 验证第一个事件（普通事件）
        assert_eq!(events[0].id, "event-001@feishu.cn");
        assert_eq!(events[0].title, "飞书日历事件");
        assert_eq!(events[0].description, Some("这是飞书日历的事件描述".to_string()));
        assert_eq!(events[0].location, Some("飞书会议室".to_string()));
        assert!(!events[0].all_day);
        // 2024-03-20 09:00:00 UTC = 1710925200
        assert_eq!(events[0].start_time, 1710925200);
        // 2024-03-20 10:00:00 UTC = 1710928800
        assert_eq!(events[0].end_time, 1710928800);

        // 验证第二个事件（全天事件）
        assert_eq!(events[1].id, "event-002@feishu.cn");
        assert_eq!(events[1].title, "飞书全天事件");
        assert!(events[1].all_day);
        // 2024-03-21 00:00:00 UTC = 1710979200
        assert_eq!(events[1].start_time, 1710979200);
        // 2024-03-22 00:00:00 UTC = 1711065600
        assert_eq!(events[1].end_time, 1711065600);
    }

    /// 测试带时区参数的 iCal 事件解析
    ///
    /// 某些服务器可能返回带 TZID 参数的日期时间
    #[test]
    fn test_parse_ical_event_with_timezone() {
        let client = CalDavClient::new(
            "https://caldav.feishu.cn".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        // 注意：当前实现不处理 TZID 参数，只解析纯 UTC 时间格式
        // 这个测试验证 Z 后缀的 UTC 时间格式能正确解析
        let ical_data = r#"BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//CN
BEGIN:VEVENT
UID:tz-event-001
DTSTAMP:20240315T080000Z
DTSTART:20240320T090000Z
DTEND:20240320T100000Z
SUMMARY:带时区的事件
DESCRIPTION:UTC 时间格式事件
LOCATION:上海办公室
END:VEVENT
END:VCALENDAR"#;

        let result = client.parse_ical_event(ical_data);
        assert!(result.is_ok());

        let event = result.unwrap();
        assert_eq!(event.id, "tz-event-001");
        assert_eq!(event.title, "带时区的事件");
        assert_eq!(event.description, Some("UTC 时间格式事件".to_string()));
        assert_eq!(event.location, Some("上海办公室".to_string()));
        assert!(!event.all_day);
        // 2024-03-20 09:00:00 UTC
        assert_eq!(event.start_time, 1710925200);
        // 2024-03-20 10:00:00 UTC
        assert_eq!(event.end_time, 1710928800);
    }

    /// 测试多行描述的 iCal 事件解析
    ///
    /// iCal 格式中多行文本使用换行符，需要正确处理
    #[test]
    fn test_parse_ical_event_multiline_description() {
        let client = CalDavClient::new(
            "https://caldav.feishu.cn".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        // iCal 多行描述使用 \n 转义（在原始数据中可能是 \\n）
        let ical_data = r#"BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//CN
BEGIN:VEVENT
UID:multiline-event-001
DTSTAMP:20240315T080000Z
DTSTART:20240320T090000Z
DTEND:20240320T100000Z
SUMMARY:多行描述事件
DESCRIPTION:第一行描述\n第二行描述\n第三行描述
LOCATION:会议室
END:VEVENT
END:VCALENDAR"#;

        let result = client.parse_ical_event(ical_data);
        assert!(result.is_ok());

        let event = result.unwrap();
        assert_eq!(event.id, "multiline-event-001");
        assert_eq!(event.title, "多行描述事件");
        // 验证描述内容（包含转义的换行符）
        let desc = event.description.as_ref().unwrap();
        assert!(desc.contains("第一行描述"));
        assert!(desc.contains("第二行描述"));
        assert!(desc.contains("第三行描述"));
    }

    /// 测试带时区的日期时间解析
    ///
    /// 验证不同格式的日期时间字符串能正确转换为时间戳
    #[test]
    fn test_parse_ical_datetime_with_timezone() {
        let client = CalDavClient::new(
            "https://caldav.feishu.cn".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        // 时间戳基准: 2024-01-01 00:00:00 UTC = 1704067200
        // 2024-03-20 00:00:00 UTC = 1704067200 + 79天 * 86400 = 1710892800
        // (从1月1日到3月20日: 1月31天 + 2月29天(闰年) + 3月1-19日19天 = 79天)

        // 测试 UTC 时间格式 (带 Z 后缀)
        // 2024-03-20 09:00:00 UTC = 1710892800 + 32400 = 1710925200
        let result = client.parse_ical_datetime("20240320T090000Z", false);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1710925200);

        // 测试不带时区的时间格式 (不带 Z 后缀)
        // 根据 iCal 规范，不带 Z 的时间是"浮动时间"，应解释为本地时区
        // 例如：在 UTC+8 时区，本地 09:00 = UTC 01:00
        let result = client.parse_ical_datetime("20240320T090000", false);
        assert!(result.is_ok());
        let local_timestamp = result.unwrap();
        
        // 获取本地时区偏移（秒）
        // local_minus_utc 返回正值表示本地时间比 UTC 快（如 UTC+8 返回 28800）
        let local_offset = chrono::Local::now().offset().local_minus_utc();
        
        // 本地时间 09:00 对应的 UTC 时间：
        // UTC 时间 = 本地时间 - 时区偏移
        // UTC 时间戳 = 本地时间戳（这里 local_timestamp 已经是 UTC 时间戳）
        // 
        // 例如 UTC+8：
        // 本地 09:00 -> UTC 01:00（09:00 - 8小时）
        // UTC 01:00 时间戳 = 1710892800 + 3600 = 1710896400
        // 
        // 验证：UTC 09:00 时间戳 - 本地时间戳 应该等于 时区偏移
        // 因为：本地 09:00 -> UTC (09-offset/3600)
        // UTC 时间戳 = 本地时间戳（解析结果）
        // UTC 09:00 时间戳 = 本地时间戳 + offset
        // 所以：本地时间戳 = UTC 09:00 时间戳 - offset
        let utc_0900_timestamp = 1710925200; // UTC 09:00 的时间戳
        let expected_local_timestamp = utc_0900_timestamp - local_offset as i64;
        
        // 允许 1 秒误差
        assert!(
            (local_timestamp - expected_local_timestamp).abs() <= 1,
            "本地时间戳 {} 应该接近 {} (UTC 09:00 时间戳 {} - 时区偏移 {}秒)",
            local_timestamp, expected_local_timestamp, utc_0900_timestamp, local_offset
        );

        // 测试全天事件日期格式
        // 2024-03-20 00:00:00 UTC
        let result = client.parse_ical_datetime("20240320", true);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1710892800);

        // 测试边界情况：午夜时间 (UTC)
        let result = client.parse_ical_datetime("20240320T000000Z", false);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1710892800);

        // 测试边界情况：午夜前一刻 (UTC)
        // 2024-03-20 23:59:59 UTC = 1710892800 + 86399 = 1710979199
        let result = client.parse_ical_datetime("20240320T235959Z", false);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1710979199);
    }

    /// 测试解析不含任何事件的响应
    #[test]
    fn test_parse_events_response_empty() {
        let client = CalDavClient::new(
            "https://caldav.feishu.cn".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        // 空响应（没有事件）
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
</multistatus>"#;

        let result = client.parse_events_response(xml);
        assert!(result.is_ok());
        let events = result.unwrap();
        assert!(events.is_empty());
    }

    /// 测试解析包含 CDATA 的日历数据
    #[test]
    fn test_parse_events_response_with_cdata() {
        let client = CalDavClient::new(
            "https://caldav.feishu.cn".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        // 某些服务器可能使用 CDATA 包装日历数据
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <response>
    <href>/calendars/user/test/event.ics</href>
    <propstat>
      <prop>
        <C:calendar-data><![CDATA[BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//CN
BEGIN:VEVENT
UID:cdata-event
DTSTAMP:20240315T080000Z
DTSTART:20240320T090000Z
DTEND:20240320T100000Z
SUMMARY:CDATA 格式事件
END:VEVENT
END:VCALENDAR]]></C:calendar-data>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>"#;

        let result = client.parse_events_response(xml);
        assert!(result.is_ok());
        let events = result.unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].id, "cdata-event");
        assert_eq!(events[0].title, "CDATA 格式事件");
    }

    /// 测试解析飞书格式的事件引用（calendar-data 返回 404）
    ///
    /// 飞书 CalDAV 服务器在 REPORT 响应中返回事件的 href 和 etag，
    /// 但 calendar-data 元素返回 404 Not Found，需要单独获取
    #[test]
    fn test_parse_events_refs_feishu_format() {
        let client = CalDavClient::new(
            "https://caldav.feishu.cn".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        // 飞书返回的实际 XML 格式（完整复制自真实响应）
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?><D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/" xmlns:ICAL="http://apple.com/ns/ical/" xmlns:ME="http://me.com/_namespace/"><D:response><D:href>/u_xptl9894/66DEC3A3-D95F-4002-66DE-C3A3D95F4002/c3c3bc79-2df4-4a84-b28d-66d203692600.ics</D:href><D:propstat><D:prop><D:getetag>1774681140736792</D:getetag></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat><D:propstat><D:prop><C:calendar-data/></D:prop><D:status>HTTP/1.1 404 Not Found</D:status></D:propstat></D:response><D:response><D:href>/u_xptl9894/66DEC3A3-D95F-4002-66DE-C3A3D95F4002/2ed4c701-dd30-4c13-8843-f889c698f022.ics</D:href><D:propstat><D:prop><D:getetag>1774684439909022</D:getetag></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat><D:propstat><D:prop><C:calendar-data/></D:prop><D:status>HTTP/1.1 404 Not Found</D:status></D:propstat></D:response></D:multistatus>"#;

        let result = client.parse_events_refs(xml, "https://caldav.feishu.cn/u_xptl9894/66DEC3A3-D95F-4002-66DE-C3A3D95F4002/");
        assert!(result.is_ok());

        let event_refs = result.unwrap();
        assert_eq!(event_refs.len(), 2, "应该解析到 2 个事件引用");

        // 验证第一个事件引用
        assert_eq!(event_refs[0].href, "https://caldav.feishu.cn/u_xptl9894/66DEC3A3-D95F-4002-66DE-C3A3D95F4002/c3c3bc79-2df4-4a84-b28d-66d203692600.ics");
        assert_eq!(event_refs[0].etag, Some("1774681140736792".to_string()));
        assert!(event_refs[0].ical_data.is_none(), "calendar-data 返回 404，应该没有 iCal 数据");

        // 验证第二个事件引用
        assert_eq!(event_refs[1].href, "https://caldav.feishu.cn/u_xptl9894/66DEC3A3-D95F-4002-66DE-C3A3D95F4002/2ed4c701-dd30-4c13-8843-f889c698f022.ics");
        assert_eq!(event_refs[1].etag, Some("1774684439909022".to_string()));
        assert!(event_refs[1].ical_data.is_none(), "calendar-data 返回 404，应该没有 iCal 数据");
    }
}
