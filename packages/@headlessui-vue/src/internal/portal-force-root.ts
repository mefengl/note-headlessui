/**
 * portal-force-root.ts - Vue版本的Portal根节点控制系统
 * 
 * 功能与React版本完全相同，但使用Vue的方式实现：
 * 1. 使用provide/inject替代React的Context
 * 2. 使用defineComponent替代函数组件
 * 3. 使用Vue的模板系统替代JSX
 * 
 * 使用示例：
 * ```vue
 * <template>
 *   <!-- 1. 默认行为：Portal渲染到body -->
 *   <Dialog>
 *     弹窗内容会被传送到body
 *   </Dialog>
 * 
 *   <!-- 2. 强制保持在当前位置 -->
 *   <ForcePortalRoot :force="true">
 *     <div class="shadow-root">
 *       <Dialog>
 *         弹窗内容会保持在shadow-root内
 *       </Dialog>
 *     </div>
 *   </ForcePortalRoot>
 * </template>
 * 
 * <script setup>
 * import { ForcePortalRoot } from '@headlessui/vue'
 * </script>
 * ```
 */

import { defineComponent, inject, provide, type InjectionKey } from 'vue'
import { render } from '../utils/render'

/**
 * 创建注入键
 * - 使用Symbol确保唯一性
 * - 使用InjectionKey提供类型安全
 * - Boolean类型表示是否强制使用当前根节点
 */
let ForcePortalRootContext = Symbol('ForcePortalRootContext') as InjectionKey<Boolean>

/**
 * usePortalRoot - 获取Portal根节点控制标志的组合式函数
 * 
 * @returns boolean - 是否强制Portal保持在当前树中
 * 
 * 小朋友们可以这样理解：
 * 想象你有一个玩具传送门：
 * - 如果返回true，玩具必须留在原地
 * - 如果返回false，玩具可以被传送到别的地方
 * 
 * 使用场景：
 * 1. 在Portal组件内部判断渲染位置
 * 2. 在自定义组件中控制Portal行为
 * 3. 处理特殊环境（如Shadow DOM）
 */
export function usePortalRoot() {
  return inject(ForcePortalRootContext, false)
}

/**
 * ForcePortalRoot - Portal根节点控制组件
 * 
 * 特点：
 * 1. 默认使用template作为包装元素（不会创建额外的DOM节点）
 * 2. 可以通过as属性改变渲染的元素类型
 * 3. 使用provide注入控制标志到子组件
 * 
 * 性能考虑：
 * - 使用template作为默认包装可以减少不必要的DOM节点
 * - provide的值变化只影响使用它的组件
 * - 渲染函数非常轻量
 */
export let ForcePortalRoot = defineComponent({
  name: 'ForcePortalRoot',

  // 定义属性
  props: {
    // 渲染的元素类型，默认是template
    as: { type: [Object, String], default: 'template' },
    // 是否强制保持在当前树，默认false
    force: { type: Boolean, default: false },
  },

  // 组件逻辑
  setup(props, { slots, attrs }) {
    // 注入控制标志到子组件
    provide(ForcePortalRootContext, props.force)

    // 返回渲染函数
    return () => {
      // 分离props
      let { force, ...theirProps } = props

      // 使用通用渲染函数完成渲染
      return render({
        theirProps,   // 用户的其他属性
        ourProps: {}, // 我们不需要添加特殊属性
        slot: {},     // 不需要传递插槽数据
        slots,        // 用户的插槽内容
        attrs,        // 透传的属性
        name: 'ForcePortalRoot', // 组件名（用于调试）
      })
    }
  },
})
