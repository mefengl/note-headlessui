/**
 * open-closed.ts - Vue版本的开关状态管理系统
 * 
 * 使用Vue的依赖注入系统（provide/inject）实现状态共享，
 * 功能与React版本相同，但使用Vue的方式实现。
 * 
 * 主要应用场景：
 * 1. 模态框（Dialog）的打开/关闭状态
 * 2. 下拉菜单的展开/收起状态
 * 3. 任何需要动画过渡的开关组件
 * 
 * 使用示例：
 * ```vue
 * <script setup>
 * import { ref } from 'vue'
 * import { useOpenClosedProvider, State } from '@headlessui/vue'
 * 
 * // 1. 在父组件中提供状态
 * const dialogState = ref(State.Closed)
 * useOpenClosedProvider(dialogState)
 * 
 * function openDialog() {
 *   dialogState.value = State.Opening
 *   // 动画开始后...
 *   dialogState.value = State.Open
 * }
 * </script>
 * 
 * <template>
 *   <Dialog>
 *     <DialogPanel>
 *       <!-- 子组件中使用状态 -->
 *     </DialogPanel>
 *   </Dialog>
 * </template>
 * 
 * <!-- 在子组件中 -->
 * <script setup>
 * import { useOpenClosed, State } from '@headlessui/vue'
 * 
 * // 2. 在子组件中获取状态
 * const state = useOpenClosed()
 * 
 * // 3. 根据状态添加不同的动画类
 * const classes = computed(() => ({
 *   'animate-enter': state.value === State.Opening,
 *   'animate-leave': state.value === State.Closing
 * }))
 * </script>
 * ```
 */

import { inject, provide, type InjectionKey, type Ref } from 'vue'

/**
 * 创建Vue注入键
 * Symbol确保键的唯一性
 * InjectionKey提供类型安全
 */
let Context = Symbol('Context') as InjectionKey<Ref<State>>

/**
 * 状态枚举
 * 使用位运算便于组合状态：
 * - Open | Closing 表示正在关闭
 * - Closed | Opening 表示正在打开
 * 
 * 小朋友们可以这样理解：
 * 想象一个自动门：
 * - Open：门完全打开了
 * - Closed：门完全关闭了
 * - Opening：门正在打开（还在动）
 * - Closing：门正在关闭（还在动）
 */
export enum State {
  Open = 1 << 0,    // 0001 - 完全打开
  Closed = 1 << 1,  // 0010 - 完全关闭
  Closing = 1 << 2, // 0100 - 正在关闭
  Opening = 1 << 3, // 1000 - 正在打开
}

/**
 * hasOpenClosed - 检查是否存在开关状态上下文
 * 
 * @returns 当前组件是否在OpenClosed上下文中
 * 
 * 使用场景：
 * 1. 检查组件是否正确嵌套
 * 2. 决定是否使用默认行为
 */
export function hasOpenClosed() {
  return useOpenClosed() !== null
}

/**
 * useOpenClosed - 获取当前开关状态的组合式函数
 * 
 * @returns 当前状态的响应式引用，不在Provider中则返回null
 * 
 * 特点：
 * 1. 返回的是Vue的ref，可以直接用在模板中
 * 2. 自动响应状态变化
 * 3. 支持TypeScript类型推导
 */
export function useOpenClosed() {
  return inject(Context, null)
}

/**
 * useOpenClosedProvider - 提供开关状态的组合式函数
 * 
 * @param value - 状态的响应式引用
 * 
 * 工作原理：
 * 1. 接收一个ref作为状态源
 * 2. 将状态注入到Vue的依赖注入系统
 * 3. 所有子组件都可以通过useOpenClosed访问
 * 
 * 使用场景：
 * 1. 在复杂组件的根部提供状态
 * 2. 需要多个组件共享状态时
 * 3. 管理动画和过渡效果
 */
export function useOpenClosedProvider(value: Ref<State>) {
  provide(Context, value)
}
