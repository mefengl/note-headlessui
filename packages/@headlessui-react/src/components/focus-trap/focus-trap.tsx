/**
 * focus-trap.tsx - 焦点陷阱组件
 * 
 * 该组件用于限制键盘焦点在指定的DOM范围内，常用于模态框、下拉菜单等需要
 * 限制用户焦点的场景。支持以下核心功能：
 * 1. 初始焦点管理
 * 2. Tab键循环
 * 3. 焦点锁定
 * 4. 焦点恢复
 * 5. 自动焦点
 * 
 * 使用示例：
 * ```tsx
 * // 1. 基础用法
 * <FocusTrap>
 *   <div>焦点将被限制在这个div内</div>
 * </FocusTrap>
 * 
 * // 2. 自定义初始焦点
 * const initialRef = useRef(null)
 * <FocusTrap initialFocus={initialRef}>
 *   <button ref={initialRef}>这个按钮将获得初始焦点</button>
 *   <button>其他按钮</button>
 * </FocusTrap>
 * 
 * // 3. 禁用某些特性
 * <FocusTrap features={FocusTrapFeatures.TabLock | FocusTrapFeatures.RestoreFocus}>
 *   <div>只启用Tab锁定和焦点恢复</div>
 * </FocusTrap>
 * ```
 */

'use client'

import React, {
  useRef,
  type ElementType,
  type MutableRefObject,
  type FocusEvent as ReactFocusEvent,
  type Ref,
} from 'react'
import { useDisposables } from '../../hooks/use-disposables'
import { useEvent } from '../../hooks/use-event'
import { useEventListener } from '../../hooks/use-event-listener'
import { useIsMounted } from '../../hooks/use-is-mounted'
import { useIsTopLayer } from '../../hooks/use-is-top-layer'
import { useOnUnmount } from '../../hooks/use-on-unmount'
import { useOwnerDocument } from '../../hooks/use-owner'
import { useServerHandoffComplete } from '../../hooks/use-server-handoff-complete'
import { useSyncRefs } from '../../hooks/use-sync-refs'
import { Direction as TabDirection, useTabDirection } from '../../hooks/use-tab-direction'
import { useWatch } from '../../hooks/use-watch'
import { Hidden, HiddenFeatures } from '../../internal/hidden'
import type { Props } from '../../types'
import { history } from '../../utils/active-element-history'
import { Focus, FocusResult, focusElement, focusIn } from '../../utils/focus-management'
import { match } from '../../utils/match'
import { microTask } from '../../utils/micro-task'
import { forwardRefWithAs, useRender, type HasDisplayName, type RefProp } from '../../utils/render'

/**
 * 容器类型定义
 * 支持两种方式获取容器：
 * 1. 函数方式：返回一个包含HTML元素的可迭代对象
 * 2. 引用方式：一个包含HTML元素引用集合的ref
 */
type Containers =
  | (() => Iterable<HTMLElement>)
  | MutableRefObject<Set<MutableRefObject<HTMLElement | null>>>

/**
 * 解析容器集合
 * 将不同形式的容器配置统一转换为HTMLElement集合
 */
function resolveContainers(containers?: Containers): Set<HTMLElement> {
  if (!containers) return new Set<HTMLElement>()
  if (typeof containers === 'function') return new Set(containers())
  let all = new Set<HTMLElement>()
  for (let container of containers.current) {
    if (container.current instanceof HTMLElement) {
      all.add(container.current)
    }
  }
  return all
}

// 默认渲染为div元素
let DEFAULT_FOCUS_TRAP_TAG = 'div' as const

/**
 * 焦点陷阱特性枚举
 * 使用位运算实现特性组合
 */
export enum FocusTrapFeatures {
  /** 不启用任何特性 */
  None = 0,
  /** 确保初始化时移动焦点到容器内 */
  InitialFocus = 1 << 0,
  /** 确保Tab键和Shift+Tab在容器内循环 */
  TabLock = 1 << 1,
  /** 阻止程序将焦点移出容器 */
  FocusLock = 1 << 2,
  /** 组件卸载时恢复之前的焦点 */
  RestoreFocus = 1 << 3,
  /** 初始焦点会寻找带有data-autofocus属性的元素 */
  AutoFocus = 1 << 4,
}

// 组件属性类型定义
type FocusTrapRenderPropArg = {}
type FocusTrapPropsWeControl = never

/**
 * FocusTrap组件属性类型
 */
export type FocusTrapProps<TTag extends ElementType = typeof DEFAULT_FOCUS_TRAP_TAG> = Props<
  TTag,
  FocusTrapRenderPropArg,
  FocusTrapPropsWeControl,
  {
    initialFocus?: MutableRefObject<HTMLElement | null>    // 初始焦点元素
    initialFocusFallback?: MutableRefObject<HTMLElement | null> // 初始焦点备选元素
    features?: FocusTrapFeatures   // 启用的特性
    containers?: Containers        // 额外的焦点容器
  }
>

/**
 * FocusTrap组件实现
 * 核心功能：
 * 1. 管理焦点历史
 * 2. 处理Tab键导航
 * 3. 限制焦点范围
 * 4. 自动恢复焦点
 */
function FocusTrapFn<TTag extends ElementType = typeof DEFAULT_FOCUS_TRAP_TAG>(
  props: FocusTrapProps<TTag>,
  ref: Ref<HTMLElement>
) {
  let container = useRef<HTMLElement | null>(null)
  let focusTrapRef = useSyncRefs(container, ref)
  
  let {
    initialFocus,
    initialFocusFallback,
    containers,
    // 默认启用：初始焦点、Tab锁定、焦点锁定和焦点恢复
    features = FocusTrapFeatures.InitialFocus |
      FocusTrapFeatures.TabLock |
      FocusTrapFeatures.FocusLock |
      FocusTrapFeatures.RestoreFocus,
    ...theirProps
  } = props

  // SSR时禁用所有特性
  if (!useServerHandoffComplete()) {
    features = FocusTrapFeatures.None
  }

  let ownerDocument = useOwnerDocument(container)

  // 处理焦点恢复
  useRestoreFocus(features, { ownerDocument })

  // 处理初始焦点
  let previousActiveElement = useInitialFocus(features, {
    ownerDocument,
    container,
    initialFocus,
    initialFocusFallback,
  })

  // 实现焦点锁定
  useFocusLock(features, { ownerDocument, container, containers, previousActiveElement })

  let direction = useTabDirection()

  // 处理焦点移动
  let handleFocus = useEvent((e: ReactFocusEvent) => {
    let el = container.current as HTMLElement
    if (!el) return

    // 在测试环境中使用microTask以确保稳定性
    let wrapper = process.env.NODE_ENV === 'test' ? microTask : (cb: Function) => cb()

    wrapper(() => {
      match(direction.current, {
        // Tab键：移到第一个可聚焦元素
        [TabDirection.Forwards]: () => {
          focusIn(el, Focus.First, {
            skipElements: [e.relatedTarget, initialFocusFallback] as HTMLElement[],
          })
        },
        // Shift+Tab：移到最后一个可聚焦元素
        [TabDirection.Backwards]: () => {
          focusIn(el, Focus.Last, {
            skipElements: [e.relatedTarget, initialFocusFallback] as HTMLElement[],
          })
        },
      })
    })
  })

  // 检查Tab锁定是否启用
  let tabLockEnabled = useIsTopLayer(
    Boolean(features & FocusTrapFeatures.TabLock),
    'focus-trap#tab-lock'
  )

  let d = useDisposables()
  let recentlyUsedTabKey = useRef(false)

  // 处理键盘事件和焦点丢失
  let ourProps = {
    ref: focusTrapRef,
    onKeyDown(e: KeyboardEvent) {
      if (e.key == 'Tab') {
        recentlyUsedTabKey.current = true
        d.requestAnimationFrame(() => {
          recentlyUsedTabKey.current = false
        })
      }
    },
    onBlur(e: ReactFocusEvent) {
      // 焦点锁定未启用则不处理
      if (!(features & FocusTrapFeatures.FocusLock)) return

      let allContainers = resolveContainers(containers)
      if (container.current instanceof HTMLElement) allContainers.add(container.current)

      let relatedTarget = e.relatedTarget
      if (!(relatedTarget instanceof HTMLElement)) return

      // 忽略焦点守卫元素
      if (relatedTarget.dataset.headlessuiFocusGuard === 'true') {
        return
      }

      // 焦点移出所有容器时处理
      if (!contains(allContainers, relatedTarget)) {
        // 通过Tab键移动焦点：移到下一个元素
        if (recentlyUsedTabKey.current) {
          focusIn(
            container.current as HTMLElement,
            match(direction.current, {
              [TabDirection.Forwards]: () => Focus.Next,
              [TabDirection.Backwards]: () => Focus.Previous,
            }) | Focus.WrapAround,
            { relativeTo: e.target as HTMLElement }
          )
        }
        // 其他方式失去焦点：返回到上一个活动元素
        else if (e.target instanceof HTMLElement) {
          focusElement(e.target)
        }
      }
    },
  }

  let render = useRender()

  // 渲染焦点陷阱
  return (
    <>
      {/* 前置焦点守卫 */}
      {tabLockEnabled && (
        <Hidden
          as="button"
          type="button"
          data-headlessui-focus-guard
          onFocus={handleFocus}
          features={HiddenFeatures.Focusable}
        />
      )}

      {/* 主要内容 */}
      {render({
        ourProps,
        theirProps,
        defaultTag: DEFAULT_FOCUS_TRAP_TAG,
        name: 'FocusTrap',
      })}

      {/* 后置焦点守卫 */}
      {tabLockEnabled && (
        <Hidden
          as="button"
          type="button"
          data-headlessui-focus-guard
          onFocus={handleFocus}
          features={HiddenFeatures.Focusable}
        />
      )}
    </>
  )
}

// 组件类型定义
export interface _internal_ComponentFocusTrap extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_FOCUS_TRAP_TAG>(
    props: FocusTrapProps<TTag> & RefProp<typeof FocusTrapFn>
  ): React.JSX.Element
}

// 创建最终的FocusTrap组件
let FocusTrapRoot = forwardRefWithAs(FocusTrapFn) as _internal_ComponentFocusTrap
export let FocusTrap = Object.assign(FocusTrapRoot, {
  /** @deprecated use `FocusTrapFeatures` instead of `FocusTrap.features` */
  features: FocusTrapFeatures,
})

/**
 * useRestoreElement - 管理需要恢复焦点的元素
 * 
 * 追踪并记录焦点历史，以便在需要时恢复到正确的元素
 */
function useRestoreElement(enabled: boolean = true) {
  let localHistory = useRef<HTMLElement[]>(history.slice())
  
  useWatch(
    ([newEnabled], [oldEnabled]) => {
      // 禁用恢复功能时清除历史
      if (oldEnabled === true && newEnabled === false) {
        microTask(() => {
          localHistory.current.splice(0)
        })
      }
      // 启用恢复功能时记录当前历史
      if (oldEnabled === false && newEnabled === true) {
        localHistory.current = history.slice()
      }
    },
    [enabled, history, localHistory]
  )

  // 返回最后一个仍在DOM中的元素
  return useEvent(() => {
    return localHistory.current.find((x) => x != null && x.isConnected) ?? null
  })
}

/**
 * useRestoreFocus - 实现焦点恢复功能
 * 
 * 在以下情况恢复焦点：
 * 1. enabled变为false时
 * 2. 组件卸载时
 */
function useRestoreFocus(
  features: FocusTrapFeatures,
  { ownerDocument }: { ownerDocument: Document | null }
) {
  let enabled = Boolean(features & FocusTrapFeatures.RestoreFocus)
  let getRestoreElement = useRestoreElement(enabled)

  // enabled变为false时恢复焦点
  useWatch(() => {
    if (enabled) return
    if (ownerDocument?.activeElement === ownerDocument?.body) {
      focusElement(getRestoreElement())
    }
  }, [enabled])

  // 组件卸载时恢复焦点
  useOnUnmount(() => {
    if (!enabled) return
    focusElement(getRestoreElement())
  })
}

/**
 * useInitialFocus - 实现初始焦点功能
 * 
 * 焦点设置优先级：
 * 1. initialFocus指定的元素
 * 2. 带有data-autofocus属性的元素（如果启用AutoFocus）
 * 3. 容器内第一个可聚焦元素
 * 4. initialFocusFallback指定的元素
 */
function useInitialFocus(
  features: FocusTrapFeatures,
  {
    ownerDocument,
    container,
    initialFocus,
    initialFocusFallback,
  }: {
    ownerDocument: Document | null
    container: MutableRefObject<HTMLElement | null>
    initialFocus?: MutableRefObject<HTMLElement | null>
    initialFocusFallback?: MutableRefObject<HTMLElement | null>
  }
) {
  let previousActiveElement = useRef<HTMLElement | null>(null)
  let enabled = useIsTopLayer(
    Boolean(features & FocusTrapFeatures.InitialFocus),
    'focus-trap#initial-focus'
  )
  let mounted = useIsMounted()

  useWatch(() => {
    if (features === FocusTrapFeatures.None) return
    
    if (!enabled) {
      // InitialFocus禁用时，尝试聚焦fallback元素
      if (initialFocusFallback?.current) {
        focusElement(initialFocusFallback.current)
      }
      return
    }

    let containerElement = container.current
    if (!containerElement) return

    // 延迟到下一个微任务执行焦点设置
    // 这样可以：
    // 1. 确保容器已渲染
    // 2. 避免中断过渡动画
    // 3. 防止页面滚动问题
    microTask(() => {
      if (!mounted.current) return

      let activeElement = ownerDocument?.activeElement as HTMLElement
      
      // 检查是否已经有正确的焦点
      if (initialFocus?.current) {
        if (initialFocus?.current === activeElement) {
          previousActiveElement.current = activeElement
          return
        }
      } else if (containerElement!.contains(activeElement)) {
        previousActiveElement.current = activeElement
        return
      }

      // 尝试设置焦点
      if (initialFocus?.current) {
        focusElement(initialFocus.current)
      } else {
        if (features & FocusTrapFeatures.AutoFocus) {
          // 尝试聚焦第一个带有autofocus的元素
          if (focusIn(containerElement!, Focus.First | Focus.AutoFocus) !== FocusResult.Error) {
            return
          }
        } else if (focusIn(containerElement!, Focus.First) !== FocusResult.Error) {
          return
        }
        
        // 尝试聚焦fallback元素
        if (initialFocusFallback?.current) {
          focusElement(initialFocusFallback.current)
          if (ownerDocument?.activeElement === initialFocusFallback.current) {
            return
          }
        }

        // 都失败了，输出警告
        console.warn('There are no focusable elements inside the <FocusTrap />')
      }

      previousActiveElement.current = ownerDocument?.activeElement as HTMLElement
    })
  }, [initialFocusFallback, enabled, features])

  return previousActiveElement
}

/**
 * useFocusLock - 实现焦点锁定功能
 * 
 * 防止焦点通过程序方式移出容器，如：
 * 1. input.focus()
 * 2. button.focus()
 * 3. 其他可以设置焦点的DOM API
 */
function useFocusLock(
  features: FocusTrapFeatures,
  {
    ownerDocument,
    container,
    containers,
    previousActiveElement,
  }: {
    ownerDocument: Document | null
    container: MutableRefObject<HTMLElement | null>
    containers?: Containers
    previousActiveElement: MutableRefObject<HTMLElement | null>
  }
) {
  let mounted = useIsMounted()
  let enabled = Boolean(features & FocusTrapFeatures.FocusLock)

  useEventListener(
    ownerDocument?.defaultView,
    'focus',
    (event) => {
      if (!enabled) return
      if (!mounted.current) return

      let allContainers = resolveContainers(containers)
      if (container.current instanceof HTMLElement) allContainers.add(container.current)

      let previous = previousActiveElement.current
      if (!previous) return

      let toElement = event.target as HTMLElement | null
      
      if (toElement && toElement instanceof HTMLElement) {
        // 焦点移出容器时，阻止事件并恢复焦点
        if (!contains(allContainers, toElement)) {
          event.preventDefault()
          event.stopPropagation()
          focusElement(previous)
        } else {
          // 更新上一个焦点元素
          previousActiveElement.current = toElement
          focusElement(toElement)
        }
      } else {
        focusElement(previousActiveElement.current)
      }
    },
    true
  )
}

/**
 * 工具函数：检查元素是否在容器集合内
 */
function contains(containers: Set<HTMLElement>, element: HTMLElement) {
  for (let container of containers) {
    if (container.contains(element)) return true
  }
  return false
}
