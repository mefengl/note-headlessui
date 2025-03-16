import React, {
  Fragment,
  cloneElement,
  createElement,
  forwardRef,
  isValidElement,
  useCallback,
  useRef,
  type ElementType,
  type MutableRefObject,
  type ReactElement,
  type Ref,
} from 'react'
import type { Expand, Props } from '../types'
import { classNames } from './class-names'
import { match } from './match'

// =============================================================================
// 渲染特性枚举
// 这些特性控制组件的渲染行为,可以组合使用
// =============================================================================
export enum RenderFeatures {
  /** 无特性 - 最基础的渲染模式 */
  None = 0,

  /**
   * 渲染策略特性
   * 
   * 启用此特性后,组件可以使用以下渲染策略:
   * - Unmount: 当不可见时,完全卸载组件
   * - Hidden: 当不可见时,使用 [hidden] 属性隐藏组件但保持在DOM中
   * 
   * 使用场景:
   * 1. 需要控制组件显示/隐藏时的DOM行为
   * 2. 优化性能(Unmount)或保持状态(Hidden)
   */
  RenderStrategy = 1,

  /**
   * 静态渲染特性
   * 
   * 启用此特性后,组件的渲染行为可以被外部控制
   * 常用于:
   * 1. 基于状态的过渡动画
   * 2. 自定义显示/隐藏逻辑
   */
  Static = 2,
}

// =============================================================================
// 渲染策略枚举
// 定义组件在不可见时的具体行为
// =============================================================================
export enum RenderStrategy {
  /** 完全卸载组件 */
  Unmount,
  /** 保持组件在DOM中但隐藏它 */
  Hidden,
}

// =============================================================================
// 类型工具
// 用于特性系统的类型支持
// =============================================================================
type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any
  ? R
  : never

/**
 * 特性属性类型映射
 * 根据启用的特性生成对应的props类型
 */
type PropsForFeature<
  TPassedInFeatures extends RenderFeatures,
  TForFeature extends RenderFeatures,
  TProps,
> = TPassedInFeatures extends TForFeature ? TProps : {}

/**
 * 组合特性的Props类型
 * 将所有启用特性的props合并为一个类型
 */
export type PropsForFeatures<T extends RenderFeatures> = Expand<
  UnionToIntersection<
    | PropsForFeature<T, RenderFeatures.Static, { static?: boolean }>
    | PropsForFeature<T, RenderFeatures.RenderStrategy, { unmount?: boolean }>
  >
>

// =============================================================================
// 渲染Hook
// 提供可重用的渲染逻辑
// =============================================================================

/**
 * useRender Hook
 * 
 * 将render函数与ref合并逻辑结合,创建一个可重用的渲染器
 * 主要用于组件内部处理渲染逻辑
 */
export function useRender() {
  let mergeRefs = useMergeRefsFn()
  return useCallback(
    (args: Parameters<typeof render>[0]) => render({ mergeRefs, ...args }),
    [mergeRefs]
  ) as typeof render
}

// =============================================================================
// 核心渲染函数
// 处理组件的实际渲染逻辑
// =============================================================================

/**
 * render函数
 * 
 * 核心渲染实现,处理:
 * 1. 特性控制的渲染行为
 * 2. 可见性控制
 * 3. props合并
 * 4. ref转发
 */
function render<TFeature extends RenderFeatures, TTag extends ElementType, TSlot>({
  ourProps,   // 内部props(组件自身的props)
  theirProps, // 外部props(用户传入的props)
  slot,       // 插槽数据
  defaultTag, // 默认渲染的标签
  features,   // 启用的特性
  visible = true, // 可见性控制
  name,       // 组件名称(用于错误信息)
  mergeRefs,  // ref合并函数
}: {
  ourProps: Expand<Props<TTag, TSlot, any> & PropsForFeatures<TFeature>> & {
    ref?: Ref<HTMLElement | ElementType>
  }
  theirProps: Expand<Props<TTag, TSlot, any>>
  slot?: TSlot
  defaultTag: ElementType
  features?: TFeature
  visible?: boolean
  name: string
  mergeRefs?: ReturnType<typeof useMergeRefsFn>
}): ReturnType<typeof _render> | null {
  // 使用默认的ref合并函数或传入的合并函数
  mergeRefs = mergeRefs ?? defaultMergeRefs
  
  // 合并内部和外部props
  let props = mergePropsAdvanced(theirProps, ourProps)

  // 可见性处理
  if (visible) return _render(props, slot, defaultTag, name, mergeRefs)

  // 特性系统处理
  let featureFlags = features ?? RenderFeatures.None

  // 静态渲染特性处理
  if (featureFlags & RenderFeatures.Static) {
    let { static: isStatic = false, ...rest } = props as PropsForFeatures<RenderFeatures.Static>
    if (isStatic) return _render(rest, slot, defaultTag, name, mergeRefs)
  }

  // 渲染策略特性处理
  if (featureFlags & RenderFeatures.RenderStrategy) {
    let { unmount = true, ...rest } = props as PropsForFeatures<RenderFeatures.RenderStrategy>
    let strategy = unmount ? RenderStrategy.Unmount : RenderStrategy.Hidden
    
    return match(strategy, {
      [RenderStrategy.Unmount]() {
        return null
      },
      [RenderStrategy.Hidden]() {
        return _render(
          { ...rest, ...{ hidden: true, style: { display: 'none' } } },
          slot,
          defaultTag,
          name,
          mergeRefs!
        )
      },
    })
  }

  // 无特性时的默认渲染
  return _render(props, slot, defaultTag, name, mergeRefs)
}

// =============================================================================
// 底层渲染实现
// 处理具体的DOM元素创建和属性应用
// =============================================================================

/**
 * _render函数
 * 
 * 实际的渲染实现:
 * 1. 处理组件的as属性(动态标签)
 * 2. 处理children函数(渲染函数)
 * 3. 处理className函数
 * 4. 处理Fragment特殊情况
 * 5. 应用data-*属性
 */
function _render<TTag extends ElementType, TSlot>(
  props: Props<TTag, TSlot> & { ref?: unknown },
  slot: TSlot = {} as TSlot,
  tag: ElementType,
  name: string,
  mergeRefs: ReturnType<typeof useMergeRefsFn>
) {
  let {
    as: Component = tag,
    children,
    refName = 'ref',
    ...rest
  } = omit(props, ['unmount', 'static'])

  // 处理ref相关props
  let refRelatedProps = props.ref !== undefined ? { [refName]: props.ref } : {}

  // 处理children函数
  let resolvedChildren = (typeof children === 'function' ? children(slot) : children) as
    | ReactElement
    | ReactElement[]

  // 处理className函数
  if ('className' in rest && rest.className && typeof rest.className === 'function') {
    rest.className = rest.className(slot)
  }

  // 优化aria-labelledby
  if (rest['aria-labelledby'] && rest['aria-labelledby'] === rest.id) {
    rest['aria-labelledby'] = undefined
  }

  // 生成data-*属性
  let dataAttributes: Record<string, string> = {}
  if (slot) {
    let exposeState = false
    let states = []
    for (let [k, v] of Object.entries(slot)) {
      if (typeof v === 'boolean') {
        exposeState = true
      }
      if (v === true) {
        states.push(k.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`))
      }
    }
    if (exposeState) {
      dataAttributes['data-headlessui-state'] = states.join(' ')
      for (let state of states) {
        dataAttributes[`data-${state}`] = ''
      }
    }
  }

  // Fragment特殊处理
  if (Component === Fragment) {
    if (Object.keys(compact(rest)).length > 0 || Object.keys(compact(dataAttributes)).length > 0) {
      if (
        !isValidElement(resolvedChildren) ||
        (Array.isArray(resolvedChildren) && resolvedChildren.length > 1)
      ) {
        if (Object.keys(compact(rest)).length > 0) {
          throw new Error(
            [
              'Passing props on "Fragment"!',
              '',
              `The current component <${name} /> is rendering a "Fragment".`,
              `However we need to passthrough the following props:`,
              Object.keys(compact(rest))
                .concat(Object.keys(compact(dataAttributes)))
                .map((line) => `  - ${line}`)
                .join('\n'),
              '',
              'You can apply a few solutions:',
              [
                'Add an `as="..."` prop, to ensure that we render an actual element instead of a "Fragment".',
                'Render a single element as the child so that we can forward the props onto that element.',
              ]
                .map((line) => `  - ${line}`)
                .join('\n'),
            ].join('\n')
          )
        }
      } else {
        // Merge class name prop in SSR
        // @ts-ignore We know that the props may not have className. It'll be undefined then which is fine.
        let childProps = resolvedChildren.props as { className: string | (() => string) } | null

        let childPropsClassName = childProps?.className
        let newClassName =
          typeof childPropsClassName === 'function'
            ? (...args: any[]) =>
                classNames(
                  (childPropsClassName as Function)(...args),
                  (rest as { className?: string }).className
                )
            : classNames(childPropsClassName, (rest as { className?: string }).className)

        let classNameProps = newClassName ? { className: newClassName } : {}

        // Merge props from the existing element with the incoming props
        let mergedProps = mergePropsAdvanced(
          resolvedChildren.props as any,
          // Filter out undefined values so that they don't override the existing values
          compact(omit(rest, ['ref']))
        )

        // Make sure that `data-*` that already exist in the `mergedProps` are
        // skipped.
        //
        // Typically we want to keep the props we set in each component because
        // they are required to make the component work correctly. However, in
        // case of `data-*` attributes, these are attributes that help the end
        // user.
        //
        // This means that since the props are not required for the component to
        // work, that we can safely prefer the `data-*` attributes from the
        // component that the end user provided.
        for (let key in dataAttributes) {
          if (key in mergedProps) {
            delete dataAttributes[key]
          }
        }

        return cloneElement(
          resolvedChildren,
          Object.assign(
            {},
            mergedProps,
            dataAttributes,
            refRelatedProps,
            { ref: mergeRefs(getElementRef(resolvedChildren), refRelatedProps.ref) },
            classNameProps
          )
        )
      }
    }
  }

  // 创建最终的React元素
  return createElement(
    Component,
    Object.assign(
      {},
      omit(rest, ['ref']),
      Component !== Fragment && refRelatedProps,
      Component !== Fragment && dataAttributes
    ),
    resolvedChildren
  )
}

// =============================================================================
// Ref合并系统
// 处理多个ref的组合使用
// =============================================================================

/**
 * useMergeRefsFn Hook
 * 
 * 创建一个ref合并函数。注意这是一个单例Hook,返回的函数只能调用一次。
 * 
 * 使用场景:
 * 1. 需要同时使用多个ref时
 * 2. 转发ref时需要同时保留内部ref
 * 
 * 特点:
 * - 存储refs列表
 * - 返回一个可以更新所有ref的函数
 */
function useMergeRefsFn() {
  type MaybeRef<T> = MutableRefObject<T> | ((value: T) => void) | null | undefined
  let currentRefs = useRef<MaybeRef<any>[]>([])
  let mergedRef = useCallback((value: any) => {
    for (let ref of currentRefs.current) {
      if (ref == null) continue
      if (typeof ref === 'function') ref(value)
      else ref.current = value
    }
  }, [])

  return (...refs: any[]) => {
    if (refs.every((ref) => ref == null)) {
      return undefined
    }

    currentRefs.current = refs
    return mergedRef
  }
}

/**
 * defaultMergeRefs函数
 * 
 * 简单的ref合并实现,用于as={Fragment}的情况
 * 注意: 这不会产生稳定的函数引用
 */
function defaultMergeRefs(...refs: any[]) {
  return refs.every((ref) => ref == null)
    ? undefined
    : (value: any) => {
        for (let ref of refs) {
          if (ref == null) continue
          if (typeof ref === 'function') ref(value)
          else ref.current = value
        }
      }
}

// =============================================================================
// Props合并系统
// 处理多个props对象的合并
// =============================================================================

/**
 * mergePropsAdvanced函数
 * 
 * 高级props合并实现:
 * 1. 处理事件监听器的合并
 * 2. 处理disabled状态下的事件阻止
 * 3. 处理事件的preventDefault逻辑
 */
function mergePropsAdvanced(...listOfProps: Props<any, any>[]) {
  if (listOfProps.length === 0) return {}
  if (listOfProps.length === 1) return listOfProps[0]

  let target: Props<any, any> = {}

  let eventHandlers: Record<
    string,
    ((event: { defaultPrevented: boolean }, ...args: any[]) => void | undefined)[]
  > = {}

  for (let props of listOfProps) {
    for (let prop in props) {
      // Collect event handlers
      if (prop.startsWith('on') && typeof props[prop] === 'function') {
        eventHandlers[prop] ??= []
        eventHandlers[prop].push(props[prop])
      } else {
        // Override incoming prop
        target[prop] = props[prop]
      }
    }
  }

  // Ensure event listeners are not called if `disabled` or `aria-disabled` is true
  if (target.disabled || target['aria-disabled']) {
    for (let eventName in eventHandlers) {
      // Prevent default events for `onClick`, `onMouseDown`, `onKeyDown`, etc.
      if (/^(on(?:Click|Pointer|Mouse|Key)(?:Down|Up|Press)?)$/.test(eventName)) {
        eventHandlers[eventName] = [(e: any) => e?.preventDefault?.()]
      }
    }
  }

  // Merge event handlers
  for (let eventName in eventHandlers) {
    Object.assign(target, {
      [eventName](event: { nativeEvent?: Event; defaultPrevented: boolean }, ...args: any[]) {
        let handlers = eventHandlers[eventName]

        for (let handler of handlers) {
          if (
            (event instanceof Event || event?.nativeEvent instanceof Event) &&
            event.defaultPrevented
          ) {
            return
          }

          handler(event, ...args)
        }
      },
    })
  }

  return target
}

// =============================================================================
// 工具类型和函数
// =============================================================================

/** 用于标记组件具有displayName的类型 */
export type HasDisplayName = {
  displayName: string
}

/** 用于推导组件ref类型的工具类型 */
export type RefProp<T extends Function> = T extends (props: any, ref: Ref<infer RefType>) => any
  ? { ref?: Ref<RefType> }
  : never

/**
 * mergeProps函数
 * 
 * 基础的props合并实现,用于简单的props合并场景
 */
export function mergeProps<T extends Props<any, any>[]>(...listOfProps: T) {
  if (listOfProps.length === 0) return {}
  if (listOfProps.length === 1) return listOfProps[0]

  let target: Props<any, any> = {}

  let eventHandlers: Record<string, ((...args: any[]) => void | undefined)[]> = {}

  for (let props of listOfProps) {
    for (let prop in props) {
      // Merge event listeners
      if (prop.startsWith('on') && typeof props[prop] === 'function') {
        eventHandlers[prop] ??= []
        eventHandlers[prop].push(props[prop])
      } else {
        // Override incoming prop
        target[prop] = props[prop]
      }
    }
  }

  // Merge event handlers
  for (let eventName in eventHandlers) {
    Object.assign(target, {
      [eventName](...args: any[]) {
        let handlers = eventHandlers[eventName]

        for (let handler of handlers) {
          handler?.(...args)
        }
      },
    })
  }

  return target
}

/**
 * forwardRefWithAs函数
 * 
 * 包装组件以支持ref转发,同时保持完整的类型信息
 * 这是一个hack,但可以保持组件的完整API同时支持ref转发
 */
export function forwardRefWithAs<T extends { name: string; displayName?: string }>(
  component: T
): T & { displayName: string } {
  return Object.assign(forwardRef(component as any) as any, {
    displayName: component.displayName ?? component.name,
  })
}

/**
 * compact函数
 * 
 * 清理对象中的undefined值
 */
export function compact<T extends Record<any, any>>(object: T) {
  let clone = Object.assign({}, object)
  for (let key in clone) {
    if (clone[key] === undefined) delete clone[key]
  }
  return clone
}

/**
 * omit函数
 * 
 * 从对象中排除指定的键
 */
function omit<T extends Record<any, any>>(object: T, keysToOmit: string[] = []) {
  let clone = Object.assign({}, object) as T
  for (let key of keysToOmit) {
    if (key in clone) delete clone[key]
  }
  return clone
}

/**
 * getElementRef函数
 * 
 * 获取React元素的ref
 * 适配React 19+的新ref位置
 */
function getElementRef(element: React.ReactElement) {
  // @ts-expect-error
  return React.version.split('.')[0] >= '19' ? element.props.ref : element.ref
}
