/**
 * use-text-value.ts - 智能文本内容提取器
 * 
 * 这个Hook的主要作用是从DOM元素中提取格式化后的文本内容，
 * 并且使用缓存来提高性能。
 * 
 * 为什么需要它？
 * 1. 在搜索、过滤等功能中，我们需要获取元素的纯文本内容
 * 2. 直接使用innerText可能会有性能问题
 * 3. 需要统一的文本格式化（去空格、转小写等）
 * 
 * 举个例子：
 * ```vue
 * <script setup>
 * import { ref } from 'vue'
 * import { useTextValue } from '@headlessui/vue'
 * 
 * const menuItem = ref(null)
 * const getText = useTextValue(menuItem)
 * 
 * // 在菜单项过滤时使用
 * function filterItems(search: string) {
 *   return getText().includes(search.toLowerCase())
 * }
 * </script>
 * 
 * <template>
 *   <div ref="menuItem">
 *     <!-- 即使有复杂的HTML结构也能正确提取文本 -->
 *     产品介绍
 *     <span class="badge">新</span>
 *     <small>(点击查看)</small>
 *   </div>
 * </template>
 * ```
 * 
 * 性能优化：
 * 1. 使用缓存避免重复计算
 * 2. 只在内容变化时更新缓存
 * 3. 延迟到实际需要时才计算
 */

import { ref, type Ref } from 'vue'
import { dom } from '../utils/dom'
import { getTextValue } from '../utils/get-text-value'

/**
 * useTextValue - 从DOM元素获取格式化文本的Hook
 * 
 * @param element - 目标元素的Vue引用
 * @returns 一个函数，调用时返回当前的格式化文本
 * 
 * 工作原理：
 * 1. 使用缓存键（元素的原始文本）判断内容是否变化
 * 2. 如果缓存命中，直接返回缓存的值
 * 3. 如果缓存未命中，重新计算并更新缓存
 * 
 * 小朋友们可以这样理解：
 * 想象你有一本书，需要告诉别人书里写了什么：
 * - 第一次看书时，你会仔细读完并记下来（计算文本值）
 * - 下次别人再问时，如果书没变，就直接说出上次记的内容（使用缓存）
 * - 如果书的内容变了，你才需要重新读一遍（更新缓存）
 */
export function useTextValue(element: Ref<HTMLElement | null>) {
  // 缓存系统：
  // - cacheKey: 用原始文本作为键
  // - cacheValue: 存储处理后的文本
  let cacheKey = ref<string>('')
  let cacheValue = ref<string>('')

  // 返回一个函数而不是值，这样可以：
  // 1. 延迟计算到真正需要时
  // 2. 确保每次调用都能获取最新值
  return () => {
    // 获取实际的DOM元素
    let el = dom(element)
    if (!el) return ''

    // 检查缓存：
    // 使用元素的原始文本作为缓存键
    let currentKey = el.innerText
    if (cacheKey.value === currentKey) {
      return cacheValue.value
    }

    // 缓存未命中，需要重新计算：
    // 1. 获取原始文本
    // 2. 去除首尾空格
    // 3. 转换为小写
    let value = getTextValue(el).trim().toLowerCase()

    // 更新缓存
    cacheKey.value = currentKey
    cacheValue.value = value

    return value
  }
}
