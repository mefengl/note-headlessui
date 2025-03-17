/**
 * open-closed.tsx - 开关状态管理系统
 * 
 * 这个模块实现了一个状态管理系统，用于跟踪UI组件的开关状态。
 * 使用React的Context API实现状态共享，支持嵌套组件的状态管理。
 * 
 * 主要应用场景：
 * 1. 模态框（Dialog）的打开/关闭状态
 * 2. 下拉菜单（Dropdown）的展开/收起状态
 * 3. 折叠面板（Disclosure）的展开/收起状态
 * 4. 任何需要动画过渡的开关组件
 * 
 * 使用示例：
 * ```tsx
 * function Dialog({ isOpen }) {
 *   return (
 *     <OpenClosedProvider 
 *       value={isOpen ? State.Open : State.Closed}
 *     >
 *       <DialogContent>
 *         {/* 子组件可以使用useOpenClosed获取状态 */}
 *         <DialogPanel />
 *       </DialogContent>
 *     </OpenClosedProvider>
 *   )
 * }
 * 
 * function DialogPanel() {
 *   let state = useOpenClosed()
 *   
 *   // 根据状态添加不同的动画
 *   if (state === State.Open) {
 *     return <div className="animate-fadeIn">内容</div>
 *   }
 *   
 *   if (state === State.Closing) {
 *     return <div className="animate-fadeOut">内容</div>
 *   }
 * }
 * ```
 */

import React, { createContext, useContext, type ReactElement, type ReactNode } from 'react'

// 创建Context，默认值为null
let Context = createContext<State | null>(null)
// 设置displayName方便调试
Context.displayName = 'OpenClosedContext'

/**
 * 状态枚举
 * 使用位运算便于组合状态：
 * - Open | Closing 表示正在关闭
 * - Closed | Opening 表示正在打开
 */
export enum State {
  Open = 1 << 0,    // 0001 - 完全打开
  Closed = 1 << 1,  // 0010 - 完全关闭
  Closing = 1 << 2, // 0100 - 正在关闭
  Opening = 1 << 3, // 1000 - 正在打开
}

/**
 * useOpenClosed - 获取当前开关状态的Hook
 * 
 * @returns 当前的状态值，如果不在Provider中则返回null
 * 
 * 小朋友们可以这样理解：
 * 想象一个玩具盒子，这个Hook可以告诉我们：
 * - 盒子是打开的还是关闭的
 * - 盒子正在被打开还是正在被关闭
 * - 如果找不到盒子，就返回null
 */
export function useOpenClosed() {
  return useContext(Context)
}

// 定义Provider的属性类型
interface Props {
  value: State      // 当前状态
  children: ReactNode // 子组件
}

/**
 * OpenClosedProvider - 状态提供者组件
 * 
 * 作用：
 * 1. 为子组件树提供开关状态
 * 2. 支持状态的动态更新
 * 3. 允许嵌套使用（内层会覆盖外层）
 * 
 * @param value - 当前状态
 * @param children - 子组件
 */
export function OpenClosedProvider({ value, children }: Props): ReactElement {
  return <Context.Provider value={value}>{children}</Context.Provider>
}

/**
 * ResetOpenClosedProvider - 状态重置组件
 * 
 * 作用：
 * 1. 重置内部组件树的开关状态为null
 * 2. 用于打破状态的继承链
 * 3. 适用于需要独立状态的子树
 * 
 * 使用场景：
 * 1. 嵌套的模态框需要独立状态
 * 2. Portal中的组件需要重置状态
 * 3. 任何需要隔离状态的场景
 * 
 * @param children - 子组件
 */
export function ResetOpenClosedProvider({ children }: { children: React.ReactNode }): ReactElement {
  return <Context.Provider value={null}>{children}</Context.Provider>
}
