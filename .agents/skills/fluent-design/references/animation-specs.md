# 动画规范

## 目录
1. [缓动函数](#缓动函数)
2. [过渡动画](#过渡动画)
3. [关键帧动画](#关键帧动画)
4. [使用场景指南](#使用场景指南)

## 缓动函数

Fluent Design 使用 `cubic-bezier` 缓动函数，确保动画自然流畅。

```css
/* Fluent 标准缓动 - 所有动画的默认缓动 */
cubic-bezier(0.1, 0.9, 0.2, 1)

/* 等效 CSS ease-out 的简化版本 (用于简单过渡) */
ease-out
```

### 缓动特性
- 起始快速，结尾减速 → 给用户"已完成"的感觉
- 符合物理运动的自然规律
- 避免使用 `linear` (线性过渡不自然)

## 过渡动画

### CSS 变量定义

```css
--transition-fast: 100ms ease-out;
--transition-normal: 200ms ease-out;
--transition-smooth: 250ms cubic-bezier(0.1, 0.9, 0.2, 1);
```

### 使用指南

| 变量 | 时长 | 使用场景 |
|------|------|----------|
| `--transition-fast` | 100ms | hover 颜色变化、边框颜色、图标旋转 |
| `--transition-normal` | 200ms | 阴影变化、大小变化、显示/隐藏 |
| `--transition-smooth` | 250ms | 模态框打开/关闭、页面切换、元素出现 |

### 示例

```css
/* 快速 hover 效果 */
.button {
  transition: background var(--transition-fast),
              color var(--transition-fast),
              border-color var(--transition-fast);
}

/* 卡片 hover 提升效果 */
.fluent-card {
  transition: box-shadow var(--transition-normal),
              transform var(--transition-normal);
}

.fluent-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);  /* 轻微上浮 */
}

/* 模态框动画 */
.modal-overlay {
  transition: opacity var(--transition-smooth),
              visibility var(--transition-smooth);
}

.modal-content {
  transition: transform var(--transition-smooth),
              opacity var(--transition-smooth);
}
```

### 过渡属性选择

```css
/* ✅ 精确指定过渡属性 */
.element {
  transition: opacity var(--transition-normal),
              transform var(--transition-normal);
}

/* ❌ 避免：过渡所有属性 (性能差且不可预测) */
.element {
  transition: all var(--transition-normal);
}
```

## 关键帧动画

### fadeIn - 淡入

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn var(--transition-smooth) forwards;
}
```

**使用场景**: 模态框背景遮罩、工具提示、通知横幅

### slideUp - 从下方滑入

```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-up {
  animation: slideUp var(--transition-smooth) forwards;
}
```

**使用场景**: 弹出菜单、下拉选项、从底部弹出的面板

### scaleIn - 缩放进入

```css
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.scale-in {
  animation: scaleIn var(--transition-smooth) forwards;
}
```

**使用场景**: 模态框内容、对话框

### slideDown - 向下展开

```css
@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 500px;  /* 根据实际内容调整 */
  }
}

.slide-down {
  animation: slideDown var(--transition-normal) ease-out forwards;
  overflow: hidden;
}
```

**使用场景**: 手风琴展开、详情区域展开

### spin - 旋转 (加载指示器)

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spinner {
  animation: spin 1s linear infinite;
}
```

**使用场景**: 加载指示器、同步图标

## 使用场景指南

### 页面加载
```css
.page-enter-active {
  animation: fadeIn var(--transition-smooth);
}

.page-leave-active {
  animation: fadeIn var(--transition-normal) reverse;
}
```

### Vue Transition 组件

```html
<Transition name="modal">
  <div v-if="isVisible" class="modal-overlay">
    <div class="modal-content">
      <!-- 内容 -->
    </div>
  </div>
</Transition>
```

```css
.modal-enter-active {
  transition: opacity var(--transition-smooth);
}

.modal-leave-active {
  transition: opacity var(--transition-normal);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content {
  transition: transform var(--transition-smooth), opacity var(--transition-smooth);
}

.modal-enter-from .modal-content {
  transform: scale(0.95);
  opacity: 0;
}
```

### 列表动画

```css
.list-enter-active {
  transition: all var(--transition-normal);
}

.list-leave-active {
  transition: all var(--transition-fast);
}

.list-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

/* 列表项交错动画 */
.list-move {
  transition: transform var(--transition-normal);
}
```

### 禁止的动画模式

```css
/* ❌ 禁止：无缓动函数的过渡 */
transition: opacity 200ms;            /* 缺少 easing */

/* ❌ 禁止：过长或过短的动画 */
transition: opacity 1s;               /* 太慢 */
transition: opacity 10ms;             /* 太快 */

/* ❌ 禁止：性能差的动画属性 */
transition: left var(--transition-normal);  /* 触发 layout */
transition: width var(--transition-normal); /* 触发 layout */

/* ✅ 推荐：高性能动画属性 */
transition: transform var(--transition-normal);  /* GPU 加速 */
transition: opacity var(--transition-normal);    /* GPU 加速 */
```
