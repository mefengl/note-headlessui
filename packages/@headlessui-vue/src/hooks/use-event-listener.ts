/**
 * use-event-listener.ts - Vue3的事件监听器Hook
 * 
 * 这个Hook让我们可以优雅地在Vue组件中添加事件监听器，并且自动处理清理工作。
 * 
 * 为什么需要它？
 * 1. 直接使用addEventListener要手动管理清理
 * 2. 需要在组件卸载时移除监听器避免内存泄露
 * 3. 在服务器端渲染(SSR)时需要跳过事件绑定
 * 
 * 工作原理：
 * 1. 使用watchEffect自动追踪依赖
 * 2. 在回调函数中添加事件监听
 * 3. 在清理函数中移除监听器
 * 4. 自动跳过服务器端执行
 * 
 * 使用示例：
 * ```vue
 * <script setup>
 * import { useEventListener } from '@headlessui/vue'
 * import { ref } from 'vue'
 * 
 * // 1. 简单的窗口点击监听
 * useEventListener(window, 'click', (event) => {
 *   console.log('点击位置：', event.clientX, event.clientY)
 * })
 * 
 * // 2. 监听特定元素
 * const buttonRef = ref(null)
 * useEventListener(buttonRef, 'mouseenter', () => {
 *   console.log('鼠标进入按钮')
 * })
 * 
 * // 3. 使用选项
 * useEventListener(window, 'scroll', 
 *   () => console.log('滚动中...'),
 *   { passive: true } // 提高滚动性能
 * )
 * </script>
 * ```
 * 
 * TypeScript支持：
 * 使用WindowEventMap类型确保事件名称和回调函数的类型安全
 */

import { watchEffect } from 'vue'
import { env } from '../utils/env'

/**
 * useEventListener - 添加事件监听器的Hook
 * 
 * @param element - 要监听的元素。如果为null/undefined则默认使用window
 * @param type - 事件类型，比如'click'、'scroll'等
 * @param listener - 事件处理函数
 * @param options - addEventListener的选项：
 *                 - 可以是布尔值（useCapture）
 *                 - 或配置对象（passive/capture/once）
 * 
 * 注意：
 * 1. 在服务器端会自动跳过（SSR安全）
 * 2. 监听器会在以下情况自动移除：
 *    - 组件卸载时
 *    - 依赖项变化时
 *    - watchEffect重新运行时
 */
export function useEventListener<TType extends keyof WindowEventMap>(
  element: HTMLElement | Document | Window | EventTarget | null | undefined,
  type: TType,
  listener: (event: WindowEventMap[TType]) => any,
  options?: boolean | AddEventListenerOptions
) {
  // 服务器端直接返回
  if (env.isServer) return

  // 使用watchEffect自动管理事件监听器的生命周期
  watchEffect((onInvalidate) => {
    // 如果没有指定元素，则使用window
    element = element ?? window
    
    // 添加事件监听器
    // 使用 as any 是因为TypeScript的事件类型定义限制
    element.addEventListener(type, listener as any, options)
    
    // 返回清理函数，在以下情况会被调用：
    // 1. watchEffect重新运行前
    // 2. 组件卸载时
    onInvalidate(() => element!.removeEventListener(type, listener as any, options))
  })
}
