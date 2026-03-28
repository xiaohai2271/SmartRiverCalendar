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
use quick_xml::Reader;
use chrono::{TimeZone, Utc};
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

        Self {
            server_url,
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
    pub async fn connect(&self) -> Result<(), String> {
        info!("[CalDAV Client] 尝试连接到: {}", self.server_url);

        let auth_header = self.get_auth_header()?;

        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, auth_header);

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
                if !dav_value.contains("1") && !dav_value.contains("2") {
                    error!("[CalDAV Client] 服务器不支持 DAV 协议");
                    return Err("服务器不支持 DAV 协议".to_string());
                }
            }
            None => {
                error!("[CalDAV Client] 服务器未返回 DAV 头部");
                return Err("服务器未返回 DAV 头部".to_string());
            }
        }

        info!("[CalDAV Client] 连接验证成功");
        Ok(())
    }

    /// 发现用户主路径
    ///
    /// 发送 PROPFIND 请求获取当前用户的 principal URL
    pub async fn discover_principal(&self) -> Result<String, String> {
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

        let response = self
            .client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &self.server_url)
            .headers(headers)
            .body(body)
            .send()
            .await
            .map_err(|e| format!("发送 PROPFIND 请求失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("PROPFIND 请求失败: {}", response.status()));
        }

        let response_text = response
            .text()
            .await
            .map_err(|e| format!("读取响应失败: {}", e))?;

        self.parse_principal_url(&response_text)
    }

    /// 解析 principal URL
    fn parse_principal_url(&self, xml: &str) -> Result<String, String> {
        let mut reader = Reader::from_str(xml);
        reader.config_mut().trim_text(true);

        let mut in_href = false;
        let mut principal_url = String::new();

        loop {
            match reader.read_event() {
                Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                    let local_name = e.local_name();
                    if local_name.as_ref() == b"href" {
                        in_href = true;
                    }
                }
                Ok(Event::Text(ref e)) => {
                    if in_href {
                        let text = e.unescape().map_err(|e| format!("解析文本失败: {}", e))?;
                        // 匹配多种格式：/principals/、/principal/ 或 /username/
                        if text.contains("/principals/") || text.contains("/principal")
                            || (text.starts_with('/') && !text.starts_with("//")) {
                            principal_url = text.to_string();
                        }
                    }
                }
                Ok(Event::End(ref e)) => {
                    if e.local_name().as_ref() == b"href" {
                        in_href = false;
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(format!("解析 XML 失败: {}", e)),
                _ => {}
            }
        }

        if principal_url.is_empty() {
            return Err("未找到 principal URL".to_string());
        }

        if principal_url.starts_with('/') {
            let base = self.server_url.trim_end_matches('/');
            Ok(format!("{}{}", base, principal_url))
        } else {
            Ok(principal_url)
        }
    }

    /// 获取日历主路径
    ///
    /// 从 principal URL 获取日历主路径 (calendar-home-set)
    async fn get_calendar_home_set(&self, principal_url: &str) -> Result<String, String> {
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

        let response = self
            .client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), principal_url)
            .headers(headers)
            .body(body)
            .send()
            .await
            .map_err(|e| format!("获取日历主路径失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("获取日历主路径失败: {}", response.status()));
        }

        let response_text = response
            .text()
            .await
            .map_err(|e| format!("读取响应失败: {}", e))?;

        self.parse_calendar_home_set(&response_text)
    }

    /// 解析日历主路径
    fn parse_calendar_home_set(&self, xml: &str) -> Result<String, String> {
        let mut reader = Reader::from_str(xml);
        reader.config_mut().trim_text(true);

        let mut in_href = false;
        let mut calendar_home = String::new();

        loop {
            match reader.read_event() {
                Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                    if e.local_name().as_ref() == b"href" {
                        in_href = true;
                    }
                }
                Ok(Event::Text(ref e)) => {
                    if in_href {
                        let text = e.unescape().map_err(|e| format!("解析文本失败: {}", e))?;
                        calendar_home = text.to_string();
                    }
                }
                Ok(Event::End(ref e)) => {
                    if e.local_name().as_ref() == b"href" {
                        in_href = false;
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(format!("解析 XML 失败: {}", e)),
                _ => {}
            }
        }

        if calendar_home.is_empty() {
            return Err("未找到日历主路径".to_string());
        }

        if calendar_home.starts_with('/') {
            let base = self.server_url.trim_end_matches('/');
            Ok(format!("{}{}", base, calendar_home))
        } else {
            Ok(calendar_home)
        }
    }

    /// 列出所有可用日历
    ///
    /// 发送 PROPFIND 请求获取日历列表
    pub async fn list_calendars(&self) -> Result<Vec<CalendarInfo>, String> {
        info!("[CalDAV Client] 开始列出日历");

        let principal_url = self.discover_principal().await?;
        info!("[CalDAV Client] principal_url: {}", principal_url);

        let calendar_home = self.get_calendar_home_set(&principal_url).await?;
        info!("[CalDAV Client] calendar_home: {}", calendar_home);

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
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &calendar_home)
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

        self.parse_calendars(&response_text, &calendar_home)
    }

    /// 解析日历列表
    fn parse_calendars(&self, xml: &str, base_url: &str) -> Result<Vec<CalendarInfo>, String> {
        let mut reader = Reader::from_str(xml);
        reader.config_mut().trim_text(true);

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

        loop {
            match reader.read_event() {
                Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                    let local_name = e.local_name();
                    match local_name.as_ref() {
                        b"href" => in_href = true,
                        b"displayname" => in_displayname = true,
                        b"calendar-color" => in_color = true,
                        b"resourcetype" => in_resourcetype = true,
                        b"current-user-privilege-set" => in_privilege_set = true,
                        b"calendar" => {
                            if in_resourcetype {
                                is_calendar = true;
                            }
                        }
                        // write 或 all 权限都视为有写权限
                        b"write" | b"write-content" | b"bind" => {
                            if in_privilege_set {
                                has_write = true;
                            }
                        }
                        _ => {}
                    }
                }
                Ok(Event::Text(ref e)) => {
                    let text = e.unescape().map_err(|e| format!("解析文本失败: {}", e))?;
                    if in_href {
                        current_href = text.to_string();
                    } else if in_displayname {
                        current_name = text.to_string();
                    } else if in_color {
                        let c = text.trim();
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

                                info!("[CalDAV] 发现日历: {} | URL: {} | 可写: {}", name, calendar_url, has_write);

                                calendars.push(CalendarInfo {
                                    id,
                                    name,
                                    color: current_color.clone(),
                                    url: calendar_url,
                                    // 服务器返回了权限信息且无写权限时标记为只读
                                    read_only: !has_write,
                                });
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
                Err(e) => return Err(format!("解析 XML 失败: {}", e)),
                _ => {}
            }
        }

        if calendars.is_empty() {
            info!("[CalDAV] 没有发现任何日历");
        }

        Ok(calendars)
    }

    /// 获取日历中的事件列表
    ///
    /// 使用 REPORT calendar-query 请求获取指定时间范围内的事件
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



        self.parse_events_response(&response_text)
    }

    /// 解析事件响应
    fn parse_events_response(&self, xml: &str) -> Result<Vec<EventInfo>, String> {
        let mut reader = Reader::from_str(xml);
        reader.config_mut().trim_text(true);

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
                                    // 调试：打印失败的 ical片段
                                    // debug!("[CalDAV] 失败的 iCal 内容: {}", current_ical);
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
    fn parse_ical_event(&self, ical_data: &str) -> Result<EventInfo, String> {
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

                if !id.is_empty() && !title.is_empty() {
                    events.push(EventInfo {
                        id,
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

    /// 解析 iCal 日期时间
    fn parse_ical_datetime(&self, datetime: &str, all_day: bool) -> Result<i64, String> {
        if all_day {
            // 全天事件格式: YYYYMMDD
            let date = chrono::NaiveDate::parse_from_str(datetime, "%Y%m%d")
                .map_err(|e| format!("解析日期失败: {}", e))?;
            let datetime = date.and_hms_opt(0, 0, 0)
                .ok_or_else(|| "创建日期时间失败".to_string())?;
            Ok(datetime.and_utc().timestamp())
        } else {
            // 带时间格式: YYYYMMDDTHHMMSSZ 或 YYYYMMDDTHHMMSS
            let res = if datetime.ends_with('Z') {
                chrono::NaiveDateTime::parse_from_str(datetime, "%Y%m%dT%H%M%SZ")
                    .map_err(|e| format!("解析日期时间失败(带Z): {} (原始数据: {})", e, datetime))?
            } else {
                chrono::NaiveDateTime::parse_from_str(datetime, "%Y%m%dT%H%M%S")
                    .map_err(|e| format!("解析日期时间失败(不带Z): {} (原始数据: {})", e, datetime))?
            };
            Ok(res.and_utc().timestamp())
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
    fn generate_ical_event(&self, event: &EventInfo) -> Result<String, String> {
        let start_dt = Utc.timestamp_opt(event.start_time, 0).single()
            .ok_or_else(|| "无效的开始时间戳".to_string())?;
        let end_dt = Utc.timestamp_opt(event.end_time, 0).single()
            .ok_or_else(|| "无效的结束时间戳".to_string())?;

        let dtstamp = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();

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

        // 注意：iCal 格式要求每行不能有前导空格，使用独立的 push_str 避免 format! 续行引入空格
        let mut ical = String::new();
        ical.push_str("BEGIN:VCALENDAR\r\n");
        ical.push_str("VERSION:2.0\r\n");
        ical.push_str("CALSCALE:GREGORIAN\r\n");
        ical.push_str("PRODID:-//SmartRiverCalendar//CalDAV Client//CN\r\n");
        ical.push_str("BEGIN:VEVENT\r\n");
        ical.push_str(&format!("UID:{}\r\n", event.id));
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
    pub async fn update_event(&self, event_url: &str, event: &EventInfo) -> Result<(), String> {
        let auth_header = self.get_auth_header()?;

        let ical_data = self.generate_ical_event(event)?;

        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, auth_header);
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("text/calendar; charset=utf-8"));

        let response = self
            .client
            .put(event_url)
            .headers(headers)
            .body(ical_data)
            .send()
            .await
            .map_err(|e| format!("更新事件失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("更新事件失败: {}", response.status()));
        }

        Ok(())
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
}
