import { useId } from 'react'
import { DefaultMap } from '../utils/default-map'
import { createStore } from '../utils/store'
import { useIsoMorphicEffect } from './use-iso-morphic-effect'
import { useStore } from './use-store'

/**
 * 基于作用域的层级管理器存储
 * 每个作用域都有自己独立的层级系统
 */
let hierarchyStores = new DefaultMap(() =>
  createStore(() => [] as string[], {
    ADD(id: string) {
      if (this.includes(id)) return this
      return [...this, id]
    },
    REMOVE(id: string) {
      let idx = this.indexOf(id)
      if (idx === -1) return this
      let copy = this.slice()
      copy.splice(idx, 1)
      return copy
    },
  })
)

/**
 * useIsTopLayer - UI层级管理钩子
 * 
 * 用于管理嵌套UI组件(如模态框、菜单、弹出框等)的层级关系。它创建了一个
 * 虚拟的层级系统，用于确定哪个组件应该响应特定的全局事件(如点击、快捷键等)。
 * 
 * 工作原理:
 * 1. 每个作用域维护一个独立的组件ID数组
 * 2. 数组中最后一个组件被认为是"顶层"
 * 3. 组件在挂载时被添加到数组末尾
 * 4. 组件在卸载时从数组中移除
 * 
 * 使用场景:
 * ```tsx
 * function Dialog({ children }) {
 *   const isTopLayer = useIsTopLayer(true, 'dialog')
 *   
 *   useEffect(() => {
 *     if (!isTopLayer) return
 *     
 *     // 只有最上层的对话框才处理Esc键
 *     function onKeyDown(e) {
 *       if (e.key === 'Escape') close()
 *     }
 *     // ...
 *   }, [isTopLayer])
 *   
 *   return <div>{children}</div>
 * }
 * ```
 * 
 * 特性:
 * 1. 基于作用域的隔离 - 不同类型的组件可以有独立的层级
 * 2. 自动层级管理 - 组件的挂载顺序决定了层级
 * 3. 响应式 - 实时反映UI层级的变化
 * 4. SSR友好 - 使用useIsoMorphicEffect确保服务端渲染兼容
 * 
 * 高级用例:
 * ```tsx
 * <Dialog> {/* scope: dialog, isTop: false */}
 *   <Menu>   {/* scope: menu, isTop: true */}
 *     <Button onClick={() => {
 *       // 点击按钮只会关闭Menu，而不是Dialog
 *       // 因为Menu在自己的作用域中是顶层
 *     }} />
 *   </Menu>
 * </Dialog>
 * ```
 * 
 * @param enabled 是否启用层级管理
 * @param scope 层级作用域，用于隔离不同类型的组件
 * @returns 是否是当前作用域的顶层组件
 */
export function useIsTopLayer(enabled: boolean, scope: string) {
  // 获取或创建作用域的层级存储
  let hierarchyStore = hierarchyStores.get(scope)
  
  // 生成稳定的组件ID
  let id = useId()
  
  // 订阅层级变化
  let hierarchy = useStore(hierarchyStore)

  // 在组件挂载和卸载时维护层级
  useIsoMorphicEffect(() => {
    if (!enabled) return
    hierarchyStore.dispatch('ADD', id)
    return () => hierarchyStore.dispatch('REMOVE', id)
  }, [hierarchyStore, enabled])

  // 如果禁用，直接返回false
  if (!enabled) return false

  let idx = hierarchy.indexOf(id)
  let hierarchyLength = hierarchy.length

  // 如果组件还未添加到层级中，假设它将被添加到末尾
  if (idx === -1) {
    idx = hierarchyLength
    hierarchyLength += 1
  }

  // 判断是否是当前作用域的顶层
  return idx === hierarchyLength - 1
}
