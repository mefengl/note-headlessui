/**
 * focus-trap.ts - 焦点陷阱组件（Vue版本）
 * 
 * 焦点陷阱用于限制用户焦点在特定区域内，常用于：
 * 1. 模态框、对话框等需要限制焦点的场景
 * 2. 确保用户不会意外离开当前上下文
 * 3. 提高可访问性和用户体验
 * 
 * 特性：
 * - 自动捕获和限制Tab键焦点循环
 * - 支持初始焦点设置
 * - 支持焦点还原
 * - 支持多容器管理
 * - 完全支持键盘操作
 * 
 * 使用示例：
 * ```vue
 * <FocusTrap>
 *   <div>
 *     <button>焦点会被限制在这个区域内</button>
 *     <input type="text" />
 *     <a href="#">链接</a>
 *   </div>
 * </FocusTrap>
 * ```
 */

import {
  Fragment,
  computed,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  ref,
  watch,
  watchEffect,
  type PropType,
  type Ref,
} from 'vue'
import { useEventListener } from '../../hooks/use-event-listener'
import { Direction as TabDirection, useTabDirection } from '../../hooks/use-tab-direction'
import { Hidden, Features as HiddenFeatures } from '../../internal/hidden'
import { history } from '../../utils/active-element-history'
import { dom } from '../../utils/dom'
import { Focus, FocusResult, focusElement, focusIn } from '../../utils/focus-management'
import { match } from '../../utils/match'
import { microTask } from '../../utils/micro-task'
import { getOwnerDocument } from '../../utils/owner'
import { render } from '../../utils/render'

/**
 * 容器类型定义
 * 可以是函数返回的HTML元素集合
 * 或者是HTML元素引用的Set集合
 */
type Containers =
  | (() => Iterable<HTMLElement>)
  | Ref<Set<Ref<HTMLElement | null>>>

/**
 * 解析并获取所有有效的容器元素
 */
function resolveContainers(containers?: Containers): Set<HTMLElement> {
  if (!containers) return new Set<HTMLElement>()
  if (typeof containers === 'function') return new Set(containers())
  
  let all = new Set<HTMLElement>()
  for (let container of containers.value) {
    let el = dom(container)
    if (el instanceof HTMLElement) {
      all.add(el)
    }
  }
  return all
}

/**
 * 焦点陷阱功能特性枚举
 */
enum Features {
  /** 不启用任何特性 */
  None = 1 << 0,
  /** 确保初始化时将焦点移入容器 */
  InitialFocus = 1 << 1,
  /** 确保Tab和Shift+Tab的焦点在容器内循环 */
  TabLock = 1 << 2,
  /** 确保不允许通过编程方式将焦点移出容器 */
  FocusLock = 1 << 3,
  /** 确保卸载焦点陷阱时恢复焦点 */
  RestoreFocus = 1 << 4,
  /** 启用所有特性 */
  All = InitialFocus | TabLock | FocusLock | RestoreFocus,
}

/**
 * FocusTrap组件
 */
export let FocusTrap = Object.assign(
  defineComponent({
    name: 'FocusTrap',
    props: {
      as: { type: [Object, String], default: 'div' },
      initialFocus: { type: Object as PropType<HTMLElement | null>, default: null },
      features: { type: Number as PropType<Features>, default: Features.All },
      containers: {
        type: [Object, Function] as PropType<Containers>,
        default: ref(new Set()),
      },
    },
    inheritAttrs: false,
    setup(props, { attrs, slots, expose }) {
      let container = ref<HTMLElement | null>(null)
      expose({ el: container, $el: container })
      
      let ownerDocument = computed(() => getOwnerDocument(container))
      let mounted = ref(false)
      onMounted(() => (mounted.value = true))
      onUnmounted(() => (mounted.value = false))

      // 处理焦点还原
      useRestoreFocus(
        { ownerDocument },
        computed(() => mounted.value && Boolean(props.features & Features.RestoreFocus))
      )

      // 处理初始焦点
      let previousActiveElement = useInitialFocus(
        { ownerDocument, container, initialFocus: computed(() => props.initialFocus) },
        computed(() => mounted.value && Boolean(props.features & Features.InitialFocus))
      )

      // 处理焦点锁定
      useFocusLock(
        {
          ownerDocument,
          container,
          containers: props.containers,
          previousActiveElement,
        },
        computed(() => mounted.value && Boolean(props.features & Features.FocusLock))
      )

      let direction = useTabDirection()

      /**
       * 处理隐藏元素获得焦点的情况
       * 根据Tab方向决定聚焦第一个或最后一个可聚焦元素
       */
      function handleFocus(e: FocusEvent) {
        let el = dom(container) as HTMLElement
        if (!el) return

        // 在测试环境中使用microTask确保DOM已更新
        let wrapper = process.env.NODE_ENV === 'test' ? microTask : (cb: Function) => cb()
        wrapper(() => {
          match(direction.value, {
            [TabDirection.Forwards]: () => {
              focusIn(el, Focus.First, { skipElements: [e.relatedTarget as HTMLElement] })
            },
            [TabDirection.Backwards]: () => {
              focusIn(el, Focus.Last, { skipElements: [e.relatedTarget as HTMLElement] })
            },
          })
        })
      }

      // 记录最近是否使用了Tab键
      let recentlyUsedTabKey = ref(false)
      function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Tab') {
          recentlyUsedTabKey.value = true
          requestAnimationFrame(() => {
            recentlyUsedTabKey.value = false
          })
        }
      }

      /**
       * 处理失焦事件
       * 确保焦点不会意外离开容器
       */
      function handleBlur(e: FocusEvent) {
        if (!mounted.value) return
        
        let allContainers = resolveContainers(props.containers)
        if (dom(container) instanceof HTMLElement) allContainers.add(dom(container)!)

        let relatedTarget = e.relatedTarget
        if (!(relatedTarget instanceof HTMLElement)) return

        // 忽略焦点守卫元素
        if (relatedTarget.dataset.headlessuiFocusGuard === 'true') {
          return
        }

        // 如果焦点移出所有容器，需要将其移回
        if (!contains(allContainers, relatedTarget)) {
          // 如果是通过Tab键移出，则移动到下一个/上一个元素
          if (recentlyUsedTabKey.value) {
            focusIn(
              dom(container) as HTMLElement,
              match(direction.value, {
                [TabDirection.Forwards]: () => Focus.Next,
                [TabDirection.Backwards]: () => Focus.Previous,
              }) | Focus.WrapAround,
              { relativeTo: e.target as HTMLElement }
            )
          }
          // 如果是通过其他方式移出（如点击），则恢复到之前的活动元素
          else if (e.target instanceof HTMLElement) {
            focusElement(e.target)
          }
        }
      }

      return () => {
        let slot = {}
        let ourProps = { ref: container, onKeydown: handleKeyDown, onFocusout: handleBlur }
        let { features, initialFocus, containers: _containers, ...theirProps } = props

        return h(Fragment, [
          // 前置焦点守卫
          Boolean(features & Features.TabLock) &&
            h(Hidden, {
              as: 'button',
              type: 'button',
              'data-headlessui-focus-guard': true,
              onFocus: handleFocus,
              features: HiddenFeatures.Focusable,
            }),

          // 主要内容
          render({
            ourProps,
            theirProps: { ...attrs, ...theirProps },
            slot,
            attrs,
            slots,
            name: 'FocusTrap',
          }),

          // 后置焦点守卫
          Boolean(features & Features.TabLock) &&
            h(Hidden, {
              as: 'button',
              type: 'button',
              'data-headlessui-focus-guard': true,
              onFocus: handleFocus,
              features: HiddenFeatures.Focusable,
            }),
        ])
      }
    },
  }),
  { features: Features }
)

/**
 * 使用焦点还原元素Hook
 * 管理焦点历史记录，用于恢复之前的焦点
 */
function useRestoreElement(enabled: Ref<boolean>) {
  let localHistory = ref<HTMLElement[]>(history.slice())

  watch(
    [enabled],
    ([newEnabled], [oldEnabled]) => {
      // 禁用时清除历史
      if (oldEnabled === true && newEnabled === false) {
        microTask(() => {
          localHistory.value.splice(0)
        })
      }
      // 启用时记录当前历史
      else if (oldEnabled === false && newEnabled === true) {
        localHistory.value = history.slice()
      }
    },
    { flush: 'post' }
  )

  // 返回最后一个仍在DOM中的元素
  return () => {
    return localHistory.value.find((x) => x != null && x.isConnected) ?? null
  }
}

/**
 * 使用焦点还原Hook
 * 处理组件卸载时的焦点还原
 */
function useRestoreFocus(
  { ownerDocument }: { ownerDocument: Ref<Document | null> },
  enabled: Ref<boolean>
) {
  let getRestoreElement = useRestoreElement(enabled)

  // 在必要时恢复焦点
  onMounted(() => {
    watchEffect(
      () => {
        if (enabled.value) return
        if (ownerDocument.value?.activeElement === ownerDocument.value?.body) {
          focusElement(getRestoreElement())
        }
      },
      { flush: 'post' }
    )
  })

  // 组件卸载时恢复焦点
  onUnmounted(() => {
    if (!enabled.value) return
    focusElement(getRestoreElement())
  })
}

/**
 * 使用初始焦点Hook 
 * 处理组件挂载时的初始焦点设置
 */
function useInitialFocus(
  {
    ownerDocument,
    container,
    initialFocus,
  }: {
    ownerDocument: Ref<Document | null>
    container: Ref<HTMLElement | null>
    initialFocus?: Ref<HTMLElement | null>
  },
  enabled: Ref<boolean>
) {
  let previousActiveElement = ref<HTMLElement | null>(null)
  let mounted = ref(false)
  onMounted(() => (mounted.value = true))
  onUnmounted(() => (mounted.value = false))

  onMounted(() => {
    watch(
      [container, initialFocus, enabled],
      (newValues, prevValues) => {
        if (newValues.every((value, idx) => prevValues?.[idx] === value)) return
        if (!enabled.value) return

        let containerElement = dom(container)
        if (!containerElement) return

        // 延迟到下一个微任务执行焦点设置
        // 这样可以确保：
        // 1. 容器已经渲染完成
        // 2. 过渡动画可以正常启动
        // 3. 避免页面滚动问题
        microTask(() => {
          if (!mounted.value) {
            return
          }

          let initialFocusElement = dom(initialFocus)
          let activeElement = ownerDocument.value?.activeElement as HTMLElement

          // 处理初始焦点元素已经是活动元素的情况
          if (initialFocusElement) {
            if (initialFocusElement === activeElement) {
              previousActiveElement.value = activeElement
              return
            }
          } 
          // 处理焦点已在容器内的情况
          else if (containerElement!.contains(activeElement)) {
            previousActiveElement.value = activeElement
            return
          }

          // 尝试聚焦初始焦点元素
          if (initialFocusElement) {
            focusElement(initialFocusElement)
          } else {
            if (focusIn(containerElement!, Focus.First | Focus.NoScroll) === FocusResult.Error) {
              console.warn('There are no focusable elements inside the <FocusTrap />')
            }
          }

          previousActiveElement.value = ownerDocument.value?.activeElement as HTMLElement
        })
      },
      { immediate: true, flush: 'post' }
    )
  })

  return previousActiveElement
}

/**
 * 使用焦点锁定Hook
 * 防止焦点通过编程方式逃离容器
 */
function useFocusLock(
  {
    ownerDocument,
    container,
    containers,
    previousActiveElement,
  }: {
    ownerDocument: Ref<Document | null>
    container: Ref<HTMLElement | null>
    containers: Containers
    previousActiveElement: Ref<HTMLElement | null>
  },
  enabled: Ref<boolean>
) {
  // 监听全局焦点事件
  useEventListener(
    ownerDocument.value?.defaultView,
    'focus',
    (event) => {
      if (!enabled.value) return

      let allContainers = resolveContainers(containers)
      if (dom(container) instanceof HTMLElement) allContainers.add(dom(container)!)

      let previous = previousActiveElement.value
      if (!previous) return

      let toElement = event.target as HTMLElement | null
      if (toElement && toElement instanceof HTMLElement) {
        // 如果焦点要移动到容器外，阻止并恢复到上一个焦点元素
        if (!contains(allContainers, toElement)) {
          event.preventDefault()
          event.stopPropagation()
          focusElement(previous)
        } else {
          // 更新上一个焦点元素
          previousActiveElement.value = toElement
          focusElement(toElement)
        }
      } else {
        focusElement(previousActiveElement.value)
      }
    },
    true
  )
}

/**
 * 检查元素是否包含在容器集合中
 */
function contains(containers: Set<HTMLElement>, element: HTMLElement) {
  for (let container of containers) {
    if (container.contains(element)) return true
  }
  return false
}
