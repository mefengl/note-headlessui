import { microTask } from './micro-task'

/** 导出类型以便在其他地方使用 */
export type Disposables = ReturnType<typeof disposables>

/**
 * disposables - 资源清理管理器
 * 
 * 这是一个用于管理需要清理的资源的系统，包括但不限于:
 * - 事件监听器
 * - 定时器
 * - 动画帧
 * - 微任务
 * - 样式修改
 * 
 * 核心特性:
 * 1. 自动化资源清理
 * 2. 链式API
 * 3. 分组管理
 * 4. 防重复注册
 * 
 * 使用场景:
 * ```ts
 * const d = disposables()
 * 
 * // 管理事件监听器
 * d.addEventListener(window, 'resize', onResize)
 * 
 * // 管理定时器
 * d.setTimeout(() => {}, 1000)
 * 
 * // 管理样式
 * d.style(element, 'display', 'none')
 * 
 * // 分组管理
 * d.group(group => {
 *   group.setTimeout(...)
 *   group.addEventListener(...)
 * })
 * 
 * // 清理所有资源
 * d.dispose()
 * ```
 */
export function disposables() {
  // 存储所有需要清理的回调函数
  let _disposables: Function[] = []

  // API对象，提供各种资源管理方法
  let api = {
    /**
     * 添加事件监听器
     * 自动处理事件移除，支持所有DOM事件类型
     */
    addEventListener<TEventName extends keyof WindowEventMap>(
      element: HTMLElement | Window | Document,
      name: TEventName,
      listener: (event: WindowEventMap[TEventName]) => any,
      options?: boolean | AddEventListenerOptions
    ) {
      element.addEventListener(name, listener as any, options)
      return api.add(() => element.removeEventListener(name, listener as any, options))
    },

    /**
     * 注册requestAnimationFrame
     * 自动处理取消动画帧
     */
    requestAnimationFrame(...args: Parameters<typeof requestAnimationFrame>) {
      let raf = requestAnimationFrame(...args)
      return api.add(() => cancelAnimationFrame(raf))
    },

    /**
     * 在下一帧执行
     * 确保有两帧的延迟
     */
    nextFrame(...args: Parameters<typeof requestAnimationFrame>) {
      return api.requestAnimationFrame(() => {
        return api.requestAnimationFrame(...args)
      })
    },

    /**
     * 注册setTimeout
     * 自动处理清除定时器
     */
    setTimeout(...args: Parameters<typeof setTimeout>) {
      let timer = setTimeout(...args)
      return api.add(() => clearTimeout(timer))
    },

    /**
     * 注册微任务
     * 提供取消机制
     */
    microTask(...args: Parameters<typeof microTask>) {
      let task = { current: true }
      microTask(() => {
        if (task.current) {
          args[0]()
        }
      })
      return api.add(() => {
        task.current = false
      })
    },

    /**
     * 临时修改样式
     * 自动恢复原始值
     */
    style(node: HTMLElement, property: string, value: string) {
      let previous = node.style.getPropertyValue(property)
      Object.assign(node.style, { [property]: value })
      return this.add(() => {
        Object.assign(node.style, { [property]: previous })
      })
    },

    /**
     * 创建资源分组
     * 方便管理相关的资源集合
     */
    group(cb: (d: typeof this) => void) {
      let d = disposables()
      cb(d)
      return this.add(() => d.dispose())
    },

    /**
     * 添加清理回调
     * 核心方法，其他所有方法都基于此实现
     * - 防止重复添加
     * - 返回取消函数
     */
    add(cb: () => void) {
      if (!_disposables.includes(cb)) {
        _disposables.push(cb)
      }
      return () => {
        let idx = _disposables.indexOf(cb)
        if (idx >= 0) {
          for (let dispose of _disposables.splice(idx, 1)) {
            dispose()
          }
        }
      }
    },

    /**
     * 执行所有清理工作
     * 清空并调用所有注册的清理函数
     */
    dispose() {
      for (let dispose of _disposables.splice(0)) {
        dispose()
      }
    },
  }

  return api
}
