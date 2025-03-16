import React from 'react'
import { useLatestValue } from './use-latest-value'

/**
 * useEvent - 稳定的事件处理器钩子
 * 
 * 这个钩子是对未来React.useEvent的临时实现。它提供了一个稳定的函数引用，
 * 但内部总是能访问到最新的回调函数。这解决了useCallback的一些限制。
 * 
 * 工作原理:
 * 1. 使用useLatestValue保存最新的回调函数
 * 2. 返回一个稳定的函数引用(通过useCallback)
 * 3. 稳定函数内部调用最新的回调
 * 
 * 优势:
 * 1. 不需要在依赖数组中包含回调函数
 * 2. 不会导致不必要的重渲染
 * 3. 总是能访问到最新的props和state
 * 
 * 使用场景:
 * ```ts
 * function SearchBox({ onSearch }) {
 *   const handleSearch = useEvent((query) => {
 *     // 这里总是能访问到最新的onSearch，无需添加依赖
 *     onSearch(query)
 *   })
 * 
 *   return <input onChange={handleSearch} />
 * }
 * ```
 * 
 * 注意:
 * - 这是一个临时实现，未来会被React的官方useEvent替代
 * - 不要在这个函数中使用state setter，因为它可能导致不一致
 * 
 * @template F 函数类型
 * @template P 函数参数类型数组
 * @template R 函数返回值类型
 * @param cb 要包装的回调函数
 * @returns 稳定的函数引用
 */
export let useEvent =
  // TODO: Add React.useEvent ?? once the useEvent hook is available
  function useEvent<
    F extends (...args: any[]) => any,
    P extends any[] = Parameters<F>,
    R = ReturnType<F>,
  >(cb: (...args: P) => R) {
    // 使用useLatestValue保存最新的回调函数
    let cache = useLatestValue(cb)

    // 返回一个稳定的函数，它会调用最新的回调
    return React.useCallback((...args: P) => cache.current(...args), [cache])
  }
