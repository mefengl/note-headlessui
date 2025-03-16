import { useEffect } from 'react'
import { useLatestValue } from './use-latest-value'

/**
 * useDocumentEvent - 类型安全的document事件监听钩子
 * 
 * 提供一个类型安全的方式来添加document事件监听器，常用于需要
 * 在整个文档范围内监听事件的场景，比如全局快捷键或点击检测。
 * 
 * 特性:
 * 1. 完整的TypeScript类型推导
 * 2. 自动清理事件监听器
 * 3. 支持启用/禁用
 * 4. 总是访问最新的回调函数
 * 
 * 使用场景:
 * ```ts
 * // 全局键盘快捷键
 * useDocumentEvent(
 *   true,
 *   'keydown',
 *   (event) => {
 *     if (event.key === 'Escape') {
 *       // 处理ESC键
 *     }
 *   }
 * )
 * 
 * // 全局点击检测
 * useDocumentEvent(
 *   true,
 *   'mousedown',
 *   (event) => {
 *     // 处理document级别的点击
 *   },
 *   { capture: true } // 使用捕获阶段
 * )
 * ```
 * 
 * 注意:
 * - 与useWindowEvent不同，这个钩子监听document而不是window
 * - 适用于需要在事件冒泡到document之前捕获事件的场景
 * 
 * @param enabled 是否启用事件监听
 * @param type 事件类型，必须是DocumentEventMap中的key
 * @param listener 事件处理函数
 * @param options 事件监听选项
 */
export function useDocumentEvent<TType extends keyof DocumentEventMap>(
  enabled: boolean,
  type: TType,
  listener: (ev: DocumentEventMap[TType]) => any,
  options?: boolean | AddEventListenerOptions
) {
  // 保存最新的回调函数引用
  let listenerRef = useLatestValue(listener)

  // 设置和清理事件监听器
  useEffect(() => {
    if (!enabled) return

    function handler(event: DocumentEventMap[TType]) {
      listenerRef.current(event)
    }

    document.addEventListener(type, handler, options)
    return () => document.removeEventListener(type, handler, options)
  }, [enabled, type, options])
}
