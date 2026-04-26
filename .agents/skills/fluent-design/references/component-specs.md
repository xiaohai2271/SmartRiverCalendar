# 组件规范

## 目录
1. [卡片 (fluent-card)](#卡片-fluent-card)
2. [按钮 (fluent-button)](#按钮-fluent-button)
3. [输入框 (fluent-input)](#输入框-fluent-input)
4. [滚动条](#滚动条)
5. [亚克力效果 (Acrylic)](#亚克力效果-acrylic)
6. [主题切换](#主题切换)

## 卡片 (fluent-card)

基础容器组件，用于展示独立的内容区块。

```css
.fluent-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-fluent);
  transition: box-shadow var(--transition-normal),
              transform var(--transition-normal);
}

.fluent-card:hover {
  box-shadow: var(--shadow-md);
}

/* 交互式卡片 (可点击) */
.fluent-card.interactive {
  cursor: pointer;
}

.fluent-card.interactive:active {
  transform: scale(0.98);
}
```

### 使用示例
```html
<div class="fluent-card">
  <h3>卡片标题</h3>
  <p>卡片内容</p>
</div>

<!-- 可点击的卡片 -->
<div class="fluent-card interactive" @click="handleClick">
  <h3>可点击卡片</h3>
</div>
```

## 按钮 (fluent-button)

支持多种状态和变体的按钮组件。

```css
.fluent-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 20px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  user-select: none;
}

/* Hover */
.fluent-button:hover {
  background: var(--bg-hover);
}

/* Active (按下) */
.fluent-button:active {
  background: var(--bg-active);
  transform: scale(0.98);
}

/* 禁用状态 */
.fluent-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 主要按钮 */
.fluent-button.primary {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.fluent-button.primary:hover {
  background: var(--accent-hover);
}

.fluent-button.primary:active {
  background: var(--accent-active);
}

/* 危险按钮 */
.fluent-button.danger {
  background: var(--danger-color);
  border-color: var(--danger-color);
  color: white;
}

.fluent-button.danger:hover {
  opacity: 0.9;
}

/* 小尺寸按钮 */
.fluent-button.small {
  padding: 4px 12px;
  font-size: 12px;
}

/* 图标按钮 (仅图标) */
.fluent-button.icon-only {
  padding: 8px;
  width: 32px;
  height: 32px;
}
```

### 使用示例
```html
<button class="fluent-button">默认按钮</button>
<button class="fluent-button primary">主要操作</button>
<button class="fluent-button danger">删除</button>
<button class="fluent-button small">小按钮</button>
<button class="fluent-button icon-only" title="关闭">✕</button>
```

## 输入框 (fluent-input)

文本输入控件，带聚焦光晕效果。

```css
.fluent-input {
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color var(--transition-fast),
              box-shadow var(--transition-fast);
}

.fluent-input:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-light);
}

.fluent-input::placeholder {
  color: var(--text-tertiary);
}

.fluent-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 错误状态 */
.fluent-input.error {
  border-color: var(--danger-color);
}

.fluent-input.error:focus {
  box-shadow: 0 0 0 2px var(--danger-light);
}
```

### 使用示例
```html
<input class="fluent-input" type="text" placeholder="请输入标题" />
<input class="fluent-input error" type="text" value="错误的值" />
```

## 滚动条

自定义 Fluent 风格的滚动条，与 Windows 11 风格一致。

```css
/* 基础滚动条 */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.4);
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: content-box;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.6);
  background-clip: content-box;
}

::-webkit-scrollbar-corner {
  background: transparent;
}
```

## 亚克力效果 (Acrylic)

半透明、模糊的背景材质，增强视觉层次感。

```css
.acrylic {
  background: var(--bg-primary);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}

/* 强亚克力 (更深模糊) */
.acrylic-strong {
  background: var(--bg-primary);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
}
```

### 使用场景
| 场景 | 样式 | 说明 |
|------|------|------|
| 侧边栏 | `.acrylic` | 半透明背景，可透出下方内容 |
| 模态框背景 | `.acrylic-strong` | 更强的模糊，突出模态内容 |
| 弹出菜单 | `.acrylic` | 悬浮弹出，轻微模糊 |
| 标题栏 | `.acrylic` | Windows 11 风格标题栏 |

### 注意事项
- 亚克力效果在性能较低的设备上可能影响渲染性能
- 深色主题下亚克力效果更明显
- 纯色背景上的亚克力效果几乎不可见

## 主题切换

### 实现方式

项目支持三种主题模式：

1. **浅色模式** (`.light`)
2. **深色模式** (`.dark`)
3. **自动模式** (跟随系统 `prefers-color-scheme`)

### CSS 变量切换

```css
/* 浅色主题 (默认) */
:root {
  --bg-primary: rgba(255, 255, 255, 0.8);
  --text-primary: #1a1a1a;
  /* ... 其他浅色变量 */
}

/* 深色主题 */
:root.dark {
  --bg-primary: rgba(32, 32, 32, 0.8);
  --text-primary: #ffffff;
  /* ... 其他深色变量 */
}

/* 自动模式 (系统深色) */
@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    /* 深色主题变量 */
  }
}
```

### JavaScript 主题切换

```typescript
function applyTheme(theme: 'light' | 'dark' | 'auto'): void {
  const root = document.documentElement
  root.classList.remove('dark', 'light')

  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.add('light')
  }
  // 'auto' 模式不添加任何 class，依赖 CSS 媒体查询
}
```

### 新建组件时的主题检查清单

- [ ] 所有颜色通过 CSS 变量设置
- [ ] 在浅色和深色主题下都正确显示
- [ ] 不使用硬编码的 `#ffffff` 或 `#000000`
- [ ] 阴影和边框在两种主题下都可见
- [ ] 过渡动画在两种主题下平滑切换
