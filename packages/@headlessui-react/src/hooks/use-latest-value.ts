import { useRef } from 'react'
import { useIsoMorphicEffect } from './use-iso-morphic-effect'

/**
 * useLatestValue - 始终获取最新值的钩子
 * 
 * 这个钩子用于在闭包中始终访问最新的值，避免闭包陈旧问题。
 * 它与React.useRef不同的是，它会自动更新ref的值。
 * 
 * 工作原理:
 * 1. 使用useRef存储值
 * 2. 使用useIsoMorphicEffect在值变化时更新
 * 
 * 使用场景:
 * 1. 在事件处理器中访问最新的props或state
 * 2. 在异步操作中获取最新值
 * 3. 在自定义hooks中保持值的最新状态
 * 
 * 示例:
 * ```ts
 * function Counter({ onChange }) {
 *   // 在任何闭包中都能获取到最新的onChange
 *   const latestOnChange = useLatestValue(onChange)
 *   
 *   useEffect(() => {
 *     const timer = setInterval(() => {
 *       // 即使组件重新渲染，这里也总是能获取到最新的onChange
 *       latestOnChange.current(Date.now())
 *     }, 1000)
 *     return () => clearInterval(timer)
 *   }, [])
 * }
 * ```
 * 
 * @param value 要追踪的值
 * @returns 包含最新值的ref对象
 */
export function useLatestValue<T>(value: T) {
  // 创建一个ref存储值
  let cache = useRef(value)

  // 使用useIsoMorphicEffect确保在SSR和CSR中都能正常工作
  useIsoMorphicEffect(() => {
    cache.current = value
  }, [value])

  return cache
}
