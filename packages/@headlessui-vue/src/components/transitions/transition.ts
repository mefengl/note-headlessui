/**
 * transition.ts - 过渡动画组件（Vue版本）
 * 
 * 提供一个可复用的过渡动画组件，用于实现元素的进入/离开动画效果。
 * 主要特性：
 * - 支持嵌套过渡
 * - 支持CSS类名动画
 * - 支持appear首次渲染动画
 * - 完全可控的生命周期事件
 * - SSR支持
 */

import {
  computed,
  defineComponent,
  h,
  inject,
  normalizeClass,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch,
  watchEffect,
  type ConcreteComponent,
  type InjectionKey,
  type Ref,
} from 'vue'
import { useId } from '../../hooks/use-id'
import {
  State,
  hasOpenClosed,
  useOpenClosed,
  useOpenClosedProvider,
} from '../../internal/open-closed'
import { dom } from '../../utils/dom'
import { env } from '../../utils/env'
import { match } from '../../utils/match'
import { Features, RenderStrategy, omit, render } from '../../utils/render'
import { Reason, transition } from './utils/transition'

type ID = ReturnType<typeof useId>

/**
 * 按空白字符分割类名
 * 由于类名中不能包含任何空白字符，我们需要处理所有类型的空白字符
 */
function splitClasses(classes: string = '') {
  return classes.split(/\s+/).filter((className) => className.length > 1)
}

/**
 * 过渡组件上下文接口
 */
interface TransitionContextValues {
  show: Ref<boolean>      // 控制显示状态
  appear: Ref<boolean>    // 是否在首次渲染时执行动画
}

// 过渡组件上下文注入键
let TransitionContext = Symbol('TransitionContext') as InjectionKey<TransitionContextValues | null>

/**
 * 树状态枚举
 * 用于跟踪嵌套过渡组件的可见性状态
 */
enum TreeStates {
  Visible = 'visible',
  Hidden = 'hidden',
}

/**
 * 检查当前组件是否在过渡组件上下文中
 */
function hasTransitionContext() {
  return inject(TransitionContext, null) !== null
}

/**
 * 获取过渡组件上下文
 * 如果不在上下文中会抛出错误
 */
function useTransitionContext() {
  let context = inject(TransitionContext, null)
  if (context === null) {
    throw new Error('A <TransitionChild /> is used but it is missing a parent <TransitionRoot />.')
  }
  return context
}

/**
 * 获取父级嵌套上下文
 */
function useParentNesting() {
  let context = inject(NestingContext, null)
  if (context === null) {
    throw new Error('A <TransitionChild /> is used but it is missing a parent <TransitionRoot />.')
  }
  return context
}

/**
 * 嵌套上下文接口
 * 用于管理嵌套的过渡子组件
 */
interface NestingContextValues {
  children: Ref<{ id: ID; state: TreeStates }[]>  // 子组件列表
  register: (id: ID) => () => void                // 注册子组件
  unregister: (id: ID, strategy?: RenderStrategy) => void  // 注销子组件
}

// 嵌套上下文注入键
let NestingContext = Symbol('NestingContext') as InjectionKey<NestingContextValues | null>

/**
 * 检查是否有可见的子组件
 */
function hasChildren(
  bag: NestingContextValues['children'] | { children: NestingContextValues['children'] }
): boolean {
  if ('children' in bag) return hasChildren(bag.children)
  return bag.value.filter(({ state }) => state === TreeStates.Visible).length > 0
}

/**
 * 创建嵌套管理Hook
 */
function useNesting(done?: () => void) {
  let transitionableChildren = ref<NestingContextValues['children']['value']>([])
  let mounted = ref(false)
  
  onMounted(() => (mounted.value = true))
  onUnmounted(() => (mounted.value = false))

  // 注销子组件
  function unregister(childId: ID, strategy = RenderStrategy.Hidden) {
    let idx = transitionableChildren.value.findIndex(({ id }) => id === childId)
    if (idx === -1) return

    match(strategy, {
      [RenderStrategy.Unmount]() {
        transitionableChildren.value.splice(idx, 1)
      },
      [RenderStrategy.Hidden]() {
        transitionableChildren.value[idx].state = TreeStates.Hidden
      },
    })

    // 当所有子组件都被卸载且当前组件已挂载时，执行完成回调
    if (!hasChildren(transitionableChildren) && mounted.value) {
      done?.()
    }
  }

  // 注册子组件
  function register(childId: ID) {
    let child = transitionableChildren.value.find(({ id }) => id === childId)
    if (!child) {
      transitionableChildren.value.push({ id: childId, state: TreeStates.Visible })
    } else if (child.state !== TreeStates.Visible) {
      child.state = TreeStates.Visible
    }
    return () => unregister(childId, RenderStrategy.Unmount)
  }

  return {
    children: transitionableChildren,
    register,
    unregister,
  }
}

// TransitionChild 组件渲染特性
let TransitionChildRenderFeatures = Features.RenderStrategy

/**
 * TransitionChild 组件
 * 负责执行实际的过渡动画效果
 */
export let TransitionChild = defineComponent({
  props: {
    as: { type: [Object, String], default: 'div' },
    show: { type: [Boolean], default: null },
    unmount: { type: [Boolean], default: true },
    appear: { type: [Boolean], default: false },
    enter: { type: [String], default: '' },
    enterFrom: { type: [String], default: '' },
    enterTo: { type: [String], default: '' },
    entered: { type: [String], default: '' },
    leave: { type: [String], default: '' },
    leaveFrom: { type: [String], default: '' },
    leaveTo: { type: [String], default: '' },
  },
  emits: {
    beforeEnter: () => true,
    afterEnter: () => true,
    beforeLeave: () => true,
    afterLeave: () => true,
  },
  setup(props, { emit, attrs, slots, expose }) {
    // 过渡状态标志
    let transitionStateFlags = ref(0)

    // 生命周期事件处理
    function beforeEnter() {
      transitionStateFlags.value |= State.Opening
      emit('beforeEnter')
    }
    function afterEnter() {
      transitionStateFlags.value &= ~State.Opening
      emit('afterEnter')
    }
    function beforeLeave() {
      transitionStateFlags.value |= State.Closing
      emit('beforeLeave')
    }
    function afterLeave() {
      transitionStateFlags.value &= ~State.Closing
      emit('afterLeave')
    }

    // 如果不在过渡上下文中但有OpenClosed上下文，则渲染为TransitionRoot
    if (!hasTransitionContext() && hasOpenClosed()) {
      return () =>
        h(
          TransitionRoot,
          {
            ...props,
            onBeforeEnter: beforeEnter,
            onAfterEnter: afterEnter,
            onBeforeLeave: beforeLeave,
            onAfterLeave: afterLeave,
          },
          slots
        )
    }

    let container = ref<HTMLElement | null>(null)
    let strategy = computed(() => (props.unmount ? RenderStrategy.Unmount : RenderStrategy.Hidden))
    expose({ el: container, $el: container })

    let { show, appear } = useTransitionContext()
    let { register, unregister } = useParentNesting()
    
    let state = ref(show.value ? TreeStates.Visible : TreeStates.Hidden)
    let initial = { value: true }
    let id = useId()
    let isTransitioning = { value: false }

    // 创建嵌套管理器
    let nesting = useNesting(() => {
      if (!isTransitioning.value && state.value !== TreeStates.Hidden) {
        state.value = TreeStates.Hidden
        unregister(id)
        afterLeave()
      }
    })

    // 组件挂载时注册
    onMounted(() => {
      let unregister = register(id)
      onUnmounted(unregister)
    })

    // 监听状态变化
    watchEffect(() => {
      if (strategy.value !== RenderStrategy.Hidden) return
      if (!id) return

      if (show.value && state.value !== TreeStates.Visible) {
        state.value = TreeStates.Visible
        return
      }

      match(state.value, {
        [TreeStates.Hidden]: () => unregister(id),
        [TreeStates.Visible]: () => register(id),
      })
    })

    // 处理过渡类名
    let enterClasses = splitClasses(props.enter)
    let enterFromClasses = splitClasses(props.enterFrom)
    let enterToClasses = splitClasses(props.enterTo)
    let enteredClasses = splitClasses(props.entered)
    let leaveClasses = splitClasses(props.leave)
    let leaveFromClasses = splitClasses(props.leaveFrom)
    let leaveToClasses = splitClasses(props.leaveTo)

    // 验证DOM节点
    onMounted(() => {
      watchEffect(() => {
        if (state.value === TreeStates.Visible) {
          let domElement = dom(container)
          let isEmptyDOMNode = domElement instanceof Comment && domElement.data === ''
          if (isEmptyDOMNode) {
            throw new Error('Did you forget to passthrough the `ref` to the actual DOM node?')
          }
        }
      })
    })

    /**
     * 执行过渡动画
     */
    function executeTransition(onInvalidate: (cb: () => void) => void) {
      let skip = initial.value && !appear.value
      let node = dom(container)
      if (!node || !(node instanceof HTMLElement)) return
      if (skip) return

      isTransitioning.value = true
      if (show.value) beforeEnter()
      if (!show.value) beforeLeave()

      onInvalidate(
        show.value
          ? transition(
              node,
              enterClasses,
              enterFromClasses,
              enterToClasses,
              enteredClasses,
              (reason) => {
                isTransitioning.value = false
                if (reason === Reason.Finished) afterEnter()
              }
            )
          : transition(
              node,
              leaveClasses,
              leaveFromClasses,
              leaveToClasses,
              enteredClasses,
              (reason) => {
                isTransitioning.value = false
                if (reason !== Reason.Finished) return

                if (!hasChildren(nesting)) {
                  state.value = TreeStates.Hidden
                  unregister(id)
                  afterLeave()
                }
              }
            )
      )
    }

    // 监听show属性变化执行过渡
    onMounted(() => {
      watch(
        [show],
        (_oldValues, _newValues, onInvalidate) => {
          executeTransition(onInvalidate)
          initial.value = false
        },
        { immediate: true }
      )
    })

    // 提供上下文
    provide(NestingContext, nesting)
    useOpenClosedProvider(
      computed(
        () =>
          match(state.value, {
            [TreeStates.Visible]: State.Open,
            [TreeStates.Hidden]: State.Closed,
          }) | transitionStateFlags.value
      )
    )

    return () => {
      let {
        appear: _appear,
        show: _show,
        enter,
        enterFrom,
        enterTo,
        entered,
        leave,
        leaveFrom,
        leaveTo,
        ...rest
      } = props
      
      let ourProps = { ref: container }
      let theirProps = {
        ...rest,
        ...(appear.value && show.value && env.isServer
          ? {
              class: normalizeClass([
                attrs.class,
                rest.class,
                ...enterClasses,
                ...enterFromClasses,
              ]),
            }
          : {}),
      }

      return render({
        theirProps,
        ourProps,
        slot: {},
        slots,
        attrs,
        features: TransitionChildRenderFeatures,
        visible: state.value === TreeStates.Visible,
        name: 'TransitionChild',
      })
    }
  },
})

// 用于解决TypeScript循环推断问题
let _TransitionChild = TransitionChild as ConcreteComponent

/**
 * TransitionRoot 组件
 * 作为过渡动画的根组件，管理整体状态和上下文
 */
export let TransitionRoot = defineComponent({
  inheritAttrs: false,
  props: {
    as: { type: [Object, String], default: 'div' },
    show: { type: [Boolean], default: null },
    unmount: { type: [Boolean], default: true },
    appear: { type: [Boolean], default: false },
    enter: { type: [String], default: '' },
    enterFrom: { type: [String], default: '' },
    enterTo: { type: [String], default: '' },
    entered: { type: [String], default: '' },
    leave: { type: [String], default: '' },
    leaveFrom: { type: [String], default: '' },
    leaveTo: { type: [String], default: '' },
  },
  emits: {
    beforeEnter: () => true,
    afterEnter: () => true,
    beforeLeave: () => true,
    afterLeave: () => true,
  },
  setup(props, { emit, attrs, slots }) {
    // 获取OpenClosed状态
    let usesOpenClosedState = useOpenClosed()
    
    // 计算show状态
    let show = computed(() => {
      if (props.show === null && usesOpenClosedState !== null) {
        return (usesOpenClosedState.value & State.Open) === State.Open
      }
      return props.show
    })

    // 验证show属性
    watchEffect(() => {
      if (![true, false].includes(show.value)) {
        throw new Error('A <Transition /> is used but it is missing a `:show="true | false"` prop.')
      }
    })

    let state = ref(show.value ? TreeStates.Visible : TreeStates.Hidden)
    
    // 创建嵌套管理器
    let nestingBag = useNesting(() => {
      state.value = TreeStates.Hidden
    })
    
    let initial = ref(true)
    
    // 创建过渡上下文
    let transitionBag = {
      show,
      appear: computed(() => props.appear || !initial.value),
    }

    // 监听状态变化
    onMounted(() => {
      watchEffect(() => {
        initial.value = false
        if (show.value) {
          state.value = TreeStates.Visible
        } else if (!hasChildren(nestingBag)) {
          state.value = TreeStates.Hidden
        }
      })
    })

    // 提供上下文
    provide(NestingContext, nestingBag)
    provide(TransitionContext, transitionBag)

    return () => {
      let theirProps = omit(props, [
        'show',
        'appear',
        'unmount',
        'onBeforeEnter',
        'onBeforeLeave',
        'onAfterEnter',
        'onAfterLeave',
      ])
      let sharedProps = { unmount: props.unmount }

      return render({
        ourProps: {
          ...sharedProps,
          as: 'template',
        },
        theirProps: {},
        slot: {},
        slots: {
          ...slots,
          default: () => [
            h(
              _TransitionChild,
              {
                onBeforeEnter: () => emit('beforeEnter'),
                onAfterEnter: () => emit('afterEnter'),
                onBeforeLeave: () => emit('beforeLeave'),
                onAfterLeave: () => emit('afterLeave'),
                ...attrs,
                ...sharedProps,
                ...theirProps,
              },
              slots.default
            ),
          ],
        },
        attrs: {},
        features: TransitionChildRenderFeatures,
        visible: state.value === TreeStates.Visible,
        name: 'Transition',
      })
    }
  },
})
