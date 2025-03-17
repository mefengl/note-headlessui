/**
 * transition.tsx - 过渡动画组件
 * 
 * 提供了一个灵活的过渡动画系统，支持：
 * 1. 嵌套过渡
 * 2. 多个子元素的协调过渡
 * 3. Enter/Leave 动画
 * 4. 自定义类名和时序
 * 5. 生命周期钩子
 * 
 * 使用示例：
 * ```tsx
 * // 1. 基础用法
 * <Transition show={isOpen}>
 *   <div className="opacity-0 transition-opacity duration-300">
 *     淡入淡出的内容
 *   </div>
 * </Transition>
 * 
 * // 2. 自定义过渡类名
 * <Transition
 *   show={isOpen}
 *   enter="transition duration-300"
 *   enterFrom="opacity-0"
 *   enterTo="opacity-100"
 *   leave="transition duration-300"
 *   leaveFrom="opacity-100"
 *   leaveTo="opacity-0"
 * >
 *   <div>淡入淡出的内容</div>
 * </Transition>
 * 
 * // 3. 生命周期钩子
 * <Transition
 *   show={isOpen}
 *   beforeEnter={() => console.log('开始进入')}
 *   afterEnter={() => console.log('进入完成')}
 *   beforeLeave={() => console.log('开始离开')}
 *   afterLeave={() => console.log('离开完成')}
 * >
 *   <div>有生命周期的内容</div>
 * </Transition>
 * ```
 */

'use client'

import React, {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type MutableRefObject,
  type Ref,
} from 'react'
import { useDisposables } from '../../hooks/use-disposables'
import { useEvent } from '../../hooks/use-event'
import { useIsMounted } from '../../hooks/use-is-mounted'
import { useIsoMorphicEffect } from '../../hooks/use-iso-morphic-effect'
import { useLatestValue } from '../../hooks/use-latest-value'
import { useServerHandoffComplete } from '../../hooks/use-server-handoff-complete'
import { useSyncRefs } from '../../hooks/use-sync-refs'
import { transitionDataAttributes, useTransition } from '../../hooks/use-transition'
import { OpenClosedProvider, State, useOpenClosed } from '../../internal/open-closed'
import type { Props, ReactTag } from '../../types'
import { classNames } from '../../utils/class-names'
import { match } from '../../utils/match'
import {
  RenderFeatures,
  RenderStrategy,
  compact,
  forwardRefWithAs,
  useRender,
  type HasDisplayName,
  type PropsForFeatures,
  type RefProp,
} from '../../utils/render'

type ContainerElement = MutableRefObject<HTMLElement | null>
type TransitionDirection = 'enter' | 'leave'

/**
 * 检查是否应该转发ref到子元素
 * 在以下情况下需要转发：
 * 1. 有任何enter/leave相关的类名
 * 2. as prop不是Fragment
 * 3. 只有一个子元素
 */
function shouldForwardRef<TTag extends ElementType = typeof DEFAULT_TRANSITION_CHILD_TAG>(
  props: TransitionRootProps<TTag>
) {
  return (
    Boolean(
      props.enter ||
        props.enterFrom ||
        props.enterTo ||
        props.leave ||
        props.leaveFrom ||
        props.leaveTo
    ) ||
    (props.as ?? DEFAULT_TRANSITION_CHILD_TAG) !== Fragment ||
    React.Children.count(props.children) === 1
  )
}

/**
 * 过渡上下文接口
 */
interface TransitionContextValues {
  show: boolean      // 是否显示
  appear: boolean    // 是否在首次渲染时执行动画
  initial: boolean   // 是否是初始渲染
}

// 过渡上下文
let TransitionContext = createContext<TransitionContextValues | null>(null)
TransitionContext.displayName = 'TransitionContext'

/**
 * 元素状态枚举
 */
enum TreeStates {
  Visible = 'visible',
  Hidden = 'hidden',
}

/**
 * 过渡类名接口
 */
export interface TransitionClasses {
  enter?: string     // 进入时的基础类
  enterFrom?: string // 进入开始时的类
  enterTo?: string   // 进入结束时的类
  /** @deprecated 使用enterTo和leaveTo替代，因为这些类在过渡结束后会保持应用 */
  entered?: string   
  leave?: string     // 离开时的基础类
  leaveFrom?: string // 离开开始时的类
  leaveTo?: string   // 离开结束时的类
}

/**
 * 过渡事件接口
 */
export interface TransitionEvents {
  beforeEnter?: () => void  // 进入前回调
  afterEnter?: () => void   // 进入后回调
  beforeLeave?: () => void  // 离开前回调
  afterLeave?: () => void   // 离开后回调
}

// TransitionChild组件属性类型
type TransitionChildPropsWeControl = never
export type TransitionChildProps<TTag extends ReactTag> = Props<
  TTag,
  TransitionChildRenderPropArg,
  TransitionChildPropsWeControl,
  PropsForFeatures<typeof TransitionChildRenderFeatures> &
    TransitionClasses &
    TransitionEvents & { 
      transition?: boolean  // 是否启用过渡
      appear?: boolean      // 是否在首次渲染时执行动画
    }
>

/**
 * 获取过渡上下文，如果不存在则抛出错误
 */
function useTransitionContext() {
  let context = useContext(TransitionContext)
  if (context === null) {
    throw new Error(
      'A <Transition.Child /> is used but it is missing a parent <Transition /> or <Transition.Root />.'
    )
  }
  return context
}

/**
 * 获取父级嵌套上下文，如果不存在则抛出错误
 */
function useParentNesting() {
  let context = useContext(NestingContext)
  if (context === null) {
    throw new Error(
      'A <Transition.Child /> is used but it is missing a parent <Transition /> or <Transition.Root />.'
    )
  }
  return context
}

/**
 * 嵌套上下文接口
 * 用于协调多个过渡子元素的动画
 */
interface NestingContextValues {
  children: MutableRefObject<{ el: ContainerElement; state: TreeStates }[]>
  register: (el: ContainerElement) => () => void
  unregister: (el: ContainerElement, strategy?: RenderStrategy) => void
  onStart: (el: ContainerElement, direction: TransitionDirection, cb: () => void) => void
  onStop: (el: ContainerElement, direction: TransitionDirection, cb: () => void) => void
  chains: MutableRefObject<
    Record<TransitionDirection, [container: ContainerElement, promise: Promise<void>][]>
  >
  wait: MutableRefObject<Promise<void>>
}

// 嵌套上下文
let NestingContext = createContext<NestingContextValues | null>(null)
NestingContext.displayName = 'NestingContext'

/**
 * 检查是否有可见的子元素
 */
function hasChildren(
  bag: NestingContextValues['children'] | { children: NestingContextValues['children'] }
): boolean {
  if ('children' in bag) return hasChildren(bag.children)
  return (
    bag.current
      .filter(({ el }) => el.current !== null)
      .filter(({ state }) => state === TreeStates.Visible).length > 0
  )
}

/**
 * useNesting - 实现嵌套过渡的核心Hook
 * 
 * 功能：
 * 1. 管理子元素的注册和注销
 * 2. 协调子元素的过渡时序
 * 3. 处理过渡链式调用
 */
function useNesting(done?: () => void, parent?: NestingContextValues) {
  let doneRef = useLatestValue(done)
  let transitionableChildren = useRef<NestingContextValues['children']['current']>([])
  let mounted = useIsMounted()
  let d = useDisposables()

  // 注销子元素
  let unregister = useEvent((container: ContainerElement, strategy = RenderStrategy.Hidden) => {
    let idx = transitionableChildren.current.findIndex(({ el }) => el === container)
    if (idx === -1) return

    match(strategy, {
      [RenderStrategy.Unmount]() {
        transitionableChildren.current.splice(idx, 1)
      },
      [RenderStrategy.Hidden]() {
        transitionableChildren.current[idx].state = TreeStates.Hidden
      },
    })

    // 检查是否所有子元素都已隐藏
    d.microTask(() => {
      if (!hasChildren(transitionableChildren) && mounted.current) {
        doneRef.current?.()
      }
    })
  })

  // 注册子元素
  let register = useEvent((container: ContainerElement) => {
    let child = transitionableChildren.current.find(({ el }) => el === container)
    if (!child) {
      transitionableChildren.current.push({ el: container, state: TreeStates.Visible })
    } else if (child.state !== TreeStates.Visible) {
      child.state = TreeStates.Visible
    }
    return () => unregister(container, RenderStrategy.Unmount)
  })

  let todos = useRef<(() => void)[]>([])
  let wait = useRef<Promise<void>>(Promise.resolve())
  let chains = useRef<
    Record<TransitionDirection, [identifier: ContainerElement, promise: Promise<void>][]>
  >({ enter: [], leave: [] })

  // 开始过渡
  let onStart = useEvent(
    (
      container: ContainerElement,
      direction: TransitionDirection,
      cb: (direction: TransitionDirection) => void
    ) => {
      // 清除现有的todos
      todos.current.splice(0)

      // 从父级移除当前容器的旧Promise
      if (parent) {
        parent.chains.current[direction] = parent.chains.current[direction].filter(
          ([containerInParent]) => containerInParent !== container
        )
      }

      // 等待当前过渡完成
      parent?.chains.current[direction].push([
        container,
        new Promise<void>((resolve) => {
          todos.current.push(resolve)
        }),
      ])

      // 等待子元素过渡完成
      parent?.chains.current[direction].push([
        container,
        new Promise<void>((resolve) => {
          Promise.all(chains.current[direction].map(([_container, promise]) => promise)).then(() =>
            resolve()
          )
        }),
      ])

      // enter需要等待父级完成，leave可以立即开始
      if (direction === 'enter') {
        wait.current = wait.current.then(() => parent?.wait.current).then(() => cb(direction))
      } else {
        cb(direction)
      }
    }
  )

  // 结束过渡
  let onStop = useEvent(
    (
      _container: ContainerElement,
      direction: TransitionDirection,
      cb: (direction: TransitionDirection) => void
    ) => {
      Promise.all(chains.current[direction].splice(0).map(([_container, promise]) => promise))
        .then(() => {
          todos.current.shift()?.() // 标记当前过渡完成
        })
        .then(() => cb(direction))
    }
  )

  return useMemo(
    () => ({
      children: transitionableChildren,
      register,
      unregister,
      onStart,
      onStop,
      wait,
      chains,
    }),
    [register, unregister, transitionableChildren, onStart, onStop, chains, wait]
  )
}

// 默认的TransitionChild标签
let DEFAULT_TRANSITION_CHILD_TAG = Fragment
type TransitionChildRenderPropArg = MutableRefObject<HTMLElement>
let TransitionChildRenderFeatures = RenderFeatures.RenderStrategy

/**
 * TransitionChild组件 - 过渡动画的最小单元
 */
function TransitionChildFn<TTag extends ElementType = typeof DEFAULT_TRANSITION_CHILD_TAG>(
  props: TransitionChildProps<TTag>,
  ref: Ref<HTMLElement>
) {
  let {
    transition = true,    // 是否启用过渡
    beforeEnter,         // 进入前回调
    afterEnter,          // 进入后回调
    beforeLeave,         // 离开前回调
    afterLeave,          // 离开后回调
    enter,              // 进入时的类名
    enterFrom,          // 进入起始类名
    enterTo,            // 进入结束类名
    entered,            // 进入完成类名（已废弃）
    leave,              // 离开时的类名
    leaveFrom,          // 离开起始类名
    leaveTo,            // 离开结束类名
    ...theirProps
  } = props as typeof props

  // 状态管理
  let [localContainerElement, setLocalContainerElement] = useState<HTMLElement | null>(null)
  let container = useRef<HTMLElement | null>(null)
  let requiresRef = shouldForwardRef(props)
  let transitionRef = useSyncRefs(
    ...(requiresRef ? [container, ref, setLocalContainerElement] : ref === null ? [] : [ref])
  )

  let strategy = theirProps.unmount ?? true ? RenderStrategy.Unmount : RenderStrategy.Hidden

  // 获取上下文数据
  let { show, appear, initial } = useTransitionContext()
  let [state, setState] = useState(show ? TreeStates.Visible : TreeStates.Hidden)
  let parentNesting = useParentNesting()
  let { register, unregister } = parentNesting

  // 注册到父级
  useIsoMorphicEffect(() => register(container), [register, container])

  // 处理隐藏策略
  useIsoMorphicEffect(() => {
    if (strategy !== RenderStrategy.Hidden) return
    if (!container.current) return
    
    if (show && state !== TreeStates.Visible) {
      setState(TreeStates.Visible)
      return
    }

    return match(state, {
      [TreeStates.Hidden]: () => unregister(container),
      [TreeStates.Visible]: () => register(container),
    })
  }, [state, container, register, unregister, show, strategy])

  // 服务端渲染处理
  let ready = useServerHandoffComplete()
  useIsoMorphicEffect(() => {
    if (!requiresRef) return
    if (ready && state === TreeStates.Visible && container.current === null) {
      throw new Error('Did you forget to passthrough the `ref` to the actual DOM node?')
    }
  }, [container, state, ready, requiresRef])

  let skip = initial && !appear           // 是否跳过初始动画
  let immediate = appear && show && initial  // 是否立即显示
  let isTransitioning = useRef(false)     // 是否正在过渡

  // 使用嵌套上下文
  let nesting = useNesting(() => {
    if (isTransitioning.current) return
    setState(TreeStates.Hidden)
    unregister(container)
  }, parentNesting)

  // 开始过渡
  let start = useEvent((show: boolean) => {
    isTransitioning.current = true
    let direction: TransitionDirection = show ? 'enter' : 'leave'
    nesting.onStart(container, direction, (direction) => {
      if (direction === 'enter') beforeEnter?.()
      else if (direction === 'leave') beforeLeave?.()
    })
  })

  // 结束过渡
  let end = useEvent((show: boolean) => {
    let direction: TransitionDirection = show ? 'enter' : 'leave'
    isTransitioning.current = false
    nesting.onStop(container, direction, (direction) => {
      if (direction === 'enter') afterEnter?.()
      else if (direction === 'leave') afterLeave?.()
    })

    if (direction === 'leave' && !hasChildren(nesting)) {
      setState(TreeStates.Hidden)
      unregister(container)
    }
  })

  // 无过渡时直接执行
  useEffect(() => {
    if (requiresRef && transition) return
    start(show)
    end(show)
  }, [show, requiresRef, transition])

  // 检查是否启用过渡
  let enabled = (() => {
    if (!transition) return false
    if (!requiresRef) return false
    if (!ready) return false
    if (skip) return false
    return true
  })()

  // 使用过渡钩子
  let [, transitionData] = useTransition(enabled, localContainerElement, show, { start, end })

  // 处理props
  let ourProps = compact({
    ref: transitionRef,
    className: classNames(
      // @ts-expect-error: 原有类名
      theirProps.className,
      // 立即显示时的类名
      immediate && enter,
      immediate && enterFrom,
      // enter相关类名
      transitionData.enter && enter,
      transitionData.enter && transitionData.closed && enterFrom,
      transitionData.enter && !transitionData.closed && enterTo,
      // leave相关类名
      transitionData.leave && leave,
      transitionData.leave && !transitionData.closed && leaveFrom,
      transitionData.leave && transitionData.closed && leaveTo,
      // 兼容性类名
      !transitionData.transition && show && entered
    )?.trim() || undefined,
    ...transitionDataAttributes(transitionData),
  })

  // 计算OpenClosed状态
  let openClosedState = 0
  if (state === TreeStates.Visible) openClosedState |= State.Open
  if (state === TreeStates.Hidden) openClosedState |= State.Closed
  if (transitionData.enter) openClosedState |= State.Opening
  if (transitionData.leave) openClosedState |= State.Closing

  let render = useRender()

  return (
    <NestingContext.Provider value={nesting}>
      <OpenClosedProvider value={openClosedState}>
        {render({
          ourProps,
          theirProps,
          defaultTag: DEFAULT_TRANSITION_CHILD_TAG,
          features: TransitionChildRenderFeatures,
          visible: state === TreeStates.Visible,
          name: 'Transition.Child',
        })}
      </OpenClosedProvider>
    </NestingContext.Provider>
  )
}

/**
 * TransitionRoot属性类型
 * 继承TransitionChild的所有属性，并添加show和appear
 */
export type TransitionRootProps<TTag extends ElementType = typeof DEFAULT_TRANSITION_CHILD_TAG> =
  TransitionChildProps<TTag> & {
    show?: boolean      // 控制显示/隐藏
    appear?: boolean    // 是否在首次渲染时执行动画
  }

/**
 * TransitionRoot组件
 * 作为过渡动画的顶层容器，管理整个过渡树
 */
function TransitionRootFn<TTag extends ElementType = typeof DEFAULT_TRANSITION_CHILD_TAG>(
  props: TransitionRootProps<TTag>,
  ref: Ref<HTMLElement>
) {
  let { show, appear = false, unmount = true, ...theirProps } = props as typeof props
  
  let internalTransitionRef = useRef<HTMLElement | null>(null)
  let requiresRef = shouldForwardRef(props)
  let transitionRef = useSyncRefs(
    ...(requiresRef ? [internalTransitionRef, ref] : ref === null ? [] : [ref])
  )

  // 服务端渲染处理
  useServerHandoffComplete()

  // 处理OpenClosed状态
  let usesOpenClosedState = useOpenClosed()
  if (show === undefined && usesOpenClosedState !== null) {
    show = (usesOpenClosedState & State.Open) === State.Open
  }

  if (show === undefined) {
    throw new Error('A <Transition /> is used but it is missing a `show={true | false}` prop.')
  }

  // 状态管理
  let [state, setState] = useState(show ? TreeStates.Visible : TreeStates.Hidden)
  
  // 创建嵌套上下文
  let nestingBag = useNesting(() => {
    if (show) return
    setState(TreeStates.Hidden)
  })

  // 处理initial状态
  let [initial, setInitial] = useState(true)
  let changes = useRef([show])

  useIsoMorphicEffect(() => {
    if (initial === false) return
    if (changes.current[changes.current.length - 1] !== show) {
      changes.current.push(show)
      setInitial(false)
    }
  }, [changes, show])

  // 创建过渡上下文
  let transitionBag = useMemo<TransitionContextValues>(
    () => ({ show, appear, initial }),
    [show, appear, initial]
  )

  // 状态更新
  useIsoMorphicEffect(() => {
    if (show) {
      setState(TreeStates.Visible)
    } else if (!hasChildren(nestingBag) && internalTransitionRef.current !== null) {
      setState(TreeStates.Hidden)
    }
  }, [show, nestingBag])

  let sharedProps = { unmount }

  // 生命周期处理
  let beforeEnter = useEvent(() => {
    if (initial) setInitial(false)
    props.beforeEnter?.()
  })

  let beforeLeave = useEvent(() => {
    if (initial) setInitial(false)
    props.beforeLeave?.()
  })

  let render = useRender()

  return (
    <NestingContext.Provider value={nestingBag}>
      <TransitionContext.Provider value={transitionBag}>
        {render({
          ourProps: {
            ...sharedProps,
            as: Fragment,
            children: (
              <InternalTransitionChild
                ref={transitionRef}
                {...sharedProps}
                {...theirProps}
                beforeEnter={beforeEnter}
                beforeLeave={beforeLeave}
              />
            ),
          },
          theirProps: {},
          defaultTag: Fragment,
          features: TransitionChildRenderFeatures,
          visible: state === TreeStates.Visible,
          name: 'Transition',
        })}
      </TransitionContext.Provider>
    </NestingContext.Provider>
  )
}

/**
 * ChildFn - 智能判断使用Root还是Child
 * 基于上下文自动选择合适的组件
 */
function ChildFn<TTag extends ElementType = typeof DEFAULT_TRANSITION_CHILD_TAG>(
  props: TransitionChildProps<TTag>,
  ref: MutableRefObject<HTMLElement>
) {
  let hasTransitionContext = useContext(TransitionContext) !== null
  let hasOpenClosedContext = useOpenClosed() !== null

  return (
    <>
      {!hasTransitionContext && hasOpenClosedContext ? (
        <TransitionRoot ref={ref} {...props} />
      ) : (
        <InternalTransitionChild ref={ref} {...props} />
      )}
    </>
  )
}

// 组件类型定义
export interface _internal_ComponentTransitionRoot extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_TRANSITION_CHILD_TAG>(
    props: TransitionRootProps<TTag> & RefProp<typeof TransitionRootFn>
  ): React.JSX.Element
}

export interface _internal_ComponentTransitionChild extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_TRANSITION_CHILD_TAG>(
    props: TransitionChildProps<TTag> & RefProp<typeof TransitionChildFn>
  ): React.JSX.Element
}

// 创建组件实例
let TransitionRoot = forwardRefWithAs(TransitionRootFn) as _internal_ComponentTransitionRoot
let InternalTransitionChild = forwardRefWithAs(
  TransitionChildFn
) as _internal_ComponentTransitionChild
export let TransitionChild = forwardRefWithAs(ChildFn) as _internal_ComponentTransitionChild

// 导出Transition及其子组件
export let Transition = Object.assign(TransitionRoot, {
  /** @deprecated use `<TransitionChild>` instead of `<Transition.Child>` */
  Child: TransitionChild,
  /** @deprecated use `<Transition>` instead of `<Transition.Root>` */
  Root: TransitionRoot,
})
