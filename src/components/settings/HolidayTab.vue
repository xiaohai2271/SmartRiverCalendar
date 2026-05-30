<template>
  <div class="holiday-tab animate-fade-in">
    <!-- 卡片 1：节假日列表 -->
    <div class="settings-section">
      <div class="section-header">
        <h3 class="section-title">
          <svg class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span>节假日调休列表</span>
        </h3>
        <select
          v-model="currentYear"
          class="year-select fluent-select"
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
              <td class="date-cell">{{ item.date }}</td>
              <td class="name-cell">{{ item.name }}</td>
              <td>
                <span class="type-badge" :class="item.type">
                  {{ item.type === 'holiday' ? '放假' : '补班' }}
                </span>
              </td>
              <td class="action-cell">
                <button
                  v-if="item.isCustom"
                  class="delete-btn"
                  @click="removeHoliday(item.date, item.type)"
                  aria-label="删除"
                  type="button"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
                <span v-else class="system-tag">系统默认</span>
              </td>
            </tr>
            <tr v-if="sortedHolidays.length === 0">
              <td colspan="4" class="empty-cell">该年份暂无节假日数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 卡片 2：新增自定义节假日表单 -->
    <div class="settings-section">
      <h3 class="section-title">
        <svg class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>新增自定义放假与补班</span>
      </h3>
      <div class="add-holiday-form">
        <div class="form-row">
          <div class="form-group">
            <span class="form-label">日期</span>
            <div class="zero-border-input-wrapper date-wrapper">
              <input type="date" v-model="newHoliday.date" class="zero-border-text-input" />
              <span class="focus-underline"></span>
            </div>
          </div>
          <div class="form-group flex-fill">
            <span class="form-label">节假日名称</span>
            <div class="zero-border-input-wrapper">
              <input type="text" v-model="newHoliday.name" placeholder="请输入例如“端午节”" class="zero-border-text-input" />
              <span class="focus-underline"></span>
            </div>
          </div>
          <div class="form-group select-group">
            <span class="form-label">类别</span>
            <select v-model="newHoliday.type" class="fluent-select">
              <option value="holiday">法定放假</option>
              <option value="makeup">调休补班</option>
            </select>
          </div>
          <div class="form-group form-actions">
            <button class="fluent-button primary action-btn" @click="addHoliday" :disabled="!canAdd" type="button">
              添加数据
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  getAvailableYears,
  filterHolidaysByYear,
  addCustomHoliday,
  removeCustomHoliday,
  loadCustomHolidays,
  type MergedHolidayInfo,
  type CustomHolidayData
} from '../../utils/holidayStorage'
import { refreshHolidayCache } from '../../utils/lunar'

// ==================== State ====================
const currentYear = ref<number>(new Date().getFullYear())
const availableYears = ref<number[]>([])
const holidays = ref<Record<string, MergedHolidayInfo>>({})
const customHolidayData = ref<CustomHolidayData>({ holidays: {}, makeupDays: {} })
const newHoliday = ref({
  date: '',
  name: '',
  type: 'holiday' as 'holiday' | 'makeup'
})

// ==================== Computed ====================
const sortedHolidays = computed(() => {
  const list = Object.entries(holidays.value).map(([date, info]) => {
    const isCustom = date in customHolidayData.value.holidays || date in customHolidayData.value.makeupDays
    return {
      date,
      name: info.name,
      type: info.type,
      isCustom
    }
  })
  return list.sort((a, b) => a.date.localeCompare(b.date))
})

const canAdd = computed(() => {
  return newHoliday.value.date && newHoliday.value.name.trim()
})

// ==================== Lifecycle ====================
onMounted(async () => {
  await loadAvailableYears()
  await loadHolidays()
})

// ==================== Watch ====================
watch(currentYear, async () => {
  await loadHolidays()
})

// ==================== Methods ====================
async function loadAvailableYears(): Promise<void> {
  availableYears.value = await getAvailableYears()
  if (!availableYears.value.includes(currentYear.value) && availableYears.value.length > 0) {
    currentYear.value = availableYears.value[0]
  }
}

async function loadHolidays(): Promise<void> {
  holidays.value = await filterHolidaysByYear(currentYear.value)
  customHolidayData.value = await loadCustomHolidays()
}

async function addHoliday(): Promise<void> {
  if (!canAdd.value) return

  const { date, name, type } = newHoliday.value

  if (holidays.value[date]) {
    if (!confirm(`该日期已存在"${holidays.value[date].name}"，是否覆盖？`)) {
      return
    }
  }

  await addCustomHoliday(date, name.trim(), type)
  await refreshHolidayCache()
  await loadAvailableYears()
  await loadHolidays()

  newHoliday.value = {
    date: '',
    name: '',
    type: 'holiday'
  }
}

async function removeHoliday(date: string, type: 'holiday' | 'makeup'): Promise<void> {
  if (!confirm('确定要删除这个自定义节假日吗？')) {
    return
  }

  await removeCustomHoliday(date, type)
  await refreshHolidayCache()
  await loadAvailableYears()
  await loadHolidays()
}
</script>

<style scoped>
.holiday-tab {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 极精细亚克力极光卡片 */
.settings-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  padding: 24px;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-normal);
}

.settings-section:hover {
  transform: translateY(-1px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}

/* 卡片标题 */
.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 0;
  margin-bottom: 20px;
}

.section-icon {
  color: var(--accent-color);
}

/* 头部分类行 */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h3 {
  margin: 0;
}

.year-select {
  min-width: 100px;
}

/* 节假日表格高规格美化 */
.holiday-list {
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
}

.holiday-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
}

.holiday-table th {
  text-align: left;
  padding: 10px 16px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 1;
}

.holiday-table td {
  padding: 10px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.02);
  color: var(--text-primary);
  vertical-align: middle;
}

.holiday-row {
  transition: background var(--transition-fast);
}

.holiday-row:hover {
  background: var(--bg-hover) !important;
}

/* 绿色与橙色淡雅低饱和配色 */
.holiday-row.holiday {
  border-left: 3px solid rgba(52, 199, 89, 0.6);
}

.holiday-row.makeup {
  border-left: 3px solid rgba(255, 149, 0, 0.6);
}

.holiday-row.holiday td {
  background: rgba(52, 199, 89, 0.02);
}

.holiday-row.makeup td {
  background: rgba(255, 149, 0, 0.02);
}

.date-cell {
  font-weight: 500;
  font-family: monospace;
}

.name-cell {
  font-weight: 500;
}

/* 类型 Badge 调优 */
.type-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
}

.type-badge.holiday {
  background: rgba(52, 199, 89, 0.1);
  color: #34C759;
}

.type-badge.makeup {
  background: rgba(255, 149, 0, 0.1);
  color: #FF9500;
}

/* 系统默认标签 */
.system-tag {
  display: inline-block;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
}

/* 删除按钮 */
.delete-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  color: var(--text-secondary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  margin: 0 auto;
}

.delete-btn:hover {
  background: #fee2e2;
  color: #dc2626;
}

.action-cell {
  text-align: center;
}

.empty-cell {
  text-align: center;
  color: var(--text-tertiary);
  padding: 40px 16px;
}

/* 新增表单排版 */
.add-holiday-form {
  padding-top: 4px;
}

.form-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group.flex-fill {
  flex: 1;
  min-width: 160px;
}

.form-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 550;
}

/* Zero-border Text Input 与 Focused 底部亮线 */
.zero-border-input-wrapper {
  position: relative;
  width: 100%;
}

.zero-border-text-input {
  width: 100%;
  border: none;
  background: transparent;
  font-size: 13.5px;
  color: var(--text-primary);
  padding: 6px 0;
  outline: none;
}

.zero-border-text-input::placeholder {
  color: var(--text-tertiary);
  opacity: 0.8;
}

.focus-underline {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background: var(--border-color);
  transition: background var(--transition-normal);
}

.zero-border-text-input:focus ~ .focus-underline {
  background: var(--accent-color);
  height: 1.5px;
}

.date-wrapper {
  width: 120px;
}

.select-group {
  width: 120px;
}

/* 扁平 select */
.fluent-select {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  height: 31px;
}

.fluent-select:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-light);
}

.form-actions {
  margin-left: auto;
}

.fluent-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 18px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-weight: 550;
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
  height: 31px;
}

.fluent-button:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.fluent-button.primary {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.fluent-button.primary:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.fluent-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 淡入 */
.animate-fade-in {
  animation: fadeIn 0.3s cubic-bezier(0.1, 0.9, 0.2, 1);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .form-group {
    width: 100%;
  }
  
  .date-wrapper,
  .select-group {
    width: 100%;
  }
  
  .fluent-select {
    width: 100%;
  }
  
  .form-actions {
    margin-left: 0;
    margin-top: 12px;
  }
  
  .fluent-button {
    width: 100%;
  }
}
</style>
