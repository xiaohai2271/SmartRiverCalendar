# 设计令牌 (Design Tokens)

## 目录
1. [颜色系统](#颜色系统)
2. [阴影系统](#阴影系统)
3. [圆角规范](#圆角规范)
4. [间距系统](#间距系统)
5. [字体规范](#字体规范)

## 颜色系统

### 浅色主题

```css
/* 背景 */
--bg-primary: rgba(255, 255, 255, 0.8);
--bg-secondary: rgba(255, 255, 255, 0.9);
--bg-tertiary: rgba(243, 243, 243, 0.8);
--bg-hover: rgba(0, 0, 0, 0.04);
--bg-active: rgba(0, 0, 0, 0.08);

/* 文本 */
--text-primary: #1a1a1a;
--text-secondary: #5c5c5c;
--text-tertiary: #8a8a8a;

/* 边框 */
--border-color: rgba(0, 0, 0, 0.08);
--border-strong: rgba(0, 0, 0, 0.12);

/* 强调色 (蓝色系) */
--accent-color: #0078d4;
--accent-light: rgba(0, 120, 212, 0.1);
--accent-hover: #006cbd;
--accent-active: #005a9e;
```

### 深色主题

```css
/* 背景 */
--bg-primary: rgba(32, 32, 32, 0.8);
--bg-secondary: rgba(45, 45, 45, 0.9);
--bg-tertiary: rgba(55, 55, 55, 0.8);
--bg-hover: rgba(255, 255, 255, 0.06);
--bg-active: rgba(255, 255, 255, 0.1);

/* 文本 */
--text-primary: #ffffff;
--text-secondary: #b3b3b3;
--text-tertiary: #808080;

/* 边框 */
--border-color: rgba(255, 255, 255, 0.08);
--border-strong: rgba(255, 255, 255, 0.14);

/* 强调色 (浅蓝系) */
--accent-color: #60cdff;
--accent-light: rgba(96, 205, 255, 0.15);
--accent-hover: #4dc3ff;
--accent-active: #7dd4ff;
```

### 语义颜色

```css
/* 警告 */
--warning-color: #ffc107;
--warning-light: rgba(255, 193, 7, 0.1);
--warning-text: #d39e00;

/* 成功 */
--success-color: #28a745;
--success-light: rgba(40, 167, 69, 0.1);
--success-text: #1e7e34;

/* 危险 (深色主题可调整) */
--danger-color: #dc3545;
--danger-light: rgba(220, 53, 69, 0.1);
--danger-text: #bd2130;
```

### 使用方式

```css
/* ✅ 始终使用 CSS 变量 */
.my-component {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

/* ❌ 禁止硬编码颜色值 */
.my-component {
  background: #ffffff;
  color: #1a1a1a;
}
```

## 阴影系统

阴影用于表达元素的深度层次。层级越高，阴影越大，表示元素"浮起"越高。

### 浅色主题

```css
/* 1 级: 轻微提升 (默认卡片) */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);

/* 2 级: 中等提升 (hover 状态) */
--shadow-md: 0 2px 4px rgba(0, 0, 0, 0.06),
             0 4px 8px rgba(0, 0, 0, 0.04);

/* 3 级: 深度提升 (下拉菜单) */
--shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.08),
             0 16px 32px rgba(0, 0, 0, 0.04);

/* Fluent 风格默认阴影 */
--shadow-fluent: 0 2px 6px rgba(0, 0, 0, 0.04),
                 0 8px 16px rgba(0, 0, 0, 0.08);
```

### 深色主题

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
--shadow-md: 0 2px 4px rgba(0, 0, 0, 0.3),
             0 4px 8px rgba(0, 0, 0, 0.2);
--shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.3),
             0 16px 32px rgba(0, 0, 0, 0.2);
--shadow-fluent: 0 2px 6px rgba(0, 0, 0, 0.2),
                 0 8px 16px rgba(0, 0, 0, 0.3);
```

### 使用指南

| 阴影级别 | 变量 | 使用场景 |
|----------|------|----------|
| 无阴影 | (none) | 扁平元素、文字、内联控件 |
| 1 级 | `--shadow-sm` | 选项卡、轻微提升 |
| 2 级 | `--shadow-md` | 卡片 hover、工具提示 |
| 3 级 | `--shadow-lg` | 对话框、弹出菜单、模态框 |
| Fluent | `--shadow-fluent` | 默认卡片样式 |

## 圆角规范

统一的圆角规范确保界面一致性和专业感。

```css
--radius-sm: 4px;   /* 小型元素: 标签、小型按钮、输入框内边角 */
--radius-md: 8px;   /* 中型元素: 卡片、菜单项、下拉选项 */
--radius-lg: 12px;  /* 大型元素: 面板、模态框、对话框 */
--radius-xl: 16px;  /* 特大型元素: 页面容器、侧边栏 */
```

### 使用指南

| 圆角 | 元素大小 | 示例 |
|------|----------|------|
| `--radius-sm` | < 40px 高度 | 按钮、标签、输入框 |
| `--radius-md` | 40-80px 高度 | 卡片、列表项、菜单 |
| `--radius-lg` | 80-200px 高度 | 面板、对话框 |
| `--radius-xl` | > 200px 或全屏 | 侧边栏、页面容器 |

## 间距系统

基于 4px 基准的间距系统，确保元素间距统一。

```css
--space-xs: 4px;    /* 紧密间距: 图标与文字、标签内边距 */
--space-sm: 8px;    /* 小间距: 行内元素间距、紧凑卡片内边距 */
--space-md: 16px;   /* 中等间距: 卡片内边距、组件间距 */
--space-lg: 24px;   /* 大间距: 区块间距、页面内边距 */
--space-xl: 32px;   /* 超大间距: 页面外边距、大区块分隔 */
```

### 使用原则
- 优先使用 `--space-md` (16px) 作为默认间距
- 内边距 (padding) 和外边距 (margin) 使用同一套变量
- 不要自定义魔法数字 (如 `15px`, `17px`)

## 字体规范

```css
/* 字体族 (优先级递减) */
font-family: 'Segoe UI Variable', 'Segoe UI',
             -apple-system, BlinkMacSystemFont,
             system-ui, sans-serif;

/* 基础字号 */
font-size: 14px;

/* 行高 */
line-height: 1.5;

/* 字重 */
font-weight: 400;  /* 正常 */
font-weight: 500;  /* 中等 (标题) */
font-weight: 600;  /* 半粗 (强调) */
font-weight: 700;  /* 粗体 (重点) */
```

### 字号层级

| 用途 | 字号 | 字重 |
|------|------|------|
| 标题 (h1) | 24px | 600 |
| 标题 (h2) | 20px | 600 |
| 标题 (h3) | 16px | 600 |
| 正文 | 14px | 400 |
| 辅助文字 | 12px | 400 |
| 小字标注 | 11px | 400 |
