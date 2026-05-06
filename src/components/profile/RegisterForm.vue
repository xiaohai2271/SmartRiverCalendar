<template>
  <form class="register-form" @submit.prevent="handleSubmit">
    <h3 class="form-title">创建账号</h3>

    <!-- 显示名称输入框 -->
    <div class="form-group">
      <label for="register-username">显示名称</label>
      <input
        id="register-username"
        v-model="formData.username"
        type="text"
        placeholder="请输入显示名称"
        :disabled="isLoading"
        required
        maxlength="32"
      />
      <span v-if="errors.username" class="error-message">{{ errors.username }}</span>
    </div>

    <!-- 邮箱输入框 -->
    <div class="form-group">
      <label for="register-email">邮箱</label>
      <input
        id="register-email"
        v-model="formData.email"
        type="email"
        placeholder="请输入邮箱"
        :disabled="isLoading"
        required
        @blur="validateEmail"
      />
      <span v-if="errors.email" class="error-message">{{ errors.email }}</span>
    </div>

    <!-- 密码输入框 -->
    <div class="form-group">
      <label for="register-password">密码</label>
      <input
        id="register-password"
        v-model="formData.password"
        type="password"
        placeholder="请输入密码（至少6位）"
        :disabled="isLoading"
        required
        minlength="6"
      />
      <span v-if="errors.password" class="error-message">{{ errors.password }}</span>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMessage" class="alert alert-error">
      {{ errorMessage }}
    </div>

    <!-- 注册按钮 -->
    <button
      type="submit"
      class="btn btn-primary btn-full"
      :disabled="isLoading || !isFormValid"
    >
      <span v-if="isLoading" class="spinner"></span>
      <span v-else>注册</span>
    </button>

    <!-- 切换到登录 -->
    <div class="form-footer">
      <span>已有账号？</span>
      <button type="button" class="btn-link" @click="switchToLogin">
        去登录
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useAuthStore } from '../../stores/auth'

// ==================== Emits ====================
const emit = defineEmits<{
  'switch-to-login': []
  'register-success': []
}>()

// ==================== Store ====================
const authStore = useAuthStore()

// ==================== State ====================
const isLoading = ref(false)
const errorMessage = ref('')

const formData = reactive({
  username: '',
  email: '',
  password: ''
})

const errors = reactive({
  username: '',
  email: '',
  password: ''
})

// ==================== Computed ====================
/**
 * 表单是否有效
 */
const isFormValid = computed(() => {
  return formData.username &&
    formData.email &&
    formData.password &&
    !errors.username &&
    !errors.email &&
    !errors.password
})

// ==================== Methods ====================
/**
 * 验证邮箱格式
 */
function validateEmail(): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!formData.email) {
    errors.email = '请输入邮箱'
    return false
  }
  if (!emailRegex.test(formData.email)) {
    errors.email = '请输入有效的邮箱地址'
    return false
  }
  errors.email = ''
  return true
}

/**
 * 验证表单
 */
function validateForm(): boolean {
  const isEmailValid = validateEmail()
  let isValid = isEmailValid

  // 验证用户名
  if (!formData.username.trim()) {
    errors.username = '请输入显示名称'
    isValid = false
  } else if (formData.username.length > 32) {
    errors.username = '显示名称不能超过32个字符'
    isValid = false
  } else {
    errors.username = ''
  }

  // 验证密码
  if (!formData.password) {
    errors.password = '请输入密码'
    isValid = false
  } else if (formData.password.length < 6) {
    errors.password = '密码至少需要6位'
    isValid = false
  } else {
    errors.password = ''
  }

  return isValid
}

/**
 * 处理表单提交
 */
async function handleSubmit(): Promise<void> {
  if (!validateForm()) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const success = await authStore.register({
      username: formData.username,
      email: formData.email,
      password: formData.password
    })

    if (success) {
      emit('register-success')
    } else {
      errorMessage.value = '注册失败，该邮箱可能已被注册'
    }
  } catch (error) {
    console.error('注册失败:', error)
    errorMessage.value = '注册失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

/**
 * 切换到登录表单
 */
function switchToLogin(): void {
  emit('switch-to-login')
}
</script>

<style scoped>
.register-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
  text-align: center;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-group input {
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(0, 120, 212, 0.15);
}

.form-group input:disabled {
  background: var(--bg-secondary);
  cursor: not-allowed;
}

.error-message {
  font-size: 12px;
  color: #d83b01;
}

.alert {
  padding: 12px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
}

.alert-error {
  background: rgba(216, 59, 1, 0.1);
  color: #d83b01;
  border: 1px solid rgba(216, 59, 1, 0.2);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.1s ease;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-primary {
  background: var(--accent-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #006cbd;
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-full {
  width: 100%;
}

.btn-link {
  background: none;
  border: none;
  color: var(--accent-color);
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  text-decoration: none;
}

.btn-link:hover {
  text-decoration: underline;
}

.form-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
