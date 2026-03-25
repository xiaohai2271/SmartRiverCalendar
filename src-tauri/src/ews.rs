//! EWS (Exchange Web Services) 客户端模块
//!
//! 实现与 Microsoft Exchange Server 的 EWS 接口通信，
//! 支持日历文件夹的获取和事件同步。

use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use serde::Serialize;

/// 日历文件夹信息
#[derive(Debug, Clone, Serialize)]
pub struct CalendarInfo {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
}

/// 事件信息
#[derive(Debug, Clone, Serialize)]
pub struct EventInfo {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub start_time: i64,  // Unix timestamp
    pub end_time: i64,
    pub all_day: bool,
    pub location: Option<String>,
}

/// EWS 客户端
///
/// 用于与 Exchange Web Services 进行通信，支持基本的连接验证和日历操作。
pub struct EwsClient {
    server_url: String,
    username: String,
    password: String,
    client: reqwest::Client,
}

impl EwsClient {
    /// 通过 Autodiscover 自动发现 EWS 服务器地址
    ///
    /// # 参数
    /// * `email` - 用户邮箱地址
    /// * `password` - 密码
    ///
    /// # 返回
    /// * `Ok(EwsClient)` - 发现成功，返回配置好的客户端
    /// * `Err(String)` - 发现失败，包含错误信息
    pub async fn discover(email: String, password: String) -> Result<Self, String> {
        // 从邮箱提取域名
        let domain = email.split('@').last()
            .ok_or_else(|| "无效的邮箱地址格式".to_string())?;

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

        // 对于微软邮箱，直接使用已知的 Office 365 EWS 地址
        let domain_lower = domain.to_lowercase();
        if domain_lower == "outlook.com" || domain_lower == "hotmail.com"
            || domain_lower == "live.com" || domain_lower == "outlook.cn" {
            return Ok(Self {
                server_url: "https://outlook.office365.com/EWS/Exchange.asmx".to_string(),
                username: email,
                password,
                client,
            });
        }

        // 腾讯企业邮箱 (exmail.qq.com)
        if domain_lower == "qq.com" || domain_lower == "exmail.qq.com" {
            return Ok(Self {
                server_url: "https://ex.exmail.qq.com/exchange.ewd".to_string(),
                username: email,
                password,
                client,
            });
        }

        // 对于其他邮箱，尝试 Autodiscover
        let autodiscover_urls = vec![
            format!("https://autodiscover.{}/autodiscover/autodiscover.xml", domain),
            format!("http://autodiscover.{}/autodiscover/autodiscover.xml", domain),
        ];

        // 构建 Autodiscover 请求体
        let request_body = format!(r#"<?xml version="1.0" encoding="utf-8"?>
<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/requestschema/2006">
  <Request>
    <EMailAddress>{}</EMailAddress>
    <AcceptableResponseSchema>http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a</AcceptableResponseSchema>
  </Request>
</Autodiscover>"#, email);

        // 尝试每个 Autodiscover URL
        for url in &autodiscover_urls {
            let credentials = base64::Engine::encode(
                &base64::engine::general_purpose::STANDARD,
                format!("{}:{}", email, password),
            );

            let mut headers = HeaderMap::new();
            headers.insert(
                reqwest::header::AUTHORIZATION,
                HeaderValue::from_str(&format!("Basic {}", credentials))
                    .map_err(|e| format!("创建认证头失败: {}", e))?,
            );
            headers.insert(
                CONTENT_TYPE,
                HeaderValue::from_static("text/xml"),
            );

            match client.post(url).headers(headers).body(request_body.clone()).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        if let Ok(body) = response.text().await {
                            if let Some(ews_url) = Self::parse_autodiscover_response(&body) {
                                return Ok(Self {
                                    server_url: ews_url,
                                    username: email,
                                    password,
                                    client,
                                });
                            }
                        }
                    }
                }
                Err(_) => continue, // 尝试下一个 URL
            }
        }

        Err("无法通过 Autodiscover 发现 Exchange 服务器地址".to_string())
    }

    /// 解析 Autodiscover 响应，提取 EWS URL
    fn parse_autodiscover_response(xml: &str) -> Option<String> {
        let mut reader = quick_xml::Reader::from_str(xml);
        let mut in_ews_url = false;
        let mut ews_url = String::new();

        loop {
            match reader.read_event() {
                Ok(quick_xml::events::Event::Start(ref e)) => {
                    let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    if name.ends_with("EwsUrl") {
                        in_ews_url = true;
                    }
                }
                Ok(quick_xml::events::Event::Text(ref e)) => {
                    if in_ews_url {
                        ews_url = e.unescape().unwrap_or_default().to_string();
                    }
                }
                Ok(quick_xml::events::Event::End(ref e)) => {
                    let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    if name.ends_with("EwsUrl") {
                        in_ews_url = false;
                        if !ews_url.is_empty() {
                            return Some(ews_url);
                        }
                    }
                }
                Ok(quick_xml::events::Event::Eof) => break,
                Err(_) => break,
                _ => {}
            }
        }

        None
    }

    /// 创建新的 EWS 客户端实例
    ///
    /// # 参数
    /// * `server_url` - EWS 服务器 URL（例如：https://mail.example.com/EWS/Exchange.asmx）
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

    fn build_headers(&self, soap_action: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();

        let credentials = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            format!("{}:{}", self.username, self.password),
        );
        headers.insert(
            reqwest::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Basic {}", credentials)).unwrap(),
        );

        headers.insert(
            CONTENT_TYPE,
            HeaderValue::from_static("text/xml; charset=utf-8"),
        );

        if !soap_action.is_empty() {
            headers.insert(
                "SOAPAction",
                HeaderValue::from_str(soap_action).unwrap(),
            );
        }

        headers
    }

    /// 验证与 EWS 服务器的连接
    ///
    /// 通过发送 GetUserConfiguration 请求来验证连接是否正常。
    ///
    /// # 返回
    /// * `Ok(())` - 连接成功
    /// * `Err(String)` - 连接失败，包含错误信息
    pub async fn connect(&self) -> Result<(), String> {
        let soap_body = r#"<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types">
  <soap:Body>
    <GetUserConfiguration xmlns="http://schemas.microsoft.com/exchange/services/2006/messages">
      <UserConfigurationProperties>All</UserConfigurationProperties>
      <UserConfigurationName Name="OOF">
        <DistinguishedFolderId Id="inbox" xmlns="http://schemas.microsoft.com/exchange/services/2006/types"/>
      </UserConfigurationName>
    </GetUserConfiguration>
  </soap:Body>
</soap:Envelope>"#;

        let headers = self.build_headers(
            "http://schemas.microsoft.com/exchange/services/2006/messages/GetUserConfiguration",
        );

        let response = self
            .client
            .post(&self.server_url)
            .headers(headers)
            .body(soap_body.to_string())
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if response.status().is_success() {
            Ok(())
        } else {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            Err(format!("连接验证失败 ({}): {}", status, body))
        }
    }

    /// 获取日历文件夹列表
    ///
    /// 通过 EWS GetFolder 操作获取用户的日历文件夹列表。
    ///
    /// # 返回
    /// * `Ok(Vec<CalendarInfo>)` - 日历文件夹列表
    /// * `Err(String)` - 获取失败，包含错误信息
    pub async fn list_calendars(&self) -> Result<Vec<CalendarInfo>, String> {
        let soap_body = r#"<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
               xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
  <soap:Body>
    <m:GetFolder>
      <m:FolderShape>
        <t:BaseShape>Default</t:BaseShape>
      </m:FolderShape>
      <m:FolderIds>
        <t:DistinguishedFolderId Id="calendar"/>
      </m:FolderIds>
    </m:GetFolder>
  </soap:Body>
</soap:Envelope>"#;

        let headers = self.build_headers(
            "http://schemas.microsoft.com/exchange/services/2006/messages/GetFolder",
        );

        let response = self
            .client
            .post(&self.server_url)
            .headers(headers)
            .body(soap_body.to_string())
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            return Err(format!("获取日历列表失败: HTTP {}", status));
        }

        let body = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;

        self.parse_calendar_response(&body)
    }

    /// 获取指定时间范围内的事件列表
    ///
    /// 通过 EWS FindItem 操作获取日历事件。
    ///
    /// # 参数
    /// * `calendar_id` - 日历文件夹 ID
    /// * `start` - 开始时间 (Unix timestamp)
    /// * `end` - 结束时间 (Unix timestamp)
    ///
    /// # 返回
    /// * `Ok(Vec<EventInfo>)` - 事件列表
    /// * `Err(String)` - 获取失败，包含错误信息
    pub async fn fetch_events(&self, calendar_id: &str, start: i64, end: i64) -> Result<Vec<EventInfo>, String> {
        let start_iso = self.timestamp_to_iso(start);
        let end_iso = self.timestamp_to_iso(end);

        let soap_body = format!(r#"<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
               xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
  <soap:Body>
    <m:FindItem Traversal="Shallow">
      <m:ItemShape>
        <t:BaseShape>IdOnly</t:BaseShape>
        <t:AdditionalProperties>
          <t:FieldURI FieldURI="item:Subject"/>
          <t:FieldURI FieldURI="item:Body"/>
          <t:FieldURI FieldURI="calendar:Start"/>
          <t:FieldURI FieldURI="calendar:End"/>
          <t:FieldURI FieldURI="calendar:IsAllDayEvent"/>
          <t:FieldURI FieldURI="calendar:Location"/>
        </t:AdditionalProperties>
      </m:ItemShape>
      <m:CalendarView StartDate="{start}" EndDate="{end}"/>
      <m:ParentFolderIds>
        <t:FolderId Id="{calendar_id}"/>
      </m:ParentFolderIds>
    </m:FindItem>
  </soap:Body>
</soap:Envelope>"#, start = start_iso, end = end_iso, calendar_id = calendar_id);

        let headers = self.build_headers(
            "http://schemas.microsoft.com/exchange/services/2006/messages/FindItem",
        );

        let response = self
            .client
            .post(&self.server_url)
            .headers(headers)
            .body(soap_body)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            return Err(format!("获取事件列表失败: HTTP {}", status));
        }

        let body = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;

        self.parse_events_response(&body)
    }

    /// 创建新事件
    ///
    /// 通过 EWS CreateItem 操作创建日历事件。
    ///
    /// # 参数
    /// * `calendar_id` - 日历文件夹 ID
    /// * `event` - 事件信息
    ///
    /// # 返回
    /// * `Ok(String)` - 新事件 ID
    /// * `Err(String)` - 创建失败，包含错误信息
    pub async fn create_event(&self, calendar_id: &str, event: &EventInfo) -> Result<String, String> {
        let start_iso = self.timestamp_to_iso(event.start_time);
        let end_iso = self.timestamp_to_iso(event.end_time);

        let description = event.description.as_deref().unwrap_or("");
        let location = event.location.as_deref().unwrap_or("");

        let soap_body = format!(r#"<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
               xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
  <soap:Body>
    <m:CreateItem SendMeetingInvitations="SendToNone">
      <m:SavedItemFolderId>
        <t:FolderId Id="{calendar_id}"/>
      </m:SavedItemFolderId>
      <m:Items>
        <t:CalendarItem>
          <t:Subject>{title}</t:Subject>
          <t:Body BodyType="Text">{description}</t:Body>
          <t:ReminderIsSet>true</t:ReminderIsSet>
          <t:ReminderMinutesBeforeStart>15</t:ReminderMinutesBeforeStart>
          <t:Start>{start}</t:Start>
          <t:End>{end}</t:End>
          <t:IsAllDayEvent>{all_day}</t:IsAllDayEvent>
          <t:Location>{location}</t:Location>
        </t:CalendarItem>
      </m:Items>
    </m:CreateItem>
  </soap:Body>
</soap:Envelope>"#, calendar_id = calendar_id, title = self.escape_xml(&event.title), description = self.escape_xml(description), start = start_iso, end = end_iso, all_day = event.all_day, location = self.escape_xml(location));

        let headers = self.build_headers(
            "http://schemas.microsoft.com/exchange/services/2006/messages/CreateItem",
        );

        let response = self
            .client
            .post(&self.server_url)
            .headers(headers)
            .body(soap_body)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            return Err(format!("创建事件失败: HTTP {}", status));
        }

        let body = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;

        self.parse_create_response(&body)
    }

    /// 更新事件
    ///
    /// 通过 EWS UpdateItem 操作更新日历事件。
    ///
    /// # 参数
    /// * `item_id` - 事件 ID
    /// * `event` - 更新后的事件信息
    ///
    /// # 返回
    /// * `Ok(())` - 更新成功
    /// * `Err(String)` - 更新失败，包含错误信息
    pub async fn update_event(&self, item_id: &str, event: &EventInfo) -> Result<(), String> {
        let start_iso = self.timestamp_to_iso(event.start_time);
        let end_iso = self.timestamp_to_iso(event.end_time);

        let description = event.description.as_deref().unwrap_or("");
        let location = event.location.as_deref().unwrap_or("");

        let soap_body = format!(r#"<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
               xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
  <soap:Body>
    <m:UpdateItem ConflictResolution="AlwaysOverwrite" SendMeetingInvitationsOrCancellations="SendToNone">
      <m:ItemChanges>
        <t:ItemChange>
          <t:ItemId Id="{item_id}"/>
          <t:Updates>
            <t:SetItemField>
              <t:FieldURI FieldURI="item:Subject"/>
              <t:CalendarItem>
                <t:Subject>{title}</t:Subject>
              </t:CalendarItem>
            </t:SetItemField>
            <t:SetItemField>
              <t:FieldURI FieldURI="item:Body"/>
              <t:CalendarItem>
                <t:Body BodyType="Text">{description}</t:Body>
              </t:CalendarItem>
            </t:SetItemField>
            <t:SetItemField>
              <t:FieldURI FieldURI="calendar:Start"/>
              <t:CalendarItem>
                <t:Start>{start}</t:Start>
              </t:CalendarItem>
            </t:SetItemField>
            <t:SetItemField>
              <t:FieldURI FieldURI="calendar:End"/>
              <t:CalendarItem>
                <t:End>{end}</t:End>
              </t:CalendarItem>
            </t:SetItemField>
            <t:SetItemField>
              <t:FieldURI FieldURI="calendar:IsAllDayEvent"/>
              <t:CalendarItem>
                <t:IsAllDayEvent>{all_day}</t:IsAllDayEvent>
              </t:CalendarItem>
            </t:SetItemField>
            <t:SetItemField>
              <t:FieldURI FieldURI="calendar:Location"/>
              <t:CalendarItem>
                <t:Location>{location}</t:Location>
              </t:CalendarItem>
            </t:SetItemField>
          </t:Updates>
        </t:ItemChange>
      </m:ItemChanges>
    </m:UpdateItem>
  </soap:Body>
</soap:Envelope>"#, item_id = item_id, title = self.escape_xml(&event.title), description = self.escape_xml(description), start = start_iso, end = end_iso, all_day = event.all_day, location = self.escape_xml(location));

        let headers = self.build_headers(
            "http://schemas.microsoft.com/exchange/services/2006/messages/UpdateItem",
        );

        let response = self
            .client
            .post(&self.server_url)
            .headers(headers)
            .body(soap_body)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            return Err(format!("更新事件失败: HTTP {}", status));
        }

        Ok(())
    }

    /// 删除事件
    ///
    /// 通过 EWS DeleteItem 操作删除日历事件。
    ///
    /// # 参数
    /// * `item_id` - 事件 ID
    ///
    /// # 返回
    /// * `Ok(())` - 删除成功
    /// * `Err(String)` - 删除失败，包含错误信息
    pub async fn delete_event(&self, item_id: &str) -> Result<(), String> {
        let soap_body = format!(r#"<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
               xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
  <soap:Body>
    <m:DeleteItem DeleteType="HardDelete" SendMeetingCancellations="SendToNone">
      <m:ItemIds>
        <t:ItemId Id="{item_id}"/>
      </m:ItemIds>
    </m:DeleteItem>
  </soap:Body>
</soap:Envelope>"#, item_id = item_id);

        let headers = self.build_headers(
            "http://schemas.microsoft.com/exchange/services/2006/messages/DeleteItem",
        );

        let response = self
            .client
            .post(&self.server_url)
            .headers(headers)
            .body(soap_body)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            return Err(format!("删除事件失败: HTTP {}", status));
        }

        Ok(())
    }

    /// 将 Unix 时间戳转换为 ISO 8601 格式
    fn timestamp_to_iso(&self, timestamp: i64) -> String {
        let datetime = chrono::DateTime::from_timestamp(timestamp, 0)
            .unwrap_or_else(|| chrono::DateTime::from_timestamp(0, 0).unwrap());
        datetime.format("%Y-%m-%dT%H:%M:%SZ").to_string()
    }

    /// 转义 XML 特殊字符
    fn escape_xml(&self, text: &str) -> String {
        text.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&apos;")
    }

    /// 解析事件列表响应 XML
    fn parse_events_response(&self, xml: &str) -> Result<Vec<EventInfo>, String> {
        let mut events = Vec::new();
        let mut reader = quick_xml::Reader::from_str(xml);

        let mut in_item = false;
        let mut current_id = String::new();
        let mut current_title = String::new();
        let mut current_description = String::new();
        let mut current_start: i64 = 0;
        let mut current_end: i64 = 0;
        let mut current_all_day = false;
        let mut current_location = String::new();
        let mut current_element = String::new();

        loop {
            match reader.read_event() {
                Ok(quick_xml::events::Event::Start(ref e)) => {
                    let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    if name.ends_with("CalendarItem") {
                        in_item = true;
                        current_id.clear();
                        current_title.clear();
                        current_description.clear();
                        current_start = 0;
                        current_end = 0;
                        current_all_day = false;
                        current_location.clear();
                    }
                    if in_item {
                        current_element = name;
                    }
                }
                Ok(quick_xml::events::Event::Text(ref e)) => {
                    if in_item {
                        let text = e.unescape().unwrap_or_default().to_string();
                        if current_element.ends_with("ItemId") {
                            current_id = text;
                        } else if current_element.ends_with("Subject") {
                            current_title = text;
                        } else if current_element.ends_with("Body") {
                            current_description = text;
                        } else if current_element.ends_with("Start") {
                            current_start = self.iso_to_timestamp(&text);
                        } else if current_element.ends_with("End") {
                            current_end = self.iso_to_timestamp(&text);
                        } else if current_element.ends_with("IsAllDayEvent") {
                            current_all_day = text.to_lowercase() == "true";
                        } else if current_element.ends_with("Location") {
                            current_location = text;
                        }
                    }
                }
                Ok(quick_xml::events::Event::Empty(ref e)) => {
                    let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    if name.ends_with("ItemId") && in_item {
                        for attr in e.attributes().flatten() {
                            if String::from_utf8_lossy(attr.key.as_ref()) == "Id" {
                                current_id = String::from_utf8_lossy(&attr.value).to_string();
                            }
                        }
                    }
                }
                Ok(quick_xml::events::Event::End(ref e)) => {
                    let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    if name.ends_with("CalendarItem") {
                        if !current_id.is_empty() && !current_title.is_empty() {
                            events.push(EventInfo {
                                id: current_id.clone(),
                                title: current_title.clone(),
                                description: if current_description.is_empty() { None } else { Some(current_description.clone()) },
                                start_time: current_start,
                                end_time: current_end,
                                all_day: current_all_day,
                                location: if current_location.is_empty() { None } else { Some(current_location.clone()) },
                            });
                        }
                        in_item = false;
                    }
                    current_element.clear();
                }
                Ok(quick_xml::events::Event::Eof) => break,
                Err(e) => return Err(format!("XML 解析错误: {}", e)),
                _ => {}
            }
        }

        Ok(events)
    }

    /// 解析创建事件响应 XML
    fn parse_create_response(&self, xml: &str) -> Result<String, String> {
        let mut reader = quick_xml::Reader::from_str(xml);
        let mut in_item_id = false;
        let mut item_id = String::new();

        loop {
            match reader.read_event() {
                Ok(quick_xml::events::Event::Start(ref e)) => {
                    let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    if name.ends_with("ItemId") {
                        in_item_id = true;
                    }
                }
                Ok(quick_xml::events::Event::Text(ref e)) => {
                    if in_item_id {
                        item_id = e.unescape().unwrap_or_default().to_string();
                    }
                }
                Ok(quick_xml::events::Event::Empty(ref e)) => {
                    let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    if name.ends_with("ItemId") {
                        for attr in e.attributes().flatten() {
                            if String::from_utf8_lossy(attr.key.as_ref()) == "Id" {
                                return Ok(String::from_utf8_lossy(&attr.value).to_string());
                            }
                        }
                    }
                }
                Ok(quick_xml::events::Event::End(ref e)) => {
                    let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    if name.ends_with("ItemId") {
                        in_item_id = false;
                        if !item_id.is_empty() {
                            return Ok(item_id);
                        }
                    }
                }
                Ok(quick_xml::events::Event::Eof) => break,
                Err(e) => return Err(format!("XML 解析错误: {}", e)),
                _ => {}
            }
        }

        Err("无法从响应中提取事件 ID".to_string())
    }

    /// 将 ISO 8601 格式转换为 Unix 时间戳
    fn iso_to_timestamp(&self, iso: &str) -> i64 {
        chrono::NaiveDateTime::parse_from_str(iso, "%Y-%m-%dT%H:%M:%SZ")
            .map(|dt| dt.and_utc().timestamp())
            .unwrap_or(0)
    }

    /// 解析日历响应 XML
    ///
    /// 从 EWS 响应中提取日历文件夹信息
    fn parse_calendar_response(&self, xml: &str) -> Result<Vec<CalendarInfo>, String> {
        let mut calendars = Vec::new();
        let mut reader = quick_xml::Reader::from_str(xml);

        let mut in_folder = false;
        let mut current_id = String::new();
        let mut current_name = String::new();
        let mut current_element = String::new();

        loop {
            match reader.read_event() {
                Ok(quick_xml::events::Event::Start(ref e)) => {
                    let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    if name.ends_with("CalendarFolder") || name.ends_with("Folder") {
                        in_folder = true;
                        current_id.clear();
                        current_name.clear();
                    }
                    if in_folder {
                        current_element = name;
                    }
                }
                Ok(quick_xml::events::Event::Text(ref e)) => {
                    if in_folder {
                        let text = e.unescape().unwrap_or_default().to_string();
                        if current_element.ends_with("FolderId") {
                            if let Some(id_attr) = e
                                .unescape()
                                .ok()
                                .and_then(|t| Some(t.to_string()))
                            {
                                current_id = id_attr;
                            }
                        } else if current_element.ends_with("DisplayName") {
                            current_name = text;
                        }
                    }
                }
                Ok(quick_xml::events::Event::Empty(ref e)) => {
                    let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    if name.ends_with("FolderId") && in_folder {
                        for attr in e.attributes().flatten() {
                            if String::from_utf8_lossy(attr.key.as_ref()) == "Id" {
                                current_id = String::from_utf8_lossy(&attr.value).to_string();
                            }
                        }
                    }
                }
                Ok(quick_xml::events::Event::End(ref e)) => {
                    let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    if name.ends_with("CalendarFolder") || name.ends_with("Folder") {
                        if !current_id.is_empty() && !current_name.is_empty() {
                            calendars.push(CalendarInfo {
                                id: current_id.clone(),
                                name: current_name.clone(),
                                color: None,
                            });
                        }
                        in_folder = false;
                    }
                    current_element.clear();
                }
                Ok(quick_xml::events::Event::Eof) => break,
                Err(e) => return Err(format!("XML 解析错误: {}", e)),
                _ => {}
            }
        }

        if calendars.is_empty() {
            calendars.push(CalendarInfo {
                id: "calendar".to_string(),
                name: "日历".to_string(),
                color: None,
            });
        }

        Ok(calendars)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calendar_info_creation() {
        let info = CalendarInfo {
            id: "test-id".to_string(),
            name: "测试日历".to_string(),
            color: Some("#FF0000".to_string()),
        };

        assert_eq!(info.id, "test-id");
        assert_eq!(info.name, "测试日历");
        assert_eq!(info.color, Some("#FF0000".to_string()));
    }

    #[test]
    fn test_calendar_info_serialization() {
        let info = CalendarInfo {
            id: "calendar-1".to_string(),
            name: "工作日历".to_string(),
            color: None,
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("calendar-1"));
        assert!(json.contains("工作日历"));
    }

    #[test]
    fn test_ews_client_new() {
        let client = EwsClient::new(
            "https://mail.example.com/EWS/Exchange.asmx".to_string(),
            "user@example.com".to_string(),
            "password123".to_string(),
        );

        assert_eq!(client.server_url, "https://mail.example.com/EWS/Exchange.asmx");
        assert_eq!(client.username, "user@example.com");
    }

    #[test]
    fn test_build_headers() {
        let client = EwsClient::new(
            "https://example.com/ews".to_string(),
            "testuser".to_string(),
            "testpass".to_string(),
        );

        let headers = client.build_headers("http://test.action");
        assert!(headers.contains_key("authorization"));
        assert!(headers.contains_key("content-type"));
        assert!(headers.contains_key("SOAPAction"));
    }

    #[test]
    fn test_parse_calendar_response_empty() {
        let client = EwsClient::new(
            "https://example.com/ews".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let result = client.parse_calendar_response("<root></root>");
        assert!(result.is_ok());
        let calendars = result.unwrap();
        assert_eq!(calendars.len(), 1);
        assert_eq!(calendars[0].name, "日历");
    }

    #[test]
    fn test_parse_calendar_response_with_folder() {
        let client = EwsClient::new(
            "https://example.com/ews".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types">
  <soap:Body>
    <GetFolderResponse xmlns="http://schemas.microsoft.com/exchange/services/2006/messages">
      <ResponseMessages>
        <GetFolderResponseMessage ResponseClass="Success">
          <Folders>
            <CalendarFolder>
              <FolderId Id="AQMkADNkZmE1"/>
              <DisplayName>我的日历</DisplayName>
            </CalendarFolder>
          </Folders>
        </GetFolderResponseMessage>
      </ResponseMessages>
    </GetFolderResponse>
  </soap:Body>
</soap:Envelope>"#;

        let result = client.parse_calendar_response(xml);
        assert!(result.is_ok());
        let calendars = result.unwrap();
        assert!(!calendars.is_empty());
    }

    #[test]
    fn test_event_info_creation() {
        let event = EventInfo {
            id: "event-123".to_string(),
            title: "测试会议".to_string(),
            description: Some("会议描述".to_string()),
            start_time: 1700000000,
            end_time: 1700003600,
            all_day: false,
            location: Some("会议室A".to_string()),
        };

        assert_eq!(event.id, "event-123");
        assert_eq!(event.title, "测试会议");
        assert_eq!(event.description, Some("会议描述".to_string()));
        assert_eq!(event.start_time, 1700000000);
        assert_eq!(event.end_time, 1700003600);
        assert!(!event.all_day);
        assert_eq!(event.location, Some("会议室A".to_string()));
    }

    #[test]
    fn test_event_info_serialization() {
        let event = EventInfo {
            id: "event-456".to_string(),
            title: "全天事件".to_string(),
            description: None,
            start_time: 1700000000,
            end_time: 1700086400,
            all_day: true,
            location: None,
        };

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("event-456"));
        assert!(json.contains("全天事件"));
        assert!(json.contains("true"));
    }

    #[test]
    fn test_timestamp_to_iso() {
        let client = EwsClient::new(
            "https://example.com/ews".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        // 2023-11-15 00:00:00 UTC
        let timestamp = 1700006400;
        let iso = client.timestamp_to_iso(timestamp);
        assert_eq!(iso, "2023-11-15T00:00:00Z");
    }

    #[test]
    fn test_iso_to_timestamp() {
        let client = EwsClient::new(
            "https://example.com/ews".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let iso = "2023-11-15T00:00:00Z";
        let timestamp = client.iso_to_timestamp(iso);
        assert_eq!(timestamp, 1700006400);
    }

    #[test]
    fn test_escape_xml() {
        let client = EwsClient::new(
            "https://example.com/ews".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let text = "Test & <value> \"quoted\" 'single'";
        let escaped = client.escape_xml(text);
        assert_eq!(escaped, "Test &amp; &lt;value&gt; &quot;quoted&quot; &apos;single&apos;");
    }

    #[test]
    fn test_parse_events_response_empty() {
        let client = EwsClient::new(
            "https://example.com/ews".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <FindItemResponse xmlns="http://schemas.microsoft.com/exchange/services/2006/messages">
      <ResponseMessages>
        <FindItemResponseMessage ResponseClass="Success">
          <RootFolder TotalItemsInView="0">
            <Items/>
          </RootFolder>
        </FindItemResponseMessage>
      </ResponseMessages>
    </FindItemResponse>
  </soap:Body>
</soap:Envelope>"#;

        let result = client.parse_events_response(xml);
        assert!(result.is_ok());
        let events = result.unwrap();
        assert!(events.is_empty());
    }

    #[test]
    fn test_parse_events_response_with_items() {
        let client = EwsClient::new(
            "https://example.com/ews".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types">
  <soap:Body>
    <FindItemResponse xmlns="http://schemas.microsoft.com/exchange/services/2006/messages">
      <ResponseMessages>
        <FindItemResponseMessage ResponseClass="Success">
          <RootFolder TotalItemsInView="1">
            <Items>
              <CalendarItem>
                <ItemId Id="AAMkADNkZmE1"/>
                <Subject>团队会议</Subject>
                <Body BodyType="Text">讨论项目进度</Body>
                <Start>2023-11-15T09:00:00Z</Start>
                <End>2023-11-15T10:00:00Z</End>
                <IsAllDayEvent>false</IsAllDayEvent>
                <Location>会议室B</Location>
              </CalendarItem>
            </Items>
          </RootFolder>
        </FindItemResponseMessage>
      </ResponseMessages>
    </FindItemResponse>
  </soap:Body>
</soap:Envelope>"#;

        let result = client.parse_events_response(xml);
        assert!(result.is_ok());
        let events = result.unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].id, "AAMkADNkZmE1");
        assert_eq!(events[0].title, "团队会议");
        assert_eq!(events[0].description, Some("讨论项目进度".to_string()));
        assert_eq!(events[0].start_time, 1700038800);
        assert_eq!(events[0].end_time, 1700042400);
        assert!(!events[0].all_day);
        assert_eq!(events[0].location, Some("会议室B".to_string()));
    }

    #[test]
    fn test_parse_create_response() {
        let client = EwsClient::new(
            "https://example.com/ews".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types">
  <soap:Body>
    <CreateItemResponse xmlns="http://schemas.microsoft.com/exchange/services/2006/messages">
      <ResponseMessages>
        <CreateItemResponseMessage ResponseClass="Success">
          <Items>
            <CalendarItem>
              <ItemId Id="AAMkADNkZmE1NEW"/>
            </CalendarItem>
          </Items>
        </CreateItemResponseMessage>
      </ResponseMessages>
    </CreateItemResponse>
  </soap:Body>
</soap:Envelope>"#;

        let result = client.parse_create_response(xml);
        assert!(result.is_ok());
        let item_id = result.unwrap();
        assert_eq!(item_id, "AAMkADNkZmE1NEW");
    }
}
