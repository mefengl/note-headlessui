/**
 * use-root-containers.ts - Vue版本的容器管理系统
 * 
 * 这个文件的功能与React版本相同，但使用Vue的方式实现：
 * 1. 使用ref代替React的useRef
 * 2. 使用h函数代替JSX
 * 3. 处理Vue特有的响应式引用（.value访问）
 * 
 * 关键概念解释：
 * - 主树（Main Tree）：应用的主要渲染树
 * - Portal：被传送到DOM其他位置的内容
 * - 容器（Container）：可以包含UI元素的DOM节点
 * 
 * 举个例子：
 * ```vue
 * <template>
 *   <!-- 主树中的按钮 -->
 *   <button @click="open = true">打开对话框</button>
 *   
 *   <!-- Portal中的对话框 -->
 *   <Teleport to="body">
 *     <Dialog v-if="open">
 *       <DialogPanel>
 *         <!-- 这里的内容在DOM中和按钮是分开的 -->
 *         对话框内容...
 *       </DialogPanel>
 *     </Dialog>
 *   </Teleport>
 * </template>
 * ```
 */

import { h, ref, type Ref } from 'vue'
import { Hidden, Features as HiddenFeatures } from '../internal/hidden'
import { dom } from '../utils/dom'
import { getOwnerDocument } from '../utils/owner'

/**
 * useRootContainers - Vue版本的根容器管理Hook
 * 
 * @param defaultContainers - 默认的容器列表（如触发按钮容器）
 * @param portals - Teleport（传送门）创建的容器列表
 * @param mainTreeNodeRef - 主树中的节点引用（可选）
 * 
 * @returns {
 *   resolveContainers: () => HTMLElement[] - 解析所有容器
 *   contains: (element: HTMLElement) => boolean - 检查元素是否在容器内
 *   mainTreeNodeRef: Ref<HTMLElement | null> - 主树节点引用
 *   MainTreeNode: () => VNode - 创建隐藏的跟踪节点
 * }
 * 
 * 小朋友们可以这样理解：
 * 想象你在玩积木，有三种积木盒子：
 * 1. 默认盒子（defaultContainers）- 放主要的积木
 * 2. 特殊盒子（portals）- 放需要挪到别处的积木
 * 3. 主盒子（mainTreeNodeRef）- 记住游戏开始的地方
 */
export function useRootContainers({
  defaultContainers = [],
  portals,
  mainTreeNodeRef: _mainTreeNodeRef,
}: {
  defaultContainers?: (HTMLElement | null | Ref<HTMLElement | null>)[]
  portals?: Ref<HTMLElement[]>
  mainTreeNodeRef?: Ref<HTMLElement | null>
} = {}) {
  // 创建主树节点引用（如果没有提供）
  let mainTreeNodeRef = ref<HTMLElement | null>(null)
  let ownerDocument = getOwnerDocument(mainTreeNodeRef)

  /**
   * resolveContainers - 解析所有相关容器
   * 工作步骤：
   * 1. 收集默认容器
   * 2. 添加Portal容器
   * 3. 查找其他根容器
   */
  function resolveContainers() {
    let containers: HTMLElement[] = []

    // 步骤1：解析默认容器
    for (let container of defaultContainers) {
      if (container === null) continue
      if (container instanceof HTMLElement) {
        containers.push(container)
      } else if ('value' in container && container.value instanceof HTMLElement) {
        containers.push(container.value)
      }
    }

    // 步骤2：解析Portal容器
    if (portals?.value) {
      for (let portal of portals.value) {
        containers.push(portal)
      }
    }

    // 步骤3：查找页面上其他的根容器
    for (let container of ownerDocument?.querySelectorAll('html > *, body > *') ?? []) {
      // 跳过特殊元素
      if (container === document.body) continue
      if (container === document.head) continue
      if (!(container instanceof HTMLElement)) continue
      if (container.id === 'headlessui-portal-root') continue

      // 跳过主应用相关的容器
      if (container.contains(dom(mainTreeNodeRef))) continue
      // 处理Shadow DOM的情况
      if (container.contains((dom(mainTreeNodeRef)?.getRootNode() as ShadowRoot)?.host)) continue
      // 避免重复添加已包含的容器
      if (containers.some((defaultContainer) => container.contains(defaultContainer))) continue

      containers.push(container)
    }

    return containers
  }

  return {
    resolveContainers,
    // 检查元素是否在任何容器内
    contains(element: HTMLElement) {
      return resolveContainers().some((container) => container.contains(element))
    },
    mainTreeNodeRef,
    // 创建隐藏的跟踪节点（仅当没有提供mainTreeNodeRef时）
    MainTreeNode() {
      if (_mainTreeNodeRef != null) return null
      return h(Hidden, { features: HiddenFeatures.Hidden, ref: mainTreeNodeRef })
    },
  }
}

/**
 * useMainTreeNode - 创建主树节点的Hook
 * 
 * 这个Hook比React版本简单，因为Vue的组件系统不同。
 * 它只负责：
 * 1. 创建一个引用来存储主树节点
 * 2. 提供一个组件来渲染隐藏的跟踪节点
 * 
 * @returns {
 *   mainTreeNodeRef: 主树节点的引用
 *   MainTreeNode: 创建隐藏节点的渲染函数
 * }
 */
export function useMainTreeNode() {
  let mainTreeNodeRef = ref<HTMLElement | null>(null)
  return {
    mainTreeNodeRef,
    MainTreeNode() {
      return h(Hidden, { features: HiddenFeatures.Hidden, ref: mainTreeNodeRef })
    },
  }
}
