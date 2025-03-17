/**
 * Headless UI Vue 入口文件
 * 
 * 本文件导出所有可用的Vue组件供外部使用。组件分类如下：
 * 
 * 复杂交互组件:
 * - Combobox: 可搜索的下拉选择框
 * - Dialog: 模态对话框
 * - Disclosure: 可展开/折叠的内容区域
 * - Listbox: 下拉选择框
 * - Menu: 下拉菜单
 * - Popover: 弹出层
 * - RadioGroup: 单选框组
 * - Switch: 开关按钮
 * - Tabs: 标签页
 * 
 * 功能性组件:
 * - Portal, PortalGroup: 传送门组件，用于将内容渲染到DOM树的其他位置
 * - FocusTrap: 焦点陷阱，用于限制键盘焦点在特定区域内
 * - Transition: 过渡动画
 * 
 * 与React版本的主要区别:
 * 1. 组件API遵循Vue的设计风格
 * 2. 使用v-model代替受控组件模式
 * 3. 更精简的组件集合，聚焦于最常用的交互组件
 * 4. 完整支持Vue的模板语法和响应式特性
 */

export * from './components/combobox/combobox'
export * from './components/dialog/dialog'
export * from './components/disclosure/disclosure'
export * from './components/focus-trap/focus-trap'
export * from './components/listbox/listbox'
export * from './components/menu/menu'
export * from './components/popover/popover'
export { Portal, PortalGroup } from './components/portal/portal'
export * from './components/radio-group/radio-group'
export * from './components/switch/switch'
export * from './components/tabs/tabs'
export * from './components/transitions/transition'
