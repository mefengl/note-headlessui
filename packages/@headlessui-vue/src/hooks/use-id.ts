/**
 * use-id.ts - 生成唯一ID的工具
 * 
 * 这个文件实现了一个简单但重要的功能：生成递增的唯一标识符。
 * 
 * 为什么需要它？
 * 在网页中，我们经常需要给元素一个唯一的ID，比如：
 * 1. 让label和input对应（for="some-id"）
 * 2. 让aria-labelledby指向正确的说明文字
 * 3. 确保每个弹窗有自己的唯一标识
 * 
 * 工作原理：
 * 1. 维护一个从0开始的计数器
 * 2. 每次调用就把计数器加1
 * 3. 返回新的计数值作为ID
 * 
 * 使用示例：
 * ```vue
 * <template>
 *   <label :for="inputId">用户名</label>
 *   <input :id="inputId" type="text" />
 * </template>
 * 
 * <script>
 * import { useId } from '@headlessui/vue'
 * 
 * export default {
 *   setup() {
 *     const inputId = useId()
 *     return { inputId }
 *   }
 * }
 * </script>
 * ```
 * 
 * 特别说明：
 * 虽然这个实现很简单，但它是一个完美的例子，展示了"把简单的事情做好"的理念。
 * 它没有使用UUID这样的复杂方案，因为：
 * 1. 在单页应用中，递增的数字就足够用了
 * 2. 数字ID比随机字符串更短，性能更好
 * 3. 开发时易于调试，因为ID是可预测的
 */

// 全局计数器，用于生成唯一ID
let id = 0

/**
 * 生成下一个唯一ID
 * 使用前置递增(++i)确保返回的第一个ID是1而不是0
 */
function generateId() {
  return ++id
}

/**
 * useId - 获取唯一标识符的Hook
 * 
 * @returns number - 一个唯一的数字ID
 * 
 * 注意：每次调用都会得到一个新的ID，所以要在setup中保存结果：
 * ✅ const id = useId()  // 正确：ID只生成一次
 * ❌ :id="useId()"      // 错误：每次渲染都会生成新ID
 */
export function useId() {
  return generateId()
}
