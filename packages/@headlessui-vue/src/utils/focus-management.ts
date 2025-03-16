import { nextTick } from 'vue'
import { match } from './match'
import { getOwnerDocument } from './owner'

// =============================================================================
// 可聚焦元素选择器
// 与React版本完全相同的实现
// =============================================================================

/**
 * 可聚焦元素的CSS选择器列表
 * 来源: https://stackoverflow.com/a/30753870
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
      ? // JSDOM特殊处理
        (selector) => `${selector}:not([tabindex='-1']):not([style*='display: none'])`
      : (selector) => `${selector}:not([tabindex='-1'])`
  )
  .join(',')

// =============================================================================
// 焦点管理枚举
// 与React版本基本相同，但不包含AutoFocus特性
// =============================================================================

/**
 * Focus枚举
 * 注意: Vue版本不包含AutoFocus特性，因为Vue有自己的autofocus指令
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
}

/**
 * FocusResult枚举
 * 与React版本完全相同
 */
export enum FocusResult {
  Error,
  Overflow,
  Success,
  Underflow,
}

/**
 * Direction枚举
 * 与React版本完全相同
 */
enum Direction {
  Previous = -1,
  Next = 1,
}

// =============================================================================
// 焦点元素操作
// 基本功能与React版本相同，但使用Vue的工具函数
// =============================================================================

/**
 * 获取容器内所有可聚焦元素
 * 实现与React版本相同，但用于Vue组件环境
 */
export function getFocusableElements(container: HTMLElement | null = document.body) {
  if (container == null) return []
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).sort(
    (a, z) =>
      Math.sign((a.tabIndex || Number.MAX_SAFE_INTEGER) - (z.tabIndex || Number.MAX_SAFE_INTEGER))
  )
}

/**
 * FocusableMode枚举
 * 与React版本完全相同
 */
export enum FocusableMode {
  /** 元素本身必须是可聚焦的 */
  Strict,
  /** 元素应该在可聚焦元素内部 */
  Loose,
}

/**
 * 判断元素是否可聚焦
 * 实现与React版本相同
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
// 焦点恢复处理
// 主要区别：使用Vue的nextTick而不是React的requestAnimationFrame
// =============================================================================

/**
 * 必要时恢复焦点
 * 区别: 使用Vue的nextTick代替React的requestAnimationFrame
 */
export function restoreFocusIfNecessary(element: HTMLElement | null) {
  let ownerDocument = getOwnerDocument(element)
  nextTick(() => {
    if (
      ownerDocument &&
      !isFocusableElement(ownerDocument.activeElement as HTMLElement, FocusableMode.Strict)
    ) {
      focusElement(element)
    }
  })
}

/**
 * 激活方法枚举
 * 与React版本完全相同
 */
enum ActivationMethod {
  Keyboard = 0,
  Mouse = 1,
}

// =============================================================================
// 焦点可见性处理
// 与React版本完全相同的实现
// =============================================================================

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
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

  document.addEventListener(
    'click',
    (event) => {
      if (event.detail === ActivationMethod.Mouse) {
        delete document.documentElement.dataset.headlessuiFocusVisible
      } else if (event.detail === ActivationMethod.Keyboard) {
        document.documentElement.dataset.headlessuiFocusVisible = ''
      }
    },
    true
  )
}

/**
 * 设置元素焦点
 * 与React版本完全相同
 */
export function focusElement(element: HTMLElement | null) {
  element?.focus({ preventScroll: true })
}

// =============================================================================
// 文本选择处理
// 与React版本完全相同的实现
// =============================================================================

let selectableSelector = ['textarea', 'input'].join(',')

function isSelectableElement(
  element: Element | null
): element is HTMLInputElement | HTMLTextAreaElement {
  return element?.matches?.(selectableSelector) ?? false
}

// =============================================================================
// DOM节点排序
// 基本相同，但类型处理略有不同以适应Vue
// =============================================================================

/**
 * 按DOM顺序排序节点
 * 区别: 类型转换使用unknown作为中间类型，以适应Vue的类型系统
 */
export function sortByDomNode<T>(
  nodes: T[],
  resolveKey: (item: T) => HTMLElement | null = (i) => i as unknown as HTMLElement | null
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
// 基本相同，但简化了一些类型处理
// =============================================================================

/**
 * 从当前元素移动焦点
 * 与React版本完全相同
 */
export function focusFrom(current: HTMLElement | null, focus: Focus) {
  return focusIn(getFocusableElements(), focus, { relativeTo: current })
}

/**
 * 在指定容器内移动焦点
 * 区别: 
 * 1. 简化了skipElements的类型(不处理Ref)
 * 2. 文档获取逻辑略有调整
 */
export function focusIn(
  container: HTMLElement | HTMLElement[],
  focus: Focus,
  {
    sorted = true,
    relativeTo = null,
    skipElements = [],
  }: Partial<{ sorted: boolean; relativeTo: HTMLElement | null; skipElements: HTMLElement[] }> = {}
) {
  // Vue版本的文档获取逻辑略有不同
  let ownerDocument =
    (Array.isArray(container)
      ? container.length > 0
        ? container[0].ownerDocument
        : document
      : container?.ownerDocument) ?? document

  let elements = Array.isArray(container)
    ? sorted
      ? sortByDomNode(container)
      : container
    : getFocusableElements(container)

  // 简化的skipElements处理
  if (skipElements.length > 0 && elements.length > 1) {
    elements = elements.filter((x) => !skipElements.includes(x))
  }

  relativeTo = relativeTo ?? (ownerDocument.activeElement as HTMLElement)

  // 以下逻辑与React版本完全相同
  let direction = (() => {
    if (focus & (Focus.First | Focus.Next)) return Direction.Next
    if (focus & (Focus.Previous | Focus.Last)) return Direction.Previous
    throw new Error('Missing Focus.First, Focus.Previous, Focus.Next or Focus.Last')
  })()

  let startIndex = (() => {
    if (focus & Focus.First) return 0
    if (focus & Focus.Previous) return Math.max(0, elements.indexOf(relativeTo)) - 1
    if (focus & Focus.Next) return Math.max(0, elements.indexOf(relativeTo)) + 1
    if (focus & Focus.Last) return elements.length - 1
    throw new Error('Missing Focus.First, Focus.Previous, Focus.Next or Focus.Last')
  })()

  let focusOptions = focus & Focus.NoScroll ? { preventScroll: true } : {}

  let offset = 0
  let total = elements.length
  let next = undefined
  do {
    if (offset >= total || offset + total <= 0) return FocusResult.Error

    let nextIdx = startIndex + offset
    if (focus & Focus.WrapAround) {
      nextIdx = (nextIdx + total) % total
    } else {
      if (nextIdx < 0) return FocusResult.Underflow
      if (nextIdx >= total) return FocusResult.Overflow
    }

    next = elements[nextIdx]
    next?.focus(focusOptions)
    offset += direction
  } while (next !== ownerDocument.activeElement)

  if (focus & (Focus.Next | Focus.Previous) && isSelectableElement(next)) {
    next.select()
  }

  return FocusResult.Success
}
