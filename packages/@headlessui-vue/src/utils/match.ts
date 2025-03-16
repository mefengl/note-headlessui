/**
 * match函数 - 模式匹配工具
 * 
 * 这是一个类型安全的模式匹配工具函数，用于处理类似于其他语言中的switch/match表达式的场景。
 * 与普通的switch语句相比，它提供了更好的类型推导和穷尽性检查。
 * 
 * 使用场景:
 * 1. 状态机转换
 * 2. 枚举值处理
 * 3. 策略模式实现
 * 
 * 类型参数:
 * @template TValue - 匹配值的类型，可以是字符串或数字
 * @template TReturnValue - 返回值的类型
 * 
 * 参数:
 * @param {TValue} value - 要匹配的值
 * @param {Record<TValue, TReturnValue | ((...args: any[]) => TReturnValue)>} lookup - 匹配规则字典
 * @param {...any[]} args - 如果匹配到的是函数，会传入这些额外参数
 * 
 * 返回值:
 * @returns {TReturnValue} - 匹配到的值或函数的返回值
 * 
 * 错误处理:
 * - 当找不到匹配值时，抛出详细的错误信息
 * - 使用Error.captureStackTrace优化错误堆栈
 * 
 * 示例:
 * ```typescript
 * // 在Vue组件中使用
 * const visibilityState = computed(() => {
 *   return match(menuState.value, {
 *     Open: () => ({ 'data-open': true }),
 *     Closed: () => ({ 'data-open': false })
 *   })
 * })
 * ```
 */
export function match<TValue extends string | number = string, TReturnValue = unknown>(
  value: TValue,
  lookup: Record<TValue, TReturnValue | ((...args: any[]) => TReturnValue)>,
  ...args: any[]
): TReturnValue {
  // 查找匹配规则
  if (value in lookup) {
    let returnValue = lookup[value]
    // 如果匹配到的是函数，则调用它并传入额外参数
    return typeof returnValue === 'function' ? returnValue(...args) : returnValue
  }

  // 没有找到匹配规则时，构造详细的错误信息
  let error = new Error(
    `Tried to handle "${value}" but there is no handler defined. Only defined handlers are: ${Object.keys(
      lookup
    )
      .map((key) => `"${key}"`)
      .join(', ')}.`
  )

  // 优化错误堆栈，移除match函数自身的帧
  if (Error.captureStackTrace) Error.captureStackTrace(error, match)
  
  throw error
}
