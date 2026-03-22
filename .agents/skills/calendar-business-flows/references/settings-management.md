# 设置管理流程

## 目录
1. [概述](#概述)
2. [设置模型](#设置模型)
3. [状态管理](#状态管理)
4. [持久化机制](#持久化机制)
5. [设置分类](#设置分类)

## 概述

小河日历的设置系统使用Pinia管理状态，localStorage持久化配置。支持主题切换、视图偏好、日历显示等多种配置。

## 设置模型

### AppSettings 接口
```typescript
interface AppSettings {
  theme: 'light' | 'dark'           // 主题模式
  defaultView: CalendarView         // 默认视图
  firstDayOfWeek: 0 | 1             // 一周起始日 (0=周日, 1=周一)
  defaultReminder: number           // 默认提醒时间(分钟)
  startMinimized: boolean           // 启动时最小化
  autoStart: boolean                // 开机自启
  autoUpdate: boolean               // 自动更新
  
  // 日历显示设置
  showLunar: boolean                // 显示农历
  showLunarFestival: boolean        // 显示农历节日
  showSolarTerm: boolean            // 显示节气
  showHoliday: boolean              // 显示法定节假日
  showMakeupDay: boolean            // 显示调休补班
  showWeekend: boolean              // 显示周末
}
```

### 默认设置
```typescript
const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  defaultView: 'month',
  firstDayOfWeek: 1,        // Monday
  defaultReminder: 15,
  startMinimized: false,
  autoStart: false,
  autoUpdate: true,
  showLunar: true,
  showLunarFestival: true,
  showSolarTerm: true,
  showHoliday: true,
  showMakeupDay: true,
  showWeekend: true
}
```

## 状态管理

### Store结构
```typescript
export const useSettingsStore = defineStore('settings', () => {
  // State
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })

  // Actions
  function loadSettings() {...}
  function saveSettings() {...}
  function updateSettings(updates: Partial<AppSettings>) {...}
  function resetSettings() {...}

  return {
    settings,
    loadSettings,
    saveSettings,
    updateSettings,
    resetSettings
  }
})
```

### 核心方法

1. **加载设置**
   ```typescript
   function loadSettings() {
     try {
       const stored = localStorage.getItem('app-settings')
       if (stored) {
         settings.value = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
       }
     } catch (e) {
       console.error('Failed to load settings:', e)
     }
   }
   ```

2. **保存设置**
   ```typescript
   function saveSettings() {
     try {
       localStorage.setItem('app-settings', JSON.stringify(settings.value))
     } catch (e) {
       console.error('Failed to save settings:', e)
     }
   }
   ```

3. **更新设置**
   ```typescript
   function updateSettings(updates: Partial<AppSettings>) {
     settings.value = { ...settings.value, ...updates }
     saveSettings()
   }
   ```

4. **重置设置**
   ```typescript
   function resetSettings() {
     settings.value = { ...DEFAULT_SETTINGS }
     saveSettings()
   }
   ```

## 持久化机制

### 存储位置
- **存储介质**: localStorage
- **存储键**: `app-settings`
- **数据格式**: JSON

### 自动保存
```typescript
// 初始化时加载
loadSettings()

// 监听变化自动保存
watch(settings, saveSettings, { deep: true })
```

### 生命周期
1. 应用启动 → `loadSettings()` 从localStorage读取
2. 用户修改 → `updateSettings()` 更新state并保存
3. 设置变化 → watch自动触发 `saveSettings()`

## 设置分类

### 1. 外观设置
| 设置项 | 类型 | 说明 |
|--------|------|------|
| theme | 'light' \| 'dark' | 主题颜色模式 |

### 2. 视图设置
| 设置项 | 类型 | 说明 |
|--------|------|------|
| defaultView | CalendarView | 启动时的默认视图 |
| firstDayOfWeek | 0 \| 1 | 一周起始日 |

### 3. 事件设置
| 设置项 | 类型 | 说明 |
|--------|------|------|
| defaultReminder | number | 新事件默认提醒时间 |

### 4. 系统设置
| 设置项 | 类型 | 说明 |
|--------|------|------|
| startMinimized | boolean | 启动时最小化到托盘 |
| autoStart | boolean | 开机自动启动 |
| autoUpdate | boolean | 自动检查更新 |

### 5. 日历显示设置
| 设置项 | 类型 | 说明 |
|--------|------|------|
| showLunar | boolean | 显示农历日期 |
| showLunarFestival | boolean | 显示农历节日 |
| showSolarTerm | boolean | 显示节气 |
| showHoliday | boolean | 显示法定节假日 |
| showMakeupDay | boolean | 显示调休补班 |
| showWeekend | boolean | 高亮显示周末 |

## 相关文件

- 状态管理: `src/stores/settings.ts`
- 类型定义: `src/types/index.ts`
- 设置页面: `src/views/SettingsView.vue`
- 设置组件: `src/components/settings/`