/**
 * use-root-containers.tsx
 * 这个文件处理UI组件的容器管理，特别是在使用Portal进行渲染时的情况
 * 
 * 主要解决的问题：
 * 1. 当组件被渲染到Portal中时，它不再是主应用树的一部分
 * 2. 需要追踪这些容器来正确处理点击、焦点等事件
 * 3. 需要处理嵌套组件的情况（比如Popover嵌套在另一个Portal中的Popover中）
 * 
 * 举个例子：
 * 假设你有一个下拉菜单，它被渲染到页面底部的Portal中：
 * <div id="app">
 *   <button>打开菜单</button>
 * </div>
 * <div id="portal-root">
 *   <div class="dropdown-menu">选项1、2、3...</div>
 * </div>
 * 
 * 这时我们需要：
 * 1. 知道菜单是从哪个按钮触发的
 * 2. 追踪所有可能的点击目标
 * 3. 正确处理事件冒泡
 */

import React, { createContext, useContext, useState, type MutableRefObject } from 'react'
import { Hidden, HiddenFeatures } from '../internal/hidden'
import { getOwnerDocument } from '../utils/owner'
import { useEvent } from './use-event'
import { useOwnerDocument } from './use-owner'

/**
 * useRootContainers - 管理和解析UI组件的所有相关容器
 * 
 * @param defaultContainers - 默认的容器列表，比如触发按钮所在的容器
 * @param portals - 通过Portal渲染的容器的引用
 * @param mainTreeNode - 主应用树中的节点引用（比如触发按钮）
 * 
 * @returns {
 *   resolveContainers: () => HTMLElement[] - 解析并返回所有相关容器
 *   contains: (element: HTMLElement) => boolean - 检查元素是否在任何容器内
 * }
 * 
 * 小朋友们可以这样理解：
 * 想象你在玩积木，有些积木在主要的游戏区（defaultContainers），
 * 有些被放到特殊区域（portals），
 * 还有一个特殊的积木（mainTreeNode）告诉我们游戏开始的地方。
 * 这个函数就像一个小助手，帮我们记住所有积木在哪里！
 */
export function useRootContainers({
  defaultContainers = [],
  portals,
  mainTreeNode,
}: {
  defaultContainers?: (HTMLElement | null | MutableRefObject<HTMLElement | null>)[]
  portals?: MutableRefObject<HTMLElement[]>
  mainTreeNode?: HTMLElement | null
} = {}) {
  // 获取文档对象引用
  let ownerDocument = useOwnerDocument(mainTreeNode)

  // 解析所有容器的函数
  let resolveContainers = useEvent(() => {
    let containers: HTMLElement[] = []

    // 步骤1：解析默认容器（比如按钮容器）
    for (let container of defaultContainers) {
      if (container === null) continue
      if (container instanceof HTMLElement) {
        containers.push(container)
      } else if ('current' in container && container.current instanceof HTMLElement) {
        containers.push(container.current)
      }
    }

    // 步骤2：解析Portal容器（比如弹出层）
    if (portals?.current) {
      for (let portal of portals.current) {
        containers.push(portal)
      }
    }

    // 步骤3：查找页面上其他的根容器
    // 这里会查找 <html> 和 <body> 的直接子元素
    for (let container of ownerDocument?.querySelectorAll('html > *, body > *') ?? []) {
      // 跳过一些特殊元素
      if (container === document.body) continue 
      if (container === document.head) continue
      if (!(container instanceof HTMLElement)) continue
      if (container.id === 'headlessui-portal-root') continue

      // 如果有主树节点，需要特殊处理
      if (mainTreeNode) {
        // 跳过包含主应用的容器
        if (container.contains(mainTreeNode)) continue
        // 处理Shadow DOM的情况
        if (container.contains((mainTreeNode?.getRootNode() as ShadowRoot)?.host)) continue
      }

      // 避免重复添加已包含的容器
      if (containers.some((defaultContainer) => container.contains(defaultContainer))) continue

      containers.push(container)
    }

    return containers
  })

  return {
    resolveContainers,
    // 检查元素是否在任何容器内
    contains: useEvent((element: HTMLElement) =>
      resolveContainers().some((container) => container.contains(element))
    ),
  }
}

// 创建上下文来传递主树节点
let MainTreeContext = createContext<HTMLElement | null>(null)

/**
 * MainTreeProvider - 主树节点的提供者组件
 * 
 * 这就像是给积木游戏设置一个起点！
 * 
 * 为什么需要这个？
 * 想象你在玩积木，有时候需要把一些积木放到别的地方（Portal），
 * 但是你还是要记住游戏是从哪里开始的。这个组件就是帮我们记住这个起点！
 * 
 * 使用场景举例：
 * ```tsx
 * <MainTreeProvider>
 *   <Popover> // 顶层弹出框
 *     <PopoverButton>点我</PopoverButton>
 *     <Portal>
 *       <PopoverPanel>
 *         <Popover> // 嵌套的弹出框
 *           <PopoverButton>子菜单</PopoverButton>
 *           <PopoverPanel>...</PopoverPanel>
 *         </Popover>
 *       </PopoverPanel>
 *     </Portal>
 *   </Popover>
 * </MainTreeProvider>
 * ```
 */
export function MainTreeProvider({
  children,
  node,
}: {
  children: React.ReactNode
  node?: HTMLElement | null
}) {
  let [mainTreeNode, setMainTreeNode] = useState<HTMLElement | null>(null)
  
  // 按优先级解析主树节点：
  // 1. 上下文中的节点
  // 2. 传入的节点
  // 3. 创建新节点
  let resolvedMainTreeNode = useMainTreeNode(node ?? mainTreeNode)

  return (
    <MainTreeContext.Provider value={resolvedMainTreeNode}>
      {children}
      {/* 如果没有找到主树节点，创建一个隐藏元素来确定主树位置 */}
      {resolvedMainTreeNode === null && (
        <Hidden
          features={HiddenFeatures.Hidden}
          ref={(el) => {
            if (!el) return
            // 查找包含这个隐藏元素的根容器
            for (let container of getOwnerDocument(el)?.querySelectorAll('html > *, body > *') ??
              []) {
              if (container === document.body) continue
              if (container === document.head) continue
              if (!(container instanceof HTMLElement)) continue
              if (container?.contains(el)) {
                setMainTreeNode(container)
                break
              }
            }
          }}
        />
      )}
    </MainTreeContext.Provider>
  )
}

/**
 * useMainTreeNode - 获取主树节点的Hook
 * 
 * 这个Hook就像是一个指南针，告诉我们主树在哪里！
 * 如果找不到，就用备用的节点。
 * 
 * @param fallbackMainTreeNode - 备用的主树节点
 * @returns 主树节点或null
 */
export function useMainTreeNode(fallbackMainTreeNode: HTMLElement | null = null) {
  return useContext(MainTreeContext) ?? fallbackMainTreeNode
}
