/**
 * hidden.ts - Vue版本的可访问性隐藏组件
 * 
 * 功能与React版本完全相同，但使用Vue的方式实现：
 * 1. 使用defineComponent替代React的函数组件
 * 2. 使用props和setup替代React的属性传递
 * 3. 使用Vue的渲染系统替代JSX
 * 
 * 使用示例：
 * ```vue
 * <template>
 *   <!-- 1. 基础用法：视觉隐藏但屏幕阅读器可读 -->
 *   <Hidden>这段文字只有屏幕阅读器能读到</Hidden>
 * 
 *   <!-- 2. 可聚焦的隐藏元素 -->
 *   <Hidden :features="Features.Focusable">
 *     <button>隐藏但可以用Tab键聚焦</button>
 *   </Hidden>
 * 
 *   <!-- 3. 完全隐藏 -->
 *   <Hidden :features="Features.Hidden">
 *     暂时完全隐藏的内容
 *   </Hidden>
 * 
 *   <!-- 4. 自定义标签 -->
 *   <Hidden as="section">
 *     使用section标签而不是div
 *   </Hidden>
 * </template>
 * 
 * <script>
 * import { Hidden, Features } from '@headlessui/vue'
 * 
 * export default {
 *   components: { Hidden },
 *   setup() {
 *     return { Features }
 *   }
 * }
 * </script>
 * ```
 */

import { defineComponent, type PropType } from 'vue'
import { render } from '../utils/render'

/**
 * 隐藏特性枚举
 * 使用位运算实现特性组合：
 * - 可以用 | 组合多个特性
 * - 用 & 检查是否包含某个特性
 */
export enum Features {
  // 默认特性：视觉隐藏但保持可访问性
  None = 1 << 0,      // 二进制：001
  // 元素是否可以获取焦点
  Focusable = 1 << 1, // 二进制：010
  // 完全隐藏（视觉和辅助技术都无法访问）
  Hidden = 1 << 2,    // 二进制：100
}

/**
 * Hidden组件实现
 * 
 * 工作原理和React版本相同，主要区别在于：
 * 1. 使用Vue的组件定义方式
 * 2. Props使用Vue的类型系统
 * 3. 渲染使用Vue的slots系统
 */
export let Hidden = defineComponent({
  name: 'Hidden',

  // 定义属性及其类型
  props: {
    // as：指定要渲染的HTML标签或组件
    as: { type: [Object, String], default: 'div' },
    // features：使用位运算的特性标志
    features: { type: Number as PropType<Features>, default: Features.None },
  },

  // setup：组件的核心逻辑
  setup(props, { slots, attrs }) {
    // 返回渲染函数
    return () => {
      // 分离props中的features和其他属性
      let { features, ...theirProps } = props

      // 构建组件的核心属性
      let ourProps = {
        // 根据特性设置aria-hidden
        'aria-hidden':
          (features & Features.Focusable) === Features.Focusable
            ? true
            : // @ts-ignore - 处理用户可能传入的aria-hidden
              theirProps['aria-hidden'] ?? undefined,

        // 根据特性设置hidden属性
        hidden: (features & Features.Hidden) === Features.Hidden ? true : undefined,

        // 视觉隐藏的CSS样式
        style: {
          position: 'fixed',   // 移出正常布局流
          top: 1,             // 放在视窗之外
          left: 1,
          width: 1,           // 最小化尺寸
          height: 0,
          padding: 0,         // 移除内边距
          margin: -1,         // 使用负margin确保不可见
          overflow: 'hidden', // 隐藏溢出内容
          clip: 'rect(0, 0, 0, 0)', // 剪切所有可见部分
          whiteSpace: 'nowrap',     // 防止文本换行
          borderWidth: '0',         // 移除边框

          // 完全隐藏但不可聚焦时使用display:none
          ...((features & Features.Hidden) === Features.Hidden &&
            !((features & Features.Focusable) === Features.Focusable) && { display: 'none' }),
        },
      }

      // 使用通用渲染函数完成最终渲染
      return render({
        ourProps,     // 我们的核心属性
        theirProps,   // 用户传入的其他属性
        slot: {},     // 插槽数据（这里为空）
        attrs,        // 透传的属性
        slots,        // 插槽内容
        name: 'Hidden', // 组件名（用于调试）
      })
    }
  },
})
