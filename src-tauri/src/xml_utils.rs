// 安全 XML 解析工具
// 防止 XXE (XML External Entity) 攻击
//
// ⚠️ 安全性声明（依赖 quick-xml v0.37）
// ─────────────────────────────────────────
// 本模块的 XXE 防护依赖于 quick-xml v0.37.5 的默认行为：
// - 默认不处理 DTD 声明
// - 默认不解析外部实体
// - 默认不展开实体引用
//
// 如果 quick-xml 版本升级（尤其是大版本变更），必须重新验证：
// 1. DTD/外部实体处理是否仍默认禁用
// 2. Config 中是否新增了可能影响安全性的选项
// 3. 实体解析行为的任何变更
//
// 当前版本：quick-xml = "0.37"（实际解析版本 0.37.5）

use quick_xml::Reader;

/// XML 响应最大允许字节数 (10MB)
pub const MAX_XML_SIZE: usize = 10 * 1024 * 1024;

/// 创建安全配置的 XML Reader
/// - 禁用 DTD 解析（quick_xml v0.37 默认不解析 DTD）
/// - 启用 trim_text 减少内存占用
/// - 调用方应先检查输入大小不超过 MAX_XML_SIZE
pub fn create_safe_reader(xml: &str) -> Reader<&[u8]> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    reader
}

/// 检查 XML 响应大小是否在安全范围内
pub fn validate_xml_size(xml: &str) -> Result<(), String> {
    if xml.len() > MAX_XML_SIZE {
        Err(format!(
            "XML 响应过大: {} bytes (最大 {} bytes)",
            xml.len(),
            MAX_XML_SIZE
        ))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_xml_size_within_limit() {
        let small_xml = "<root/>";
        assert!(validate_xml_size(small_xml).is_ok());
    }

    #[test]
    fn test_validate_xml_size_empty_string() {
        assert!(validate_xml_size("").is_ok());
    }

    #[test]
    fn test_validate_xml_size_exceeds_limit() {
        let large_xml = "x".repeat(MAX_XML_SIZE + 1);
        assert!(validate_xml_size(&large_xml).is_err());
    }

    #[test]
    fn test_validate_xml_size_at_limit() {
        let xml_at_limit = "x".repeat(MAX_XML_SIZE);
        assert!(validate_xml_size(&xml_at_limit).is_ok());
    }

    #[test]
    fn test_create_safe_reader_basic() {
        let xml = r#"<?xml version="1.0"?><root><child>text</child></root>"#;
        let _reader = create_safe_reader(xml);
    }
}
