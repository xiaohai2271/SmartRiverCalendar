<template>
  <div class="holiday-tab">
    <!-- 节假日列表 -->
    <div class="settings-section">
      <div class="section-header">
        <h3>节假日列表</h3>
        <select
          v-model="currentYear"
          class="year-select"
          data-testid="year-select"
          aria-label="选择年份"
        >
          <option v-for="year in availableYears" :key="year" :value="year">{{ year }}年</option>
        </select>
      </div>
      <div class="holiday-list">
        <table class="holiday-table">
          <thead>
            <tr>
              <th class="col-date">日期</th>
              <th class="col-name">名称</th>
              <th class="col-type">类型</th>
              <th class="col-action">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in sortedHolidays"
              :key="item.date"
              class="holiday-row"
              :class="{ 'holiday': item.type === 'holiday', 'makeup': item.type === 'makeup' }"
              :data-year="currentYear"
            >
              <td>{{ item.date }}</td>
              <td>{{ item.name }}</td>
              <td>
                <span class="type-badge" :class="item.type">
                  {{ item.type === 'holiday' ? '节假日' : '调休补班' }}
                </span>
              </td>
              <td>
                <button
                  v-if="item.isCustom"
                  class="delete-btn"
                  @click="removeHoliday(item.date, item.type)"
                  aria-label="删除"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
                <span v-else class="system-tag">系统</span>
              </td>
            </tr>
            <tr v-if="sortedHolidays.length === 0">
              <td colspan="4" class="empty-cell">该年份暂无节假日数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 新增表单 -->
    <div class="settings-section">
      <h3>新增节假日</h3>
      <div class="add-holiday-form">
        <div class="form-row">
          <div class="form-group">
            <label>日期</label>
            <input type="date" v-model="newHoliday.date" class="form-input" />
          </div>
          <div class="form-group">
            <label>名称</label>
            <input type="text" v-model="newHoliday.name" placeholder="请输入节假日名称" class="form-input" />
          </div>
          <div class="form-group">
            <label>类型</label>
            <select v-model="newHoliday.type" class="form-input">
              <option value="holiday">节假日</option>
              <option value="makeup">调休补班</option>
            </select>
          </div>
          <div class="form-group form-actions">
            <label>&nbsp;</label>
            <button class="add-btn" @click="addHoliday" :disabled="!canAdd">
              添加
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 节假日管理 Tab 组件
 * 用于管理节假日和调休补班日期
 */
import { ref, computed, onMounted, watch } from 'vue'
import {
  getAvailableYears,
  filterHolidaysByYear,
  addCustomHoliday,
  removeCustomHoliday,
  loadCustomHolidays,
  type MergedHolidayInfo
} from '../../utils/holidayStorage'

// ==================== State ====================
// 当前选中的年份
const currentYear = ref<number>(new Date().getFullYear())

// 可用年份列表
const availableYears = ref<number[]>([])

// 当前年份的节假日数据
const holidays = ref<Record<string, MergedHolidayInfo>>({})

// 新增节假日表单
const newHoliday = ref({
  date: '',
  name: '',
  type: 'holiday' as 'holiday' | 'makeup'
})

// ==================== Computed ====================
/**
 * 排序后的节假日列表
 */
const sortedHolidays = computed(() => {
  const list = Object.entries(holidays.value).map(([date, info]) => {
    // 判断是否为自定义节假日（用户添加的）
    const customData = loadCustomHolidays()
    const isCustom = date in customData.holidays || date in customData.makeupDays

    return {
      date,
      name: info.name,
      type: info.type,
      isCustom
    }
  })
  // 按日期排序
  return list.sort((a, b) => a.date.localeCompare(b.date))
})

/**
 * 是否可以添加节假日
 */
const canAdd = computed(() => {
  return newHoliday.value.date && newHoliday.value.name.trim()
})

/**
 * 是否可以切换到上一年
 */
const canGoPrev = computed(() => {
  const index = availableYears.value.indexOf(currentYear.value)
  return index < availableYears.value.length - 1
})

/**
 * 是否可以切换到下一年
 */
const canGoNext = computed(() => {
  const index = availableYears.value.indexOf(currentYear.value)
  return index > 0
})

// ==================== Lifecycle ====================
onMounted(() => {
  loadAvailableYears()
  loadHolidays()
})

// ==================== Watch ====================
watch(currentYear, () => {
  loadHolidays()
})

// ==================== Methods ====================
/**
 * 加载可用年份列表
 */
function loadAvailableYears(): void {
  availableYears.value = getAvailableYears()
  // 如果当前年份不在列表中，默认选择最近的一年
  if (!availableYears.value.includes(currentYear.value) && availableYears.value.length > 0) {
    currentYear.value = availableYears.value[0]
  }
}

/**
 * 加载指定年份的节假日数据
 */
function loadHolidays(): void {
  holidays.value = filterHolidaysByYear(currentYear.value)
}

/**
 * 切换到上一年
 */
function switchToPrevYear(): void {
  const index = availableYears.value.indexOf(currentYear.value)
  if (index < availableYears.value.length - 1) {
    currentYear.value = availableYears.value[index + 1]
  }
}

/**
 * 切换到下一年
 */
function switchToNextYear(): void {
  const index = availableYears.value.indexOf(currentYear.value)
  if (index > 0) {
    currentYear.value = availableYears.value[index - 1]
  }
}

/**
 * 添加自定义节假日
 */
function addHoliday(): void {
  if (!canAdd.value) return

  const { date, name, type } = newHoliday.value

  // 检查日期是否已存在
  if (holidays.value[date]) {
    if (!confirm(`该日期已存在"${holidays.value[date].name}"，是否覆盖？`)) {
      return
    }
  }

  // 添加节假日
  addCustomHoliday(date, name.trim(), type)

  // 重新加载数据
  loadAvailableYears()
  loadHolidays()

  // 重置表单
  newHoliday.value = {
    date: '',
    name: '',
    type: 'holiday'
  }
}

/**
 * 删除自定义节假日
 */
function removeHoliday(date: string, type: 'holiday' | 'makeup'): void {
  if (!confirm('确定要删除这个节假日吗？')) {
    return
  }

  removeCustomHoliday(date, type)

  // 重新加载数据
  loadAvailableYears()
  loadHolidays()
}
</script>

<style scoped>
.holiday-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

/* 设置区块 */
.settings-section {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.section-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.year-select {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  min-width: 90px;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.year-select:focus {
  outline: none;
  border-color: var(--accent-color);
}

/* 节假日列表表格 */
.holiday-list {
  overflow-x: auto;
}

.holiday-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 14px;
}

.holiday-table th {
  text-align: left;
  padding: 12px 16px;
  font-weight: 500;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.holiday-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

/* 列宽设置 */
.col-date {
  width: 120px;
}

.col-name {
  width: auto;
}

.col-type {
  width: 100px;
}

.col-action {
  width: 80px;
  text-align: center;
}

.holiday-row {
  transition: background 0.2s ease;
}

.holiday-row:hover {
  background: var(--bg-hover);
}

.holiday-row.holiday {
  border-left: 3px solid #22c55e;
}

.holiday-row.makeup {
  border-left: 3px solid #f97316;
}

.holiday-row.holiday td {
  background: rgba(34, 197, 94, 0.05);
}

.holiday-row.makeup td {
  background: rgba(249, 115, 22, 0.05);
}

/* 类型标签 */
.type-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
}

.type-badge.holiday {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.type-badge.makeup {
  background: rgba(249, 115, 22, 0.15);
  color: #f97316;
}

/* 系统标签 */
.system-tag {
  display: inline-block;
  padding: 4px 10px;
  border-radius: var(--radius-md);
  font-size: 12px;
  color: var(--text-tertiary);
  background: var(--bg-primary);
}

/* 删除按钮 */
.delete-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  color: var(--text-secondary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.delete-btn:hover {
  background: #fee2e2;
  color: #dc2626;
}

/* 空数据提示 */
.empty-cell {
  text-align: center;
  color: var(--text-tertiary);
  padding: 32px 16px;
}

/* 新增表单 */
.add-holiday-form {
  padding-top: 8px;
}

.form-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  min-width: 140px;
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.form-group:has(input[type="date"]) .form-input {
  min-width: 130px;
}

.form-group:has(input[type="text"]) .form-input {
  min-width: 180px;
}

.form-group:has(select) .form-input {
  min-width: 110px;
}

.form-actions {
  margin-left: auto;
}

.add-btn {
  padding: 8px 20px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.add-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 响应式 */
@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
    align-items: stretch;
  }

  .form-group {
    width: 100%;
  }

  .form-input {
    width: 100%;
    min-width: auto;
  }

  .form-actions {
    margin-left: 0;
    margin-top: 8px;
  }

  .add-btn {
    width: 100%;
  }

  .holiday-table {
    font-size: 13px;
  }

  .holiday-table th,
  .holiday-table td {
    padding: 10px 12px;
  }
}
</style>
