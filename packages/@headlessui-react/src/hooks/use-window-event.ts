import { useEffect } from 'react'
import { useLatestValue } from './use-latest-value'

/**
 * useWindowEvent - 类型安全的window事件监听钩子
 * 
 * 提供一个类型安全的方式来添加window事件监听器，自动处理清理和
 * 最新回调函数的访问。支持所有WindowEventMap中定义的事件类型。
 * 
 * 特性:
 * 1. 完整的TypeScript类型推导
 * 2. 自动清理事件监听器
 * 3. 支持启用/禁用
 * 4. 总是访问最新的回调函数
 * 
 * 使用示例:
 * ```ts
 * // 监听窗口大小变化
 * useWindowEvent(
 *   true, // enabled
 *   'resize',
 *   (event) => {
 *     // event 被正确类型推导为 UIEvent
 *     console.log(window.innerWidth)
 *   }
 * )
 * 
 * // 带选项的事件监听
 * useWindowEvent(
 *   true,
 *   'scroll',
 *   (event) => {},
 *   { passive: true }
 * )
 * ```
 * 
 * @param enabled 是否启用事件监听
 * @param type 事件类型，必须是WindowEventMap中的key
 * @param listener 事件处理函数
 * @param options 事件监听选项
 */
export function useWindowEvent<TType extends keyof WindowEventMap>(
  enabled: boolean,
  type: TType,
  listener: (ev: WindowEventMap[TType]) => any,
  options?: boolean | AddEventListenerOptions
) {
  // 保存最新的回调函数引用
  let listenerRef = useLatestValue(listener)

  // 设置和清理事件监听器
  useEffect(() => {
    if (!enabled) return

    function handler(event: WindowEventMap[TType]) {
      listenerRef.current(event)
    }

    window.addEventListener(type, handler, options)
    return () => window.removeEventListener(type, handler, options)
  }, [enabled, type, options])
}
