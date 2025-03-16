import type { MutableRefObject } from 'react'
import { disposables } from './disposables'
import { match } from './match'
import { getOwnerDocument } from './owner'

// =============================================================================
// 可聚焦元素选择器
// 定义了哪些HTML元素可以接收焦点
// =============================================================================

/**
 * 可聚焦元素的CSS选择器列表
 * 来源: https://stackoverflow.com/a/30753870
 * 
 * 包含以下可聚焦元素:
 * 1. 可编辑内容
 * 2. 有tabindex的元素
 * 3. 带href的链接和区域
 * 4. 未禁用的按钮
 * 5. iframe
 * 6. 未禁用的表单控件
 */
export let focusableSelector = [
  '[contentEditable=true]',
  '[tabindex]',
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'iframe',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
]
  .map(
    process.env.NODE_ENV === 'test'
      ? // 测试环境特殊处理: 排除隐藏元素(JSDOM特殊处理)
        (selector) => `${selector}:not([tabindex='-1']):not([style*='display: none'])`
      : // 生产环境: 只排除tabindex=-1的元素
        (selector) => `${selector}:not([tabindex='-1'])`
  )
  .join(',')

/**
 * 自动聚焦元素的选择器
 * 使用data-autofocus属性标记(React不会传递原生autofocus属性)
 */
let autoFocusableSelector = [
  '[data-autofocus]',
].map(
  process.env.NODE_ENV === 'test'
    ? (selector) => `${selector}:not([tabindex='-1']):not([style*='display: none'])`
    : (selector) => `${selector}:not([tabindex='-1'])`
).join(',')

// =============================================================================
// 焦点管理枚举
// 定义焦点移动的方向和行为
// =============================================================================

/**
 * Focus枚举 - 定义焦点移动的行为
 * 使用位运算支持组合行为
 */
export enum Focus {
  /** 聚焦第一个非禁用元素 */
  First = 1 << 0,
  /** 聚焦上一个非禁用元素 */
  Previous = 1 << 1,
  /** 聚焦下一个非禁用元素 */
  Next = 1 << 2,
  /** 聚焦最后一个非禁用元素 */
  Last = 1 << 3,
  /** Tab键循环包装 */
  WrapAround = 1 << 4,
  /** 阻止将可聚焦元素滚动到视图中 */
  NoScroll = 1 << 5,
  /** 聚焦第一个带有data-autofocus属性的可聚焦元素 */
  AutoFocus = 1 << 6,
}

/**
 * FocusResult枚举 - 定义焦点操作的结果
 */
export enum FocusResult {
  /** 聚焦过程中出现错误 */
  Error,
  /** 启用WrapAround时，超出最后一个元素 */
  Overflow,
  /** 焦点设置成功 */
  Success,
  /** 启用WrapAround时，超出第一个元素 */
  Underflow,
}

/**
 * Direction枚举 - 定义焦点移动的方向
 */
enum Direction {
  Previous = -1,
  Next = 1,
}

// =============================================================================
// 焦点元素查找
// 在DOM中查找和处理可聚焦元素
// =============================================================================

/**
 * 获取容器内所有可聚焦元素
 * @param container - DOM容器，默认为document.body
 * @returns 按tabIndex排序的可聚焦元素数组
 */
export function getFocusableElements(container: HTMLElement | null = document.body) {
  if (container == null) return []
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).sort(
    // 将tabIndex=0的元素移到列表末尾，模拟浏览器行为
    (a, z) =>
      Math.sign((a.tabIndex || Number.MAX_SAFE_INTEGER) - (z.tabIndex || Number.MAX_SAFE_INTEGER))
  )
}

/**
 * 获取容器内所有自动聚焦元素
 * @param container - DOM容器，默认为document.body
 * @returns 按tabIndex排序的自动聚焦元素数组
 */
export function getAutoFocusableElements(container: HTMLElement | null = document.body) {
  if (container == null) return []
  return Array.from(container.querySelectorAll<HTMLElement>(autoFocusableSelector)).sort(
    (a, z) =>
      Math.sign((a.tabIndex || Number.MAX_SAFE_INTEGER) - (z.tabIndex || Number.MAX_SAFE_INTEGER))
  )
}

// =============================================================================
// 可聚焦性判断
// 确定元素是否可以接收焦点
// =============================================================================

/**
 * 可聚焦模式枚举 - 定义元素可聚焦性的判断方式
 */
export enum FocusableMode {
  /** 严格模式 - 元素本身必须是可聚焦的 */
  Strict,
  /** 宽松模式 - 元素或其祖先元素之一必须是可聚焦的 */
  Loose,
}

/**
 * 判断元素是否可聚焦
 * @param element - 要判断的元素
 * @param mode - 判断模式，默认为严格模式
 */
export function isFocusableElement(
  element: HTMLElement,
  mode: FocusableMode = FocusableMode.Strict
) {
  if (element === getOwnerDocument(element)?.body) return false

  return match(mode, {
    [FocusableMode.Strict]() {
      return element.matches(focusableSelector)
    },
    [FocusableMode.Loose]() {
      let next: HTMLElement | null = element
      while (next !== null) {
        if (next.matches(focusableSelector)) return true
        next = next.parentElement
      }
      return false
    },
  })
}

// =============================================================================
// 焦点恢复和管理
// 处理焦点的设置、恢复和键盘交互
// =============================================================================

/**
 * 必要时恢复焦点
 * 在下一帧检查并恢复焦点到指定元素
 */
export function restoreFocusIfNecessary(element: HTMLElement | null) {
  let ownerDocument = getOwnerDocument(element)
  disposables().nextFrame(() => {
    if (
      ownerDocument &&
      !isFocusableElement(ownerDocument.activeElement as HTMLElement, FocusableMode.Strict)
    ) {
      focusElement(element)
    }
  })
}

/**
 * 激活方法枚举 - 定义用户如何触发动作
 * 用于确定如何恢复焦点
 */
enum ActivationMethod {
  /* 通过键盘事件触发 */
  Keyboard = 0,
  /* 通过鼠标/指针等事件触发 */
  Mouse = 1,
}

// =============================================================================
// 焦点可见性处理
// 在html元素上设置data-headlessui-focus-visible属性
// =============================================================================

// 初始化全局事件监听器，处理焦点可见性
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // 键盘事件监听器
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.metaKey || event.altKey || event.ctrlKey) {
        return
      }
      document.documentElement.dataset.headlessuiFocusVisible = ''
    },
    true
  )

  // 点击事件监听器
  document.addEventListener(
    'click',
    (event) => {
      // 鼠标点击 - 移除焦点可见性
      if (event.detail === ActivationMethod.Mouse) {
        delete document.documentElement.dataset.headlessuiFocusVisible
      }
      // 键盘触发的点击 - 添加焦点可见性
      else if (event.detail === ActivationMethod.Keyboard) {
        document.documentElement.dataset.headlessuiFocusVisible = ''
      }
    },
    true
  )
}

/**
 * 设置元素焦点
 * @param element - 要聚焦的元素
 */
export function focusElement(element: HTMLElement | null) {
  element?.focus({ preventScroll: true })
}

// =============================================================================
// 文本选择处理
// 处理输入框的文本选择行为
// =============================================================================

/**
 * 可选择文本的元素选择器
 */
let selectableSelector = ['textarea', 'input'].join(',')

/**
 * 判断元素是否可以选择文本
 */
function isSelectableElement(
  element: Element | null
): element is HTMLInputElement | HTMLTextAreaElement {
  return element?.matches?.(selectableSelector) ?? false
}

// =============================================================================
// DOM节点排序
// 按照文档顺序排序DOM节点
// =============================================================================

/**
 * 按DOM顺序排序节点
 * @param nodes - 要排序的节点数组
 * @param resolveKey - 从项目中解析出DOM节点的函数
 */
export function sortByDomNode<T>(
  nodes: T[],
  resolveKey: (item: T) => HTMLElement | null = (i) => i as HTMLElement | null
): T[] {
  return nodes.slice().sort((aItem, zItem) => {
    let a = resolveKey(aItem)
    let z = resolveKey(zItem)
    if (a === null || z === null) return 0

    let position = a.compareDocumentPosition(z)
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1
    return 0
  })
}

// =============================================================================
// 焦点移动
// 在可聚焦元素之间移动焦点
// =============================================================================

/**
 * 从当前元素移动焦点
 * @param current - 当前聚焦的元素
 * @param focus - 焦点移动行为
 */
export function focusFrom(current: HTMLElement | null, focus: Focus) {
  return focusIn(getFocusableElements(), focus, { relativeTo: current })
}

/**
 * 在指定容器内移动焦点
 * @param container - 容器元素或元素数组
 * @param focus - 焦点移动行为
 * @param options - 配置选项
 */
export function focusIn(
  container: HTMLElement | HTMLElement[],
  focus: Focus,
  {
    sorted = true,
    relativeTo = null,
    skipElements = [],
  }: Partial<{
    sorted: boolean
    relativeTo: HTMLElement | null
    skipElements: (HTMLElement | MutableRefObject<HTMLElement | null>)[]
  }> = {}
) {
  let ownerDocument = Array.isArray(container)
    ? container.length > 0
      ? container[0].ownerDocument
      : document
    : container.ownerDocument

  let elements = Array.isArray(container)
    ? sorted
      ? sortByDomNode(container)
      : container
    : focus & Focus.AutoFocus
      ? getAutoFocusableElements(container)
      : getFocusableElements(container)

  // 排除要跳过的元素
  if (skipElements.length > 0 && elements.length > 1) {
    elements = elements.filter(
      (element) =>
        !skipElements.some(
          (skipElement) =>
            skipElement != null && 'current' in skipElement
              ? skipElement?.current === element // 处理MutableRefObject
              : skipElement === element // 直接处理HTMLElement
        )
    )
  }

  relativeTo = relativeTo ?? (ownerDocument.activeElement as HTMLElement)

  // 确定移动方向
  let direction = (() => {
    if (focus & (Focus.First | Focus.Next)) return Direction.Next
    if (focus & (Focus.Previous | Focus.Last)) return Direction.Previous
    throw new Error('Missing Focus.First, Focus.Previous, Focus.Next or Focus.Last')
  })()

  // 确定起始索引
  let startIndex = (() => {
    if (focus & Focus.First) return 0
    if (focus & Focus.Previous) return Math.max(0, elements.indexOf(relativeTo)) - 1
    if (focus & Focus.Next) return Math.max(0, elements.indexOf(relativeTo)) + 1
    if (focus & Focus.Last) return elements.length - 1
    throw new Error('Missing Focus.First, Focus.Previous, Focus.Next or Focus.Last')
  })()

  // 设置焦点选项
  let focusOptions = focus & Focus.NoScroll ? { preventScroll: true } : {}

  // 尝试设置焦点
  let offset = 0
  let total = elements.length
  let next = undefined
  do {
    // 防止无限循环
    if (offset >= total || offset + total <= 0) return FocusResult.Error

    let nextIdx = startIndex + offset
    if (focus & Focus.WrapAround) {
      nextIdx = (nextIdx + total) % total
    } else {
      if (nextIdx < 0) return FocusResult.Underflow
      if (nextIdx >= total) return FocusResult.Overflow
    }

    next = elements[nextIdx]
    // 尝试聚焦下一个元素
    next?.focus(focusOptions)
    // 继续尝试下一个
    offset += direction
  } while (next !== ownerDocument.activeElement)

  // 处理文本选择
  // 对于文本输入和文本区域，手动设置焦点时需要模拟浏览器的文本选择行为
  if (focus & (Focus.Next | Focus.Previous) && isSelectableElement(next)) {
    next.select()
  }

  return FocusResult.Success
}
