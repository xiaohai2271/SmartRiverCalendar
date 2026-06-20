// PKCE (Proof Key for Code Exchange) 密钥对生成模块
// 用于桌面端 OAuth 登录流程，防止授权码拦截攻击
//
// 生成方式：
// - verifier: 32 字节随机数据 → URL_SAFE_NO_PAD Base64 编码（43 字符）
// - challenge_hex: SHA-256(verifier 原始字节) → hex 编码（64 字符小写）

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use ring::digest::{digest, SHA256};
use ring::rand::SecureRandom;
use ring::rand::SystemRandom;

/// PKCE 密钥对
///
/// 包含 code_verifier 和 code_challenge，
/// verifier 由客户端保存用于后续验证，challenge 发送给服务端
pub struct PkcePair {
    /// 43 字符 URL-safe Base64 编码的随机字符串（code_verifier）
    pub verifier: String,
    /// 64 字符小写十六进制编码的 SHA-256 哈希值（code_challenge）
    pub challenge_hex: String,
}

impl PkcePair {
    /// 生成新的 PKCE 密钥对
    ///
    /// 使用 ring::rand::SystemRandom (CSPRNG) 生成 32 字节随机数据，
    /// 编码为 URL_SAFE_NO_PAD Base64 作为 verifier，
    /// 再对 verifier 的 UTF-8 字节进行 SHA-256 哈希，hex 编码为 challenge
    pub fn new() -> Self {
        let rng = SystemRandom::new();
        let mut random_bytes = [0u8; 32];
        rng.fill(&mut random_bytes)
            .expect("CSPRNG 填充失败：系统随机数生成器不可用");

        // 32 字节 → URL_SAFE_NO_PAD Base64 = 43 字符
        let verifier = URL_SAFE_NO_PAD.encode(random_bytes);

        // SHA-256(verifier 的 UTF-8 字节) → 32 字节 → hex = 64 字符
        let hash = digest(&SHA256, verifier.as_bytes());
        let challenge_hex = hex::encode(hash.as_ref());

        Self {
            verifier,
            challenge_hex,
        }
    }
}

impl Default for PkcePair {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试 verifier 长度：32 字节 Base64 编码后为 43 字符
    #[test]
    fn test_verifier_length() {
        let pkce = PkcePair::new();
        assert_eq!(pkce.verifier.len(), 43, "verifier 应为 43 字符（32 字节 URL_SAFE_NO_PAD Base64）");
    }

    /// 测试 challenge_hex 长度：SHA-256 输出 32 字节，hex 编码后为 64 字符
    #[test]
    fn test_challenge_hex_length() {
        let pkce = PkcePair::new();
        assert_eq!(pkce.challenge_hex.len(), 64, "challenge_hex 应为 64 字符（SHA-256 hex 编码）");
    }

    /// 测试 challenge_hex 全为小写十六进制字符
    #[test]
    fn test_challenge_hex_is_lowercase_hex() {
        let pkce = PkcePair::new();
        assert!(
            pkce.challenge_hex.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()),
            "challenge_hex 应全为小写十六进制字符"
        );
    }

    /// 测试 verifier 仅包含 URL-safe Base64 字符
    #[test]
    fn test_verifier_is_url_safe_base64() {
        let pkce = PkcePair::new();
        assert!(
            pkce.verifier.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'),
            "verifier 应仅包含 URL-safe Base64 字符（无填充）"
        );
    }

    /// 测试两次生成的 PkcePair 不同（随机性验证）
    #[test]
    fn test_two_pairs_are_different() {
        let pkce1 = PkcePair::new();
        let pkce2 = PkcePair::new();
        assert_ne!(pkce1.verifier, pkce2.verifier, "两次生成的 verifier 应不同");
        assert_ne!(pkce1.challenge_hex, pkce2.challenge_hex, "两次生成的 challenge_hex 应不同");
    }

    /// 测试 challenge 与 verifier 的数学关系：SHA-256(verifier) == challenge
    #[test]
    fn test_challenge_matches_verifier() {
        let pkce = PkcePair::new();
        let hash = digest(&SHA256, pkce.verifier.as_bytes());
        let expected_hex = hex::encode(hash.as_ref());
        assert_eq!(pkce.challenge_hex, expected_hex, "challenge_hex 应为 verifier 的 SHA-256 hex 编码");
    }

    /// 测试 Default trait
    #[test]
    fn test_default() {
        let pkce = PkcePair::default();
        assert_eq!(pkce.verifier.len(), 43);
        assert_eq!(pkce.challenge_hex.len(), 64);
    }
}
