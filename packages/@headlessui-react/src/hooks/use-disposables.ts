import { useEffect, useState } from 'react'
import { disposables } from '../utils/disposables'

/**
 * useDisposables - React资源管理钩子
 * 
 * 将disposables系统集成到React组件的生命周期中。在组件卸载时
 * 自动执行所有注册的清理函数。
 * 
 * 工作原理:
 * 1. 使用useState创建disposables实例(而不是useRef，以便使用初始化函数)
 * 2. 使用useEffect注册组件卸载时的清理
 * 3. 返回disposables实例供组件使用
 * 
 * 使用示例:
 * ```tsx
 * function Modal() {
 *   const d = useDisposables()
 *   
 *   useEffect(() => {
 *     // 注册事件，会在组件卸载时自动清理
 *     d.addEventListener(window, 'keydown', onKeyDown)
 *     
 *     // 设置样式，会在组件卸载时自动恢复
 *     d.style(document.body, 'overflow', 'hidden')
 *   }, [])
 *   
 *   return <div>...</div>
 * }
 * ```
 * 
 * @returns Disposables实例，包含各种资源管理方法
 */
export function useDisposables() {
  // 使用useState而不是useRef，这样可以利用其初始化函数特性
  let [d] = useState(disposables)

  // 组件卸载时执行清理
  useEffect(() => () => d.dispose(), [d])

  return d
}
