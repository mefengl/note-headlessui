/**
 * Headless UI React 入口文件
 * 
 * 本文件导出所有可用的React组件供外部使用。组件分类如下：
 * 
 * 基础交互组件:
 * - Button: 基础按钮组件
 * - Checkbox: 复选框
 * - CloseButton: 关闭按钮
 * - Input: 输入框
 * - Textarea: 文本域
 * 
 * 复杂交互组件:
 * - Combobox: 可搜索的下拉选择框
 * - Dialog: 模态对话框
 * - Disclosure: 可展开/折叠的内容区域
 * - Listbox: 下拉选择框
 * - Menu: 下拉菜单
 * - Popover: 弹出层
 * - RadioGroup: 单选框组
 * - Select: 选择框
 * - Switch: 开关按钮
 * - Tabs: 标签页
 * 
 * 表单相关:
 * - Field: 表单字段容器
 * - Fieldset: 字段集
 * - Label: 标签
 * - Legend: 字段集标题
 * 
 * 功能性组件:
 * - Portal: 传送门组件，用于将内容渲染到DOM树的其他位置
 * - FocusTrap: 焦点陷阱，用于限制键盘焦点在特定区域内
 * - Transition: 过渡动画
 * 
 * 注意：Tooltip组件目前还在开发中
 */

export * from './components/button/button'
export * from './components/checkbox/checkbox'
export * from './components/close-button/close-button'
export * from './components/combobox/combobox'
export * from './components/data-interactive/data-interactive'
export { Description, type DescriptionProps } from './components/description/description'
export * from './components/dialog/dialog'
export * from './components/disclosure/disclosure'
export * from './components/field/field'
export * from './components/fieldset/fieldset'
export * from './components/focus-trap/focus-trap'
export * from './components/input/input'
export { Label, type LabelProps } from './components/label/label'
export * from './components/legend/legend'
export * from './components/listbox/listbox'
export * from './components/menu/menu'
export * from './components/popover/popover'
export { Portal } from './components/portal/portal'
export * from './components/radio-group/radio-group'
export * from './components/select/select'
export * from './components/switch/switch'
export * from './components/tabs/tabs'
export * from './components/textarea/textarea'
export { useClose } from './internal/close-provider'
// TODO: Enable when ready
// export * from './components/tooltip/tooltip'
export * from './components/transition/transition'
