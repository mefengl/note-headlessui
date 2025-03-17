/**
 * Button 组件 - React示例应用的基础按钮组件
 * 
 * 这是一个经过样式增强的基础按钮组件，集成了以下特性：
 * 1. 默认样式：
 *    - 白色背景
 *    - 圆角边框
 *    - 灰色边框
 *    - 内边距适中
 * 2. 交互增强：
 *    - 焦点状态下的环形指示器
 *    - 焦点偏移效果
 *    - 清除默认outline
 * 3. 无障碍支持：
 *    - 正确的button类型
 *    - 保留原生按钮行为
 * 4. 功能支持：
 *    - 支持ref转发
 *    - 支持所有原生button属性
 *    - 支持自定义className
 * 
 * 使用示例：
 * ```jsx
 * <Button onClick={() => console.log('clicked')}>
 *   点击我
 * </Button>
 * 
 * <Button className="bg-blue-500 text-white">
 *   自定义样式
 * </Button>
 * ```
 */

import { ComponentProps, forwardRef, ReactNode } from 'react'

/**
 * 工具函数：合并CSS类名
 * 过滤掉假值并用空格连接
 */
function classNames(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Button组件
 * 使用forwardRef实现ref转发，支持外部获取按钮DOM引用
 */
export let Button = forwardRef<
  HTMLButtonElement,
  ComponentProps<'button'> & { children?: ReactNode }
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={classNames(
      'ui-focus-visible:ring-2 ui-focus-visible:ring-offset-2 flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 ring-gray-500 ring-offset-gray-100 focus:outline-none',
      className
    )}
    {...props}
  />
))
