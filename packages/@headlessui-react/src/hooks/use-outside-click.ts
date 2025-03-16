import { useCallback, useRef } from 'react'
import { FocusableMode, isFocusableElement } from '../utils/focus-management'
import { isMobile } from '../utils/platform'
import { useDocumentEvent } from './use-document-event'
import { useIsTopLayer } from './use-is-top-layer'
import { useLatestValue } from './use-latest-value'
import { useWindowEvent } from './use-window-event'

/**
 * 定义容器类型，可以是单个元素或元素集合
 */
type Container = HTMLElement | null
type ContainerCollection = Container[] | Set<Container>
type ContainerInput = Container | ContainerCollection

/**
 * 触摸滑动阈值(像素)
 * 如果用户的手指移动超过这个距离，我们认为这是一个滑动操作而不是点击。
 * 这可以防止在滚动时触发点击事件，同时也允许用户通过滑动来"取消"点击。
 */
const MOVE_THRESHOLD_PX = 30

/**
 * useOutsideClick - 复杂的外部点击检测钩子
 * 
 * 这是一个高级的外部点击检测系统，处理了各种边缘情况，包括:
 * - 移动端的触摸事件
 * - 滚动vs点击的区分
 * - 嵌套组件的层级管理
 * - Shadow DOM的边界穿透
 * - iframe交互
 * 
 * 工作原理:
 * 1. 跟踪初始点击/触摸位置
 * 2. 使用层级系统确保正确的事件处理顺序
 * 3. 处理移动端的滑动取消机制
 * 4. 支持多个容器的联合检测
 * 
 * 基础用例:
 * ```tsx
 * function Dropdown() {
 *   useOutsideClick(
 *     isOpen,           // 只在打开时启用
 *     menuButtonRef,    // 点击按钮不算外部点击
 *     () => setIsOpen(false)
 *   )
 *   
 *   return (
 *     <button ref={menuButtonRef}>
 *       {isOpen && <DropdownMenu />}
 *     </button>
 *   )
 * }
 * ```
 * 
 * 高级用例:
 * ```tsx
 * // 处理多个容器
 * useOutsideClick(
 *   true,
 *   [buttonRef, menuRef],
 *   () => close()
 * )
 * 
 * // 动态容器集合
 * useOutsideClick(
 *   true,
 *   () => getAllPopups(), // 返回当前所有弹出框
 *   () => closeAll()
 * )
 * ```
 * 
 * 特性:
 * 1. 智能的移动端支持
 *    - 区分滑动和点击
 *    - 支持触摸取消
 * 2. 层级感知
 *    - 与useIsTopLayer集成
 *    - 处理嵌套组件的事件传播
 * 3. Shadow DOM支持
 *    - 使用composedPath检测边界
 * 4. iframe交互处理
 *    - 检测iframe焦点变化
 * 
 * @param enabled 是否启用外部点击检测
 * @param containers 不触发外部点击的容器。可以是单个元素、元素数组、Set或返回这些类型的函数
 * @param cb 外部点击时的回调函数，接收事件对象和目标元素
 */
export function useOutsideClick(
  enabled: boolean,
  containers: ContainerInput | (() => ContainerInput),
  cb: (event: MouseEvent | PointerEvent | FocusEvent | TouchEvent, target: HTMLElement) => void
) {
  // 使用层级系统确保正确的事件处理顺序
  let isTopLayer = useIsTopLayer(enabled, 'outside-click')
  let cbRef = useLatestValue(cb)

  let handleOutsideClick = useCallback(
    function handleOutsideClick<E extends MouseEvent | PointerEvent | FocusEvent | TouchEvent>(
      event: E,
      resolveTarget: (event: E) => HTMLElement | null
    ) {
      // 检查事件是否已被阻止。这可能发生在嵌套组件中，
      // 比如Menu在Dialog中时，内部Menu需要先处理事件
      if (event.defaultPrevented) return

      let target = resolveTarget(event)
      if (target === null) return

      // 忽略已经从DOM中移除的目标
      if (!target.getRootNode().contains(target)) return
      if (!target.isConnected) return

      // 解析容器集合
      let _containers = (function resolve(containers): ContainerCollection {
        if (typeof containers === 'function') {
          return resolve(containers())
        }
        if (Array.isArray(containers)) {
          return containers
        }
        if (containers instanceof Set) {
          return containers
        }
        return [containers]
      })(containers)

      // 检查目标是否在任一容器内
      for (let container of _containers) {
        if (container === null) continue
        if (container.contains(target)) return
        
        // 使用composedPath检查Shadow DOM边界
        if (event.composed && event.composedPath().includes(container as EventTarget)) {
          return
        }
      }

      // 可聚焦元素的特殊处理
      // 这允许在Menu A打开时点击Menu B的按钮能正确工作:
      // Menu A会关闭，Menu B会打开
      if (
        !isFocusableElement(target, FocusableMode.Loose) &&
        target.tabIndex !== -1
      ) {
        event.preventDefault()
      }

      return cbRef.current(event, target)
    },
    [cbRef, containers]
  )

  // 跟踪初始点击目标
  let initialClickTarget = useRef<EventTarget | null>(null)

  // 捕获初始点击位置(鼠标)
  useDocumentEvent(
    isTopLayer,
    'pointerdown',
    (event) => {
      initialClickTarget.current = event.composedPath?.()?.[0] || event.target
    },
    true
  )

  useDocumentEvent(
    isTopLayer,
    'mousedown',
    (event) => {
      initialClickTarget.current = event.composedPath?.()?.[0] || event.target
    },
    true
  )

  // 处理实际点击
  useDocumentEvent(
    isTopLayer,
    'click',
    (event) => {
      if (isMobile()) return
      if (!initialClickTarget.current) return

      handleOutsideClick(event, () => {
        return initialClickTarget.current as HTMLElement
      })
      initialClickTarget.current = null
    },
    // 使用捕获阶段以避免被stopPropagation阻止
    true
  )

  // 触摸事件处理
  let startPosition = useRef({ x: 0, y: 0 })

  // 记录触摸起始位置
  useDocumentEvent(
    isTopLayer,
    'touchstart',
    (event) => {
      startPosition.current.x = event.touches[0].clientX
      startPosition.current.y = event.touches[0].clientY
    },
    true
  )

  // 处理触摸结束
  useDocumentEvent(
    isTopLayer,
    'touchend',
    (event) => {
      // 计算触摸移动距离，如果超过阈值则忽略
      let endPosition = { 
        x: event.changedTouches[0].clientX, 
        y: event.changedTouches[0].clientY 
      }
      
      if (
        Math.abs(endPosition.x - startPosition.current.x) >= MOVE_THRESHOLD_PX ||
        Math.abs(endPosition.y - startPosition.current.y) >= MOVE_THRESHOLD_PX
      ) {
        return
      }

      // 处理触摸结束事件
      return handleOutsideClick(event, () => {
        if (event.target instanceof HTMLElement) {
          return event.target
        }
        return null
      })
    },
    true
  )

  // iframe交互处理
  // 当window失去焦点且活动元素是iframe时，
  // 说明用户点击了iframe内的内容
  useWindowEvent(
    isTopLayer,
    'blur',
    (event) => {
      return handleOutsideClick(event, () => {
        return window.document.activeElement instanceof HTMLIFrameElement
          ? window.document.activeElement
          : null
      })
    },
    true
  )
}
