---
name: fluent-design
description: SmartRiverCalendar项目 Fluent Design 设计规范。当需要设计UI界面、开发组件、调整样式、选择颜色/阴影/动画或确保界面符合微软 Fluent Design System 时使用。包含设计令牌(CSS变量)、组件规范、动画规范、主题系统、亚克力效果等。
---

# Fluent Design 设计规范

## 概述

小河日历严格遵循 **Microsoft Fluent Design System**，提供现代化、一致且美观的界面体验。

## 核心原则

- **光影 (Light)**: 使用微妙的阴影和高光表达层次关系
- **深度 (Depth)**: 通过 z-index 和阴影创建视觉层次
- **动效 (Motion)**: 所有交互都有平滑的过渡动画
- **材质 (Material)**: 使用亚克力 (Acrylic) 和云母 (Mica) 效果
- **缩放 (Scale)**: 响应式设计，适配不同屏幕尺寸

## 规范参考

### 1. 设计令牌 (Design Tokens)
- CSS 颜色变量 (浅色/深色)
- 阴影系统 (4 层级)
- 间距系统 (5 层级)
- 圆角规范 (4 层级)
- **详细文档**: 参考 [references/design-tokens.md](references/design-tokens.md)

### 2. 组件规范
- 卡片 (`.fluent-card`)
- 按钮 (`.fluent-button`)
- 输入框 (`.fluent-input`)
- 滚动条 (自定义 Fluent 风格)
- 亚克力效果
- **详细文档**: 参考 [references/component-specs.md](references/component-specs.md)

### 3. 动画规范
- 过渡动画 (3 种时长)
- 关键帧动画 (fadeIn, slideUp, scaleIn)
- 缓动函数
- **详细文档**: 参考 [references/animation-specs.md](references/animation-specs.md)

## 快速参考

### 设计令牌速查

```css
/* 圆角 */
--radius-sm: 4px    /* 按钮、输入框 */
--radius-md: 8px    /* 卡片、菜单项 */
--radius-lg: 12px   /* 面板、模态框 */
--radius-xl: 16px   /* 容器 */

/* 间距 */
--space-xs: 4px
--space-sm: 8px
--space-md: 16px
--space-lg: 24px
--space-xl: 32px

/* 动画 */
--transition-fast: 100ms ease-out
--transition-normal: 200ms ease-out
--transition-smooth: 250ms cubic-bezier(0.1, 0.9, 0.2, 1)
```

### 组件速查

| 组件 | CSS 类 | 关键特性 |
|------|--------|----------|
| 卡片 | `.fluent-card` | 阴影 + 圆角 + hover 动效 |
| 按钮 | `.fluent-button` | 支持 primary/danger 变体 |
| 输入框 | `.fluent-input` | 聚焦时强调色边框 + 光晕 |
| 亚克力 | `backdrop-filter` | blur(20px) saturate(180%) |

### 主题模式
- **浅色**: `.light` 或系统默认
- **深色**: `.dark`
- **自动**: 跟随 `prefers-color-scheme`

### 开发检查清单
- [ ] 使用 CSS 变量定义颜色、阴影、圆角
- [ ] 实现浅色/深色主题支持
- [ ] 添加适当的过渡动画
- [ ] 使用正确的阴影层级
- [ ] 保持一致的圆角规范
- [ ] 支持键盘导航
- [ ] 测试不同主题下的显示效果
