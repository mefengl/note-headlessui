/**
 * hidden.tsx - 可访问性隐藏组件
 * 
 * 这个组件提供了三种不同的隐藏方式：
 * 1. 视觉隐藏但保持可访问性（默认）
 * 2. 可聚焦但视觉隐藏
 * 3. 完全隐藏（视觉和辅助技术都无法访问）
 * 
 * 为什么需要不同的隐藏方式？
 * - 视觉隐藏：用于提供额外的辅助技术信息
 * - 可聚焦：用于创建不可见但可交互的元素
 * - 完全隐藏：用于暂时移除元素的所有访问方式
 * 
 * 使用示例：
 * ```tsx
 * // 1. 基础用法 - 视觉隐藏但屏幕阅读器可读
 * <Hidden>这段文字只有屏幕阅读器能读到</Hidden>
 * 
 * // 2. 可聚焦的隐藏元素
 * <Hidden features={HiddenFeatures.Focusable}>
 *   <button>隐藏但可以用Tab键聚焦</button>
 * </Hidden>
 * 
 * // 3. 完全隐藏
 * <Hidden features={HiddenFeatures.Hidden}>
 *   暂时完全隐藏的内容
 * </Hidden>
 * ```
 */

import type { ElementType, Ref } from 'react'
import type { Props } from '../types'
import { forwardRefWithAs, useRender, type HasDisplayName, type RefProp } from '../utils/render'

// 默认使用span标签
let DEFAULT_VISUALLY_HIDDEN_TAG = 'span' as const

/**
 * 隐藏特性枚举
 * 使用位运算实现特性组合：
 * - 可以用 | 组合多个特性
 * - 用 & 检查是否包含某个特性
 */
export enum HiddenFeatures {
  // 默认特性：视觉隐藏但保持可访问性
  None = 1 << 0,      // 二进制：001
  // 元素是否可以获取焦点
  Focusable = 1 << 1, // 二进制：010
  // 完全隐藏（视觉和辅助技术都无法访问）
  Hidden = 1 << 2,    // 二进制：100
}

// 定义组件的渲染参数类型
type HiddenRenderPropArg = {}

// 我们不控制任何属性，所有属性都传递给底层元素
type HiddenPropsWeControl = never

/**
 * Hidden组件的属性类型定义
 * 
 * @template TTag - 底层HTML元素的类型，默认是span
 * 包含：
 * 1. 基础HTML元素属性（Props<TTag>）
 * 2. 渲染函数参数（HiddenRenderPropArg）
 * 3. 我们控制的属性（HiddenPropsWeControl）
 * 4. 特性配置（features）
 */
export type HiddenProps<TTag extends ElementType = typeof DEFAULT_VISUALLY_HIDDEN_TAG> = Props<
  TTag,
  HiddenRenderPropArg,
  HiddenPropsWeControl,
  { features?: HiddenFeatures }
>

/**
 * VisuallyHidden - 核心实现组件
 * 
 * 工作原理：
 * 1. 使用CSS技巧实现视觉隐藏但保持可访问性
 * 2. 根据features参数调整aria-hidden和样式
 * 3. 支持自定义标签和属性透传
 * 
 * CSS技巧解释：
 * - position: fixed; top: 1; left: 1; - 移出正常布局流
 * - width: 1; height: 0; - 设置极小的尺寸
 * - padding: 0; margin: -1; - 抵消可能的空间占用
 * - overflow: hidden; clip: rect(0,0,0,0); - 确保内容不可见
 * - whiteSpace: nowrap; - 防止文本换行导致的显示问题
 * 
 * @param props - 组件属性
 * @param ref - 转发的ref引用
 */
function VisuallyHidden<TTag extends ElementType = typeof DEFAULT_VISUALLY_HIDDEN_TAG>(
  props: HiddenProps<TTag>,
  ref: Ref<HTMLElement>
) {
  let { features = HiddenFeatures.None, ...theirProps } = props

  // 构建我们的属性
  let ourProps = {
    ref,
    // 根据特性设置aria-hidden
    'aria-hidden':
      (features & HiddenFeatures.Focusable) === HiddenFeatures.Focusable
        ? true
        : theirProps['aria-hidden'] ?? undefined,
    // 根据特性设置hidden属性
    hidden: (features & HiddenFeatures.Hidden) === HiddenFeatures.Hidden ? true : undefined,
    // 视觉隐藏的CSS样式
    style: {
      position: 'fixed',
      top: 1,
      left: 1,
      width: 1,
      height: 0,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      borderWidth: '0',
      // 完全隐藏但不可聚焦时，使用display:none
      ...((features & HiddenFeatures.Hidden) === HiddenFeatures.Hidden &&
        !((features & HiddenFeatures.Focusable) === HiddenFeatures.Focusable) && {
          display: 'none',
        }),
    },
  }

  // 使用通用渲染函数完成最终渲染
  let render = useRender()
  return render({
    ourProps,
    theirProps,
    slot: {},
    defaultTag: DEFAULT_VISUALLY_HIDDEN_TAG,
    name: 'Hidden',
  })
}

/**
 * 定义最终导出的组件类型
 * 包含：
 * 1. 组件显示名（方便调试）
 * 2. 泛型支持（允许自定义标签）
 * 3. ref转发支持
 */
interface ComponentHidden extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_VISUALLY_HIDDEN_TAG>(
    props: HiddenProps<TTag> & RefProp<typeof VisuallyHidden>
  ): React.JSX.Element
}

/**
 * 导出最终的Hidden组件
 * 使用forwardRefWithAs实现ref转发和as属性支持
 */
export let Hidden = forwardRefWithAs(VisuallyHidden) as ComponentHidden
