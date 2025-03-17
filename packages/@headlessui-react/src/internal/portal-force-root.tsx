/**
 * portal-force-root.tsx - Portal根节点强制控制系统
 * 
 * 这个模块解决了Portal渲染位置的控制问题：
 * 1. 默认情况下，Portal会渲染到document.body
 * 2. 但有时我们需要强制Portal渲染到特定位置
 * 3. 比如在Shadow DOM或iframe中使用时
 * 
 * 工作原理：
 * - 使用React Context在组件树中传递一个布尔标志
 * - 当标志为true时，Portal将保持在当前DOM树中
 * - 当标志为false时，Portal使用默认行为
 * 
 * 使用示例：
 * ```tsx
 * // 1. 默认行为 - Portal渲染到body
 * function App() {
 *   return (
 *     <div>
 *       <Dialog> // 会被传送到document.body
 *         弹窗内容
 *       </Dialog>
 *     </div>
 *   )
 * }
 * 
 * // 2. 强制保持在当前树
 * function ShadowDOMApp() {
 *   return (
 *     <ForcePortalRoot force={true}>
 *       <div>
 *         <Dialog> // 会保持在当前Shadow DOM中
 *           弹窗内容
 *         </Dialog>
 *       </div>
 *     </ForcePortalRoot>
 *   )
 * }
 * ```
 */

import React, { createContext, useContext, type ReactNode } from 'react'

// 创建Context，默认值为false（使用默认的Portal行为）
let ForcePortalRootContext = createContext(false)

/**
 * usePortalRoot - 获取Portal根节点控制标志的Hook
 * 
 * @returns boolean - 是否强制Portal保持在当前树中
 * 
 * 使用场景：
 * 1. 在Portal组件内部使用
 * 2. 需要动态决定渲染位置时
 * 3. 在自定义组件中控制Portal行为
 * 
 * 小朋友们可以这样理解：
 * 想象你在玩积木，这个Hook就是一个特殊规则：
 * - 如果规则说"true"，积木必须放在原来的地方
 * - 如果规则说"false"，积木可以放到别的盒子里
 */
export function usePortalRoot() {
  return useContext(ForcePortalRootContext)
}

// 定义组件属性类型
interface ForcePortalRootProps {
  force: boolean    // 是否强制Portal保持在当前树
  children: ReactNode // 子组件
}

/**
 * ForcePortalRoot - Portal根节点控制组件
 * 
 * @param props.force - 是否强制Portal保持在当前树
 * @param props.children - 子组件
 * 
 * 主要用途：
 * 1. 在Shadow DOM中使用Portal
 * 2. 在iframe中使用Portal
 * 3. 需要特定布局约束时
 * 
 * 性能影响：
 * - 几乎没有性能开销
 * - Context的值变化只影响使用它的组件
 * - 不会触发不必要的重渲染
 */
export function ForcePortalRoot(props: ForcePortalRootProps) {
  return (
    <ForcePortalRootContext.Provider value={props.force}>
      {props.children}
    </ForcePortalRootContext.Provider>
  )
}
