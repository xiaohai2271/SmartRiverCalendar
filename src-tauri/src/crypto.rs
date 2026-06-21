use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use pbkdf2::pbkdf2_hmac;
use rand::Rng;
use sha2::{Digest, Sha256};

/// PBKDF2 迭代次数
const PBKDF2_ITERATIONS: u32 = 100_000;
/// 盐值后缀（应用特定）
const SALT_SUFFIX: &[u8] = b"SmartRiverCalendar";

/// 生成随机 16 字节盐值
pub fn generate_salt() -> [u8; 16] {
    let mut salt = [0u8; 16];
    rand::thread_rng().fill(&mut salt);
    salt
}

/// 使用 PBKDF2-HMAC-SHA256 派生加密密钥
///
/// 输入用户 ID 和随机盐值，生成 32 字节密钥
/// 密钥材料为 user_id 的小端字节，盐值为 salt + SALT_SUFFIX
pub fn derive_key_with_salt(user_id: i64, salt: &[u8]) -> [u8; 32] {
    let mut full_salt = Vec::with_capacity(salt.len() + SALT_SUFFIX.len());
    full_salt.extend_from_slice(salt);
    full_salt.extend_from_slice(SALT_SUFFIX);

    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(
        &user_id.to_le_bytes(),
        &full_salt,
        PBKDF2_ITERATIONS,
        &mut key,
    );
    key
}

/// 旧版密钥派生（用于迁移）
///
/// 使用机器特定值（hostname）和固定盐值的 SHA-256 哈希生成 32 字节密钥
/// 仅用于解密旧数据，新数据应使用 derive_key_with_salt
fn derive_key_legacy() -> [u8; 32] {
    let hostname = hostname::get()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let salt = b"SmartRiverCalendar2024";

    let mut hasher = Sha256::new();
    hasher.update(hostname.as_bytes());
    hasher.update(salt);
    let result = hasher.finalize();

    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}

/// 使用指定密钥加密
fn encrypt_with_key(key: &[u8; 32], plaintext: &str) -> Result<String, String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| format!("创建密码器失败: {}", e))?;

    let mut rng = rand::thread_rng();
    let mut nonce_bytes = [0u8; 12];
    rng.fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("加密失败: {}", e))?;

    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(BASE64.encode(combined))
}

/// 使用指定密钥解密
fn decrypt_with_key(key: &[u8; 32], encrypted_b64: &str) -> Result<String, String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| format!("创建密码器失败: {}", e))?;

    let combined = BASE64
        .decode(encrypted_b64)
        .map_err(|e| format!("Base64 解码失败: {}", e))?;

    if combined.len() < 12 {
        return Err("密文格式无效：长度不足".to_string());
    }

    let (nonce_bytes, encrypted_data) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, encrypted_data)
        .map_err(|e| format!("解密失败: {}", e))?;

    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 转换失败: {}", e))
}

/// 加密密码（使用用户特定盐值）
///
/// 使用 PBKDF2 派生密钥进行加密，返回 base64 编码的 (nonce + ciphertext)
pub fn encrypt_password(plaintext: &str, user_id: i64, salt: &[u8]) -> Result<String, String> {
    let key = derive_key_with_salt(user_id, salt);
    encrypt_with_key(&key, plaintext)
}

/// 解密密码（使用用户特定盐值）
///
/// 从 base64 编码的 (nonce + ciphertext) 解密并返回明文
pub fn decrypt_password(ciphertext: &str, user_id: i64, salt: &[u8]) -> Result<String, String> {
    let key = derive_key_with_salt(user_id, salt);
    decrypt_with_key(&key, ciphertext)
}

/// 迁移加密数据：使用旧密钥解密，再用新密钥重新加密
///
/// 用于将旧版（hostname + 固定盐值）加密的数据迁移到新版（user_id + 随机盐值）
pub fn migrate_encrypted_data(
    user_id: i64,
    salt: &[u8],
    encrypted_b64: &str,
) -> Result<String, String> {
    let legacy_key = derive_key_legacy();
    let plaintext = decrypt_with_key(&legacy_key, encrypted_b64)?;

    let new_key = derive_key_with_salt(user_id, salt);
    encrypt_with_key(&new_key, &plaintext)
}

/// 使用旧版密钥解密（用于迁移旧数据）
///
/// 使用 hostname + 固定盐值派生的密钥解密
pub fn decrypt_password_legacy(encrypted_b64: &str) -> Result<String, String> {
    let key = derive_key_legacy();
    decrypt_with_key(&key, encrypted_b64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_salt() {
        let salt1 = generate_salt();
        assert_eq!(salt1.len(), 16);

        let salt2 = generate_salt();
        assert_eq!(salt2.len(), 16);

        // 两次生成的盐值应不同
        assert_ne!(salt1, salt2);
    }

    #[test]
    fn test_derive_key_with_salt() {
        let salt = generate_salt();
        let key = derive_key_with_salt(1, &salt);
        assert_eq!(key.len(), 32);

        // 相同参数应派生相同密钥
        let key2 = derive_key_with_salt(1, &salt);
        assert_eq!(key, key2);

        // 不同用户 ID 应派生不同密钥
        let key3 = derive_key_with_salt(2, &salt);
        assert_ne!(key, key3);

        // 不同盐值应派生不同密钥
        let salt2 = generate_salt();
        let key4 = derive_key_with_salt(1, &salt2);
        assert_ne!(key, key4);
    }

    #[test]
    fn test_derive_key_legacy() {
        let key = derive_key_legacy();
        assert_eq!(key.len(), 32);

        // 验证密钥派生的一致性
        let key2 = derive_key_legacy();
        assert_eq!(key, key2);
    }

    #[test]
    fn test_encrypt_decrypt_with_user_salt() {
        let salt = generate_salt();
        let plaintext = "my_secret_password_123";

        let encrypted = encrypt_password(plaintext, 1, &salt).unwrap();
        assert!(!encrypted.is_empty());

        let decrypted = decrypt_password(&encrypted, 1, &salt).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_different_nonces() {
        let salt = generate_salt();
        let plaintext = "test_password";

        let encrypted1 = encrypt_password(plaintext, 1, &salt).unwrap();
        let encrypted2 = encrypt_password(plaintext, 1, &salt).unwrap();

        // 由于 nonce 不同，密文应该不同
        assert_ne!(encrypted1, encrypted2);

        // 但都能正确解密
        assert_eq!(decrypt_password(&encrypted1, 1, &salt).unwrap(), plaintext);
        assert_eq!(decrypt_password(&encrypted2, 1, &salt).unwrap(), plaintext);
    }

    #[test]
    fn test_decrypt_wrong_user_id() {
        let salt = generate_salt();
        let plaintext = "secret_data";

        let encrypted = encrypt_password(plaintext, 1, &salt).unwrap();

        // 用不同的 user_id 解密应失败
        let result = decrypt_password(&encrypted, 2, &salt);
        assert!(result.is_err());
    }

    #[test]
    fn test_decrypt_wrong_salt() {
        let salt1 = generate_salt();
        let salt2 = generate_salt();
        let plaintext = "secret_data";

        let encrypted = encrypt_password(plaintext, 1, &salt1).unwrap();

        // 用不同的盐值解密应失败
        let result = decrypt_password(&encrypted, 1, &salt2);
        assert!(result.is_err());
    }

    #[test]
    fn test_migrate_encrypted_data() {
        let legacy_key = derive_key_legacy();
        let plaintext = "legacy_password_data";
        let legacy_encrypted = encrypt_with_key(&legacy_key, plaintext).unwrap();

        let user_id: i64 = 42;
        let salt = generate_salt();

        let migrated = migrate_encrypted_data(user_id, &salt, &legacy_encrypted).unwrap();

        // 迁移后应该能用新密钥解密
        let decrypted = decrypt_password(&migrated, user_id, &salt).unwrap();
        assert_eq!(decrypted, plaintext);

        // 迁移后的密文应与旧密文不同
        assert_ne!(migrated, legacy_encrypted);
    }

    #[test]
    fn test_decrypt_invalid_base64() {
        let salt = generate_salt();
        let result = decrypt_password("invalid_base64!@#$", 1, &salt);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Base64 解码失败"));
    }

    #[test]
    fn test_decrypt_too_short() {
        let salt = generate_salt();
        let short_data = BASE64.encode([0u8; 8]);
        let result = decrypt_password(&short_data, 1, &salt);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("长度不足"));
    }

    #[test]
    fn test_encrypt_empty_string() {
        let salt = generate_salt();
        let plaintext = "";
        let encrypted = encrypt_password(plaintext, 1, &salt).unwrap();
        let decrypted = decrypt_password(&encrypted, 1, &salt).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_unicode() {
        let salt = generate_salt();
        let plaintext = "密码123测试";
        let encrypted = encrypt_password(plaintext, 1, &salt).unwrap();
        let decrypted = decrypt_password(&encrypted, 1, &salt).unwrap();
        assert_eq!(decrypted, plaintext);
    }
}
