import { useEffect, useRef } from 'react'
import { useEvent } from './use-event'

/**
 * 可选引用符号
 * 用于标记某个ref是可选的，这样在所有ref都是可选的情况下，
 * 可以返回undefined而不是同步函数
 */
let Optional = Symbol()

/**
 * 创建一个可选的ref回调函数
 * 
 * @param cb ref回调函数
 * @param isOptional 是否可选，默认为true
 * @returns 带有Optional标记的回调函数
 */
export function optionalRef<T>(cb: (ref: T) => void, isOptional = true) {
  return Object.assign(cb, { [Optional]: isOptional })
}

/**
 * useSyncRefs - 同步多个refs的钩子
 * 
 * 这个钩子用于同时更新多个ref，通常用于需要同时支持组件内部ref和
 * 外部传入ref的场景。它可以处理多种类型的ref（对象形式和函数形式）。
 * 
 * 工作原理:
 * 1. 接收多个ref作为参数
 * 2. 返回一个统一的ref回调函数
 * 3. 当回调被调用时，同步更新所有ref
 * 4. 使用useEvent确保回调函数是稳定的
 * 
 * 特性:
 * - 支持对象形式的ref (React.MutableRefObject)
 * - 支持函数形式的ref (callback ref)
 * - 支持可选的ref (通过optionalRef标记)
 * - 在SSR和CSR中都能正常工作
 * 
 * 使用场景:
 * ```ts
 * function TextInput({ inputRef, ...props }) {
 *   // 内部ref，用于组件逻辑
 *   const internalRef = useRef(null)
 *   
 *   // 同步内部ref和外部传入的ref
 *   const syncedRef = useSyncRefs(internalRef, inputRef)
 *   
 *   return <input {...props} ref={syncedRef} />
 * }
 * ```
 * 
 * 高级用法:
 * ```ts
 * // 使用可选ref
 * const optionalExternalRef = optionalRef((el) => {
 *   // 只在需要时执行
 * })
 * 
 * const refs = useSyncRefs(
 *   internalRef,
 *   optionalExternalRef
 * )
 * ```
 * 
 * @template TType ref引用的元素类型
 * @param refs 要同步的refs数组
 * @returns 如果所有ref都是可选的，返回undefined；否则返回同步用的回调函数
 */
export function useSyncRefs<TType>(
  ...refs: (React.MutableRefObject<TType | null> | ((instance: TType) => void) | null)[]
) {
  // 缓存refs数组，避免不必要的更新
  let cache = useRef(refs)
  useEffect(() => {
    cache.current = refs
  }, [refs])

  // 创建一个稳定的同步函数
  let syncRefs = useEvent((value: TType) => {
    // 遍历并更新所有ref
    for (let ref of cache.current) {
      if (ref == null) continue
      if (typeof ref === 'function') ref(value)
      else ref.current = value
    }
  })

  // 如果所有ref都是可选的，返回undefined
  return refs.every(
    (ref) =>
      ref == null ||
      // @ts-expect-error - 访问Symbol属性
      ref?.[Optional]
  )
    ? undefined
    : syncRefs
}
