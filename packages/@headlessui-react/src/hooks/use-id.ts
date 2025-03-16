/**
 * Re-export of React's useId hook
 * 
 * 这是对React内置useId钩子的简单重新导出。主要目的是:
 * 1. 在测试中可以更容易地mock这个钩子
 * 2. 统一组件库中id生成的来源
 * 3. 提供更好的向后兼容性(如果需要支持旧版本React)
 * 
 * 使用场景:
 * - 生成可访问性相关的唯一ID
 * - 连接label和表单控件
 * - 生成ARIA属性值
 */
export { useId } from 'react'
