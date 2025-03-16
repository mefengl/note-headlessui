import { useEffect, useLayoutEffect, type DependencyList, type EffectCallback } from 'react'
import { env } from '../utils/env'

/**
 * useIsoMorphicEffect - 同构效果钩子
 * 
 * 这是一个智能的效果钩子，可以根据执行环境自动选择合适的React效果钩子:
 * - 在服务器端使用 useEffect (避免SSR问题)
 * - 在客户端使用 useLayoutEffect (避免闪烁)
 * 
 * 背景:
 * - useLayoutEffect在SSR时会产生警告，因为它在服务器端无法正常工作
 * - 但在客户端，useLayoutEffect比useEffect更适合处理DOM操作，因为它是同步的
 * 
 * 使用场景:
 * 1. 需要在SSR应用中执行DOM操作
 * 2. 需要避免内容闪烁的场景
 * 3. 需要精确控制副作用执行时机
 * 
 * 示例:
 * ```ts
 * useIsoMorphicEffect(() => {
 *   // 此代码在服务器端会使用useEffect
 *   // 在客户端会使用useLayoutEffect
 *   updateDOM()
 * }, [deps])
 * ```
 * 
 * @param effect 要执行的副作用函数
 * @param deps 依赖数组，与React的效果钩子的deps参数行为一致
 */
export let useIsoMorphicEffect = (effect: EffectCallback, deps?: DependencyList | undefined) => {
  if (env.isServer) {
    useEffect(effect, deps)
  } else {
    useLayoutEffect(effect, deps)
  }
}
