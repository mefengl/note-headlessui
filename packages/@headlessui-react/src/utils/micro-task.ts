/**
 * microTask 微任务调度器
 * 
 * 提供一个跨浏览器的微任务调度解决方案:
 * 1. 优先使用原生 queueMicrotask API
 * 2. 降级使用 Promise 实现
 * 3. 包含错误处理
 * 
 * 使用场景:
 * - 需要在当前宏任务结束后立即执行的代码
 * - 需要比setTimeout更快的执行时机
 * - 需要确保跨浏览器兼容性的微任务调度
 * 
 * @param cb 要执行的回调函数
 */
export function microTask(cb: () => void) {
  if (typeof queueMicrotask === 'function') {
    // 使用原生API
    queueMicrotask(cb)
  } else {
    // Promise降级方案
    Promise.resolve()
      .then(cb)
      .catch((e) =>
        // 确保错误不会被静默吞掉
        setTimeout(() => {
          throw e
        })
      )
  }
}
