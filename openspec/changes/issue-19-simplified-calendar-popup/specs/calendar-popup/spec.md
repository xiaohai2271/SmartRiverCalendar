## ADDED Requirements

### Requirement: 系统时钟区域点击触发弹出窗口
系统 SHALL 在用户点击系统时钟区域时，在 200ms 内显示精简日历弹出窗口。

#### Scenario: 点击时钟区域成功显示弹出窗口
- **GIVEN** 应用已启动且系统托盘集成已就绪
- **WHEN** 用户点击 Windows 系统时钟区域
- **THEN** 弹出窗口 SHALL 在 200ms 内显示在任务栏上方

#### Scenario: 再次点击时钟区域隐藏弹出窗口
- **GIVEN** 弹出窗口当前处于显示状态
- **WHEN** 用户再次点击系统时钟区域
- **THEN** 弹出窗口 SHALL 立即隐藏

### Requirement: 弹出窗口三段式布局
弹出窗口 SHALL 采用三段式布局：日期信息区、月份导航区、日历面板区。

#### Scenario: 日期信息区显示完整信息
- **GIVEN** 弹出窗口已显示
- **WHEN** 用户查看日期信息区
- **THEN** 系统 SHALL 显示当前时间（HH:MM:SS 格式）、公历日期、农历日期、节假日/节气标识

#### Scenario: 月份导航区支持切换
- **GIVEN** 弹出窗口已显示
- **WHEN** 用户点击上/下月切换按钮
- **THEN** 日历面板 SHALL 切换到对应月份并刷新显示

### Requirement: 农历和节假日显示
系统 SHALL 在日历面板中显示农历日期、节假日标识和节气信息。

#### Scenario: 节假日日期突出显示
- **GIVEN** 当前月份包含法定节假日（如春节、国庆）
- **WHEN** 用户查看日历面板
- **THEN** 节假日日期 SHALL 使用特殊颜色标签突出显示

#### Scenario: 调休补班日显示提醒
- **GIVEN** 当前月份包含调休上班日期
- **WHEN** 用户查看日历面板
- **THEN** 调休日期 SHALL 显示补班提醒标识

### Requirement: 右键菜单快捷操作
日历面板 SHALL 提供右键菜单，包含创建日程、查看日程、创建待办、查看待办等快捷操作。

#### Scenario: 右键日期显示菜单
- **GIVEN** 弹出窗口已显示且日历面板可见
- **WHEN** 用户右键点击某个日期
- **THEN** 系统 SHALL 在点击位置附近显示上下文菜单

#### Scenario: 选择创建日程跳转主界面
- **GIVEN** 右键菜单已显示
- **WHEN** 用户选择"创建日程"菜单项
- **THEN** 系统 SHALL 打开主界面并跳转到日程创建页面，日期预设为右键点击的日期

### Requirement: 键盘快捷键支持
弹出窗口 SHALL 支持键盘导航：Escape 关闭、方向键切换月份/选择日期、Enter 确认。

#### Scenario: Escape 键关闭窗口
- **GIVEN** 弹出窗口已显示
- **WHEN** 用户按下 Escape 键
- **THEN** 弹出窗口 SHALL 立即关闭

#### Scenario: 方向键切换月份
- **GIVEN** 弹出窗口已显示
- **WHEN** 用户按下左/右方向键
- **THEN** 日历面板 SHALL 切换到上/下月

### Requirement: 失焦自动隐藏
弹出窗口 SHALL 在失去焦点时自动隐藏。

#### Scenario: 点击窗口外部自动关闭
- **GIVEN** 弹出窗口已显示
- **WHEN** 用户点击窗口外部任意位置
- **THEN** 弹出窗口 SHALL 自动隐藏

#### Scenario: 点击窗口内部保持显示
- **GIVEN** 弹出窗口已显示
- **WHEN** 用户点击窗口内部元素（如按钮、日期格子）
- **THEN** 弹出窗口 SHALL 保持显示状态

### Requirement: 设置界面配置项
系统 SHALL 在设置界面提供弹出窗口显示选项：农历显示、节假日显示、日程事件标记、首日设置。

#### Scenario: 用户可配置农历显示开关
- **GIVEN** 用户打开设置界面
- **WHEN** 用户切换"显示农历"选项
- **THEN** 弹出窗口 SHALL 根据设置显示或隐藏农历信息