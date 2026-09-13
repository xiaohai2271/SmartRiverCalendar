---
name: fluent-design
description: SmartRiverCalendar项目 Fluent Design & Notion 顶奢融合美学规范。当需要设计UI界面、开发组件、调整样式、选择颜色/阴影/动效，或确保界面符合微软 Fluent System 与 Notion 极简物理悬浮美学时使用。
---

# ⚡ Fluent Design & Notion 顶奢融合美学规范

小河日历 (SmartRiverCalendar) 拒绝扁平乏味的 AI 草稿感界面。我们深度融合了 **Microsoft Fluent Design System** (物理光影、深度、亚克力高透材质) 与 **Notion** (去粗黑边框、自适应彩点药丸、无边界空气感排版) 的顶奢美学体系。

本规范用于指导任何智能体 (Agent) 编写出具备极佳呼吸感、精密秩序度与像素级交互手感的高级界面。

---

## 🌌 一、核心设计哲学：彻底“去 AI 劣质/草稿味”

AI 生成的草稿界面通常具有以下通病：高饱和度默认 Emoji 堆砌、生硬的通栏灰色分割线、死板的 input 实体粗黑边框、刺眼的大红大黄优先级块，以及内容局促、横向拉伸失调等。本规范通过以下核心策略进行彻底降噪与高级化：

### 1. 全局“去 Emoji 化”与统一 SVG 矢量线标
*   **严禁** 在统计卡片、导航栏、详情中直接使用系统 Emoji。
*   **必须** 替换为高精度的 **Fluent 矢量线描图标** (统一 1.5px/1.2px 描边与像素对齐)。
*   通过 `fill="none" stroke="currentColor"` 配合 CSS 变量实现图标颜色的**自适应智能继承**：
    ```css
    .nav-item.active { background: var(--accent-color); color: white; }
    .nav-item.active svg { color: white; filter: drop-shadow(0 1px 2px rgba(255, 255, 255, 0.2)); }
    ```

### 2. 无边界空气感排版 (Borderless Air Layout)
*   **禁止** 使用生硬的灰色分割线 (如 `border-bottom: 1px solid #ddd`) 进行列表条目横向切割，这会产生极度压抑的“账单报表感”。
*   **必须** 采用 **气泡嵌套微光容器 (Nested Air Containers)**：条目赋予 12px+ 圆角，条目之间以 **`4px` - `6px` 的空气间距** 进行自然隔开，使条目像轻质气泡一样精致地浮现于带有 1px 极细微光边界的半透明容器内部。

### 3. 零边框输入域 (Zero-border Focus Line)
*   **禁止** 使用死板的四边实体矩形边框作为文本框。
*   **建议** 标题/核心输入域使用 **透明背景且无实体框**。在 Focus 聚焦时，底部利用 CSS 优雅滑入一条 `1.5px` 的 Accent 强调色高亮亮条，拉满呼吸感。

### 4. 莫兰迪空气感药丸与 Badge 体系 (Acrylic Chroma Badges)
*   农历、节假日、状态等 Badge **禁止** 填充大红大绿的高饱和度实色。
*   **必须** 采用半透明炫彩玻璃态 Badge，背景使用 `color-mix` 调和 8% - 10% 对应主题色，字体为精致的 11px 加粗，辅以 1px 半透明极细边界。

---

## 🎨 二、交互回响与物理微动效 (Dynamic Interaction)

 premium 界面与普通界面的核心区别在于**交互的反馈回响**。界面必须是灵动、自适应并带有弹性物理触感的。

### 1. CSS `color-mix` 专属日历色彩发光
*   不要使用固定的灰色 hover。对于日程等条目，鼠标悬停时应利用 `color-mix` **动态混合其所属日历色，在整行平滑晕染出 `4%` 强度的专属柔和微光**：
    ```css
    .event-item:hover {
      background: color-mix(in srgb, var(--calendar-color) 4%, var(--bg-secondary));
      border-color: color-mix(in srgb, var(--calendar-color) 25%, var(--border-color));
      box-shadow: var(--shadow-md), 0 4px 12px color-mix(in srgb, var(--calendar-color) 6%, transparent);
    }
    ```
*   同时，左侧指示指示条 (Ribbon) 动态由 `3.5px` 圆润拓宽至 `5.5px` - `6px`。

### 2. 物理弹性微位移 (Hover Translate & Scale)
*   卡片在 Hover 时，一律实施 **`translateY(-2px)`** 的物理向上微升，并伴随图标 **`scale(1.08)`** 动态变大，营造出浮于屏幕上的精美悬浮感。
*   **原位快捷 Chevron 箭头与避让**：在列表条目右端悬挂快捷进入小箭头 (Chevron Line)，平时隐藏，Hover 时以 `cubic-bezier(0.1, 0.9, 0.2, 1)` 动效平滑从左向右滑入并淡入，同时将原位置的其他小 Badge 轻微向左平移 `2px` 进行动态避让。

### 3. 弹性打勾动效 (Spring Check Easing)
*   待办复选框打勾完成时，SVG 的 check-mark 路径应通过 CSS 触发弹性回弹动画 (Spring Easing)，并在一瞬间平滑对标题施加淡出与删除线，赋予用户极大的完成成就感。

---

## 📐 三、黄金比例 Dashboard 与底部像素级平齐规范

单列细长或左右落差巨大的界面会产生极度难受的杂乱感。

### 1. 自适应 Dashboard 双栏网格 (Responsive Grid)
*   登录/未登录状态，容器限制在居中精致的 `480px`。
*   已登录的大面板界面，最大宽度一律拓宽至 **`900px`** 黄金视觉尺寸。
*   在宽屏下启用 **`1.1fr 0.9fr` 双列响应式网格**，左侧放用户信息/大看板，右侧放同步/快速卡片。

### 2. 底部等高绝对平齐与弹性沉底 (Equal-height Stretch & Flex Push)
*   双列网格必须强制启用 **`align-items: stretch`** 实现物理等高。
*   **左侧卡片拉满**：`.dashboard-left > * { flex: 1; display: flex; flex-direction: column; }`。
*   **右侧底卡拉满**：`.dashboard-right > :last-child { flex: 1; display: flex; flex-direction: column; }` 从而让右下角的卡片底部刚好在横向上顶到最下端。
*   **按钮弹性沉底秘籍 (Flex Push)**：左侧卡片的底部操作按钮 `.profile-actions` 一律应用 **`margin-top: auto`**，这样在高度拉伸时，不论内容多寡，底部的操作按钮均会**自动沉底，达成底部像素级水平平齐**！

### 3. 退出登录精致限宽
*   退出/主要辅助性长按钮 **严禁** 100% 撑满 900px。
*   **必须** 使用 **`max-width: 240px; margin: 0 auto;`** 进行精致缩限与自动居中对齐，采用半透明微红边界线，彻底消除失调的拉伸感。

---

## ⚡ 四、亚克力高透与 1px 极光描边 (Acrylic & Border)

*   **亚克力毛玻璃 (Super Acrylic)**：精简月历、Reminders 等悬浮弹窗一律使用 30px 超深毛玻璃：
    ```css
    background: rgba(var(--bg-secondary-rgb), 0.7);
    backdrop-filter: blur(30px) saturate(190%);
    ```
*   **1px 极细极光描边 (Polar Borders)**：卡片与浮窗统一追加 **`1px solid var(--border-color)`** (在深色模式下使用微妙高光，在浅色模式下提供轮廓边界)，彻底拒绝任何生硬的粗线边框。

---

## 🧪 五、CSS 秘密武器库 (CSS Toolkit)

```css
/* 圆角系统 */
--radius-sm: 6px;    /* 按钮、小输入框 */
--radius-md: 10px;   /* 中型选项、列表项 */
--radius-lg: 12px;   /* 小卡片 */
--radius-xl: 16px;   /* 大容器、Dashboard卡片 */

/* 缓动动效 */
--transition-fast: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
--transition-smooth: 0.25s cubic-bezier(0.1, 0.9, 0.2, 1); /* 黄金贝塞尔弹性曲线 */

/* Notion 药丸滑轨胶囊切换器 (Capsule switch track) */
.capsule-switcher-track {
  display: flex;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 2px;
}
.capsule-item.active {
  background: var(--bg-secondary);
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  border-radius: 18px;
  color: var(--accent-color);
}
```

---

## 📝 六、开发审查终极清单 (Checklist for Agents)

*   [ ] **图标自查**：页面中是否还残留系统 Emoji 或彩色高饱和图标？如果有，一律替换为 Fluent 线描 SVG 图标。
*   [ ] **线框自查**：是否使用了传统的 input 闭合实体黑框？如果有，一律升级为零边框底线聚焦高亮动效。
*   [ ] **对齐自查**：双列 Dashboard 的底部高度是否齐平？UserProfile 底部操作按钮是否加了 `margin-top: auto` 进行物理沉底？
*   [ ] **色彩自查**：待办与日程的优先级/日历背景是否过于刺眼？Hover 时是否通过 `color-mix` 自适应混合出了优雅的 4% 专属色彩微光？
*   [ ] **退出按钮自查**：退出登录等单体操作按钮是否过宽？是否应用了 `max-width: 240px; margin: 0 auto;`？
*   [ ] **磨砂自查**：悬浮通知或精简月历窗是否应用了 `backdrop-filter: blur(30px) saturate(190%)` 的 1px 极光描边亚克力高透效果？
