import * as React from 'react'
import { env } from '../utils/env'

/**
 * useIsHydratingInReact18
 * 
 * 检测React 18中的水合状态
 * 
 * 背景:
 * - React 18之前，没有官方API来检测水合状态
 * - React 18引入了useSyncExternalStore，可以用来检测水合
 * - 需要特殊处理Suspense边界的水合情况
 * 
 * 实现细节:
 * 1. 使用动态导入避免打包工具报错
 * 2. 利用useSyncExternalStore的服务端/客户端值不同来检测水合
 * 3. 做了向后兼容处理(React < 18)
 * 
 * @returns {boolean} true表示当前在React 18中进行水合
 */
function useIsHydratingInReact18(): boolean {
  let isServer = typeof document === 'undefined'

  // React 18之前的版本直接返回false
  if (!('useSyncExternalStore' in React)) {
    return false
  }

  // 动态获取useSyncExternalStore以避免打包问题
  const useSyncExternalStore = ((r) => r.useSyncExternalStore)(React)

  // 利用useSyncExternalStore检测水合状态
  // 服务端返回false，客户端返回true
  // @ts-ignore - TS不能正确推导动态导入的类型
  let result = useSyncExternalStore(
    () => () => {},      // 订阅函数(未使用)
    () => false,         // 客户端获取函数
    () => (isServer ? false : true)  // 服务端获取函数
  )

  return result
}

/**
 * useServerHandoffComplete
 * 
 * 检测服务端渲染到客户端的交接是否完成
 * 
 * 使用场景:
 * 1. 需要等待水合完成才能执行的操作
 * 2. 避免SSR期间的渲染差异
 * 3. 处理Suspense边界的水合
 * 
 * 工作原理:
 * 1. 使用React 18的水合检测
 * 2. 维护内部的complete状态
 * 3. 通知env系统水合完成
 * 4. 支持测试环境的状态重置
 * 
 * 注意:
 * - 这个hook未来可能会被移除，因为React 18提供了更好的方案
 * - 在测试环境中会有特殊处理
 * 
 * @returns {boolean} true表示服务端交接已完成
 */
export function useServerHandoffComplete() {
  // 检查React 18的水合状态
  let isHydrating = useIsHydratingInReact18()

  // 从env系统获取初始状态
  let [complete, setComplete] = React.useState(env.isHandoffComplete)

  // 测试环境特殊处理
  if (complete && env.isHandoffComplete === false) {
    // 在测试中重置状态
    // 这违反了React的规则，但在测试中是可接受的
    setComplete(false)
  }

  // 确保状态最终会变为完成
  React.useEffect(() => {
    if (complete === true) return
    setComplete(true)
  }, [complete])

  // 通知env系统交接完成
  React.useEffect(() => env.handoff(), [])

  // 水合过程中返回false
  if (isHydrating) {
    return false
  }

  return complete
}
