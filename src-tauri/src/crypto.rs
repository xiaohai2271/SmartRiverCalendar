use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::Rng;
use sha2::{Digest, Sha256};

/// 派生加密密钥
/// 使用机器特定值（hostname）和固定盐值的 SHA-256 哈希生成 32 字节密钥
fn derive_key() -> [u8; 32] {
    // 获取主机名，如果失败则使用默认值
    let hostname = hostname::get()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    // 固定盐值（应用特定）
    let salt = b"SmartRiverCalendar2024";

    // 组合 hostname + salt 并计算 SHA-256
    let mut hasher = Sha256::new();
    hasher.update(hostname.as_bytes());
    hasher.update(salt);
    let result = hasher.finalize();

    // 转换为 32 字节数组
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}

/// 加密密码
/// 使用 AES-256-GCM 加密，返回 base64 编码的 (nonce + ciphertext)
pub fn encrypt_password(plaintext: &str) -> Result<String, String> {
    // 派生密钥
    let key = derive_key();

    // 创建密码器
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| format!("创建密码器失败: {}", e))?;

    // 生成随机 12 字节 nonce
    let mut rng = rand::thread_rng();
    let mut nonce_bytes = [0u8; 12];
    rng.fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // 加密
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("加密失败: {}", e))?;

    // 组合 nonce + ciphertext 并 base64 编码
    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(BASE64.encode(combined))
}

/// 解密密码
/// 从 base64 编码的 (nonce + ciphertext) 解密并返回明文
pub fn decrypt_password(ciphertext: &str) -> Result<String, String> {
    // 派生密钥
    let key = derive_key();

    // 创建密码器
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| format!("创建密码器失败: {}", e))?;

    // Base64 解码
    let combined = BASE64
        .decode(ciphertext)
        .map_err(|e| format!("Base64 解码失败: {}", e))?;

    // 验证长度
    if combined.len() < 12 {
        return Err("密文格式无效：长度不足".to_string());
    }

    // 分离 nonce 和 ciphertext
    let (nonce_bytes, encrypted_data) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    // 解密
    let plaintext = cipher
        .decrypt(nonce, encrypted_data)
        .map_err(|e| format!("解密失败: {}", e))?;

    // 转换为字符串
    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 转换失败: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_key() {
        let key = derive_key();
        assert_eq!(key.len(), 32);

        // 验证密钥派生的一致性
        let key2 = derive_key();
        assert_eq!(key, key2);
    }

    #[test]
    fn test_encrypt_decrypt() {
        let plaintext = "my_secret_password_123";

        // 加密
        let encrypted = encrypt_password(plaintext).unwrap();
        assert!(!encrypted.is_empty());

        // 解密
        let decrypted = decrypt_password(&encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_different_nonces() {
        let plaintext = "test_password";

        // 多次加密应产生不同的密文（因为 nonce 不同）
        let encrypted1 = encrypt_password(plaintext).unwrap();
        let encrypted2 = encrypt_password(plaintext).unwrap();

        // 由于 nonce 不同，密文应该不同
        assert_ne!(encrypted1, encrypted2);

        // 但都能正确解密
        assert_eq!(decrypt_password(&encrypted1).unwrap(), plaintext);
        assert_eq!(decrypt_password(&encrypted2).unwrap(), plaintext);
    }

    #[test]
    fn test_decrypt_invalid_base64() {
        let result = decrypt_password("invalid_base64!@#$");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Base64 解码失败"));
    }

    #[test]
    fn test_decrypt_too_short() {
        // 创建一个太短的 base64 字符串
        let short_data = BASE64.encode([0u8; 8]);
        let result = decrypt_password(&short_data);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("长度不足"));
    }

    #[test]
    fn test_encrypt_empty_string() {
        let plaintext = "";
        let encrypted = encrypt_password(plaintext).unwrap();
        let decrypted = decrypt_password(&encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_unicode() {
        let plaintext = "密码123测试";
        let encrypted = encrypt_password(plaintext).unwrap();
        let decrypted = decrypt_password(&encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }
}
