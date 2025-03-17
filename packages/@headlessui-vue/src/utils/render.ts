import { cloneVNode, Fragment, h, type Slots, type VNode } from 'vue'
import { match } from './match'

// =============================================================================
// 渲染特性枚举 
// 与React版本保持一致,确保两个框架版本的行为统一
// =============================================================================
export enum Features {
  /** 无特性 - 基础渲染模式 */
  None = 0,

  /**
   * 渲染策略特性
   * 
   * 与React版本相同,支持两种渲染策略:
   * - Unmount: 不可见时完全卸载
   * - Hidden: 不可见时使用[hidden]属性隐藏
   * 
   * 区别: Vue版本使用的是Vue的虚拟DOM系统
   */
  RenderStrategy = 1,

  /**
   * 静态渲染特性
   * 
   * 与React版本功能相同:
   * - 允许用户控制渲染行为
   * - 用于自定义过渡和显示逻辑
   */
  Static = 2,
}

// =============================================================================
// 渲染策略枚举
// 与React版本完全相同的策略定义
// =============================================================================
export enum RenderStrategy {
  /** 完全卸载组件 */
  Unmount,
  /** 保持在DOM中但隐藏 */
  Hidden,
}

// =============================================================================
// 核心渲染函数
// Vue特有的渲染实现,但保持与React版本相似的接口
// =============================================================================

/**
 * 渲染函数 - 处理组件的渲染逻辑
 * 
 * Vue版本的核心渲染实现:
 * 1. 支持相同的特性系统
 * 2. 使用Vue的h函数创建虚拟DOM
 * 3. 处理插槽而不是children
 * 
 * 与React版本的主要区别:
 * - 使用Vue的props/attrs系统
 * - 处理Vue特有的插槽机制
 * - 不需要处理ref合并(Vue有自己的ref系统)
 */
export function render({
  visible = true,
  features = Features.None,
  ourProps,      // 内部props(组件的props)
  theirProps,    // 外部props(用户的props)
  ...main
}: {
  ourProps: Record<string, any>
  theirProps: Record<string, any>
  slot: Record<string, any>
  attrs: Record<string, any>
  slots: Slots
  name: string
} & {
  features?: Features
  visible?: boolean
}) {
  // 合并props
  let props = mergeProps(theirProps, ourProps)

  // 根据渲染策略和可见性状态选择渲染方法
  let strategy = calculateStrategy(props, features)
  if (strategy === RenderStrategy.Unmount && !visible) {
    return null
  }

  // 返回实际的渲染结果
  return _render({
    ...main,
    props: {
      ...props,
      ...(strategy === RenderStrategy.Hidden && visible ? { hidden: true, style: { display: 'none' } } : {}),
    },
  })
}

// =============================================================================
// 底层渲染实现
// Vue特有的DOM元素创建和属性应用逻辑
// =============================================================================

/**
 * 内部渲染函数 - 处理具体的DOM渲染逻辑
 * 
 * Vue版本的具体渲染实现:
 * 1. 处理as属性(动态标签)
 * 2. 处理插槽内容
 * 3. 应用data-*属性
 * 4. 处理template特殊情况
 * 
 * 与React版本的主要区别:
 * - 使用Vue的h函数而不是createElement
 * - 处理Vue特有的template元素情况
 * - 不需要处理React特有的Fragment逻辑
 */
function _render({
  props,
  attrs,
  slots,
  slot,
  name,
}: {
  props: Record<string, any>
  slot: Record<string, any>
  attrs: Record<string, any>
  slots: Slots
  name: string
}) {
  // 解构props，分离as属性和其他属性
  let { as, ...incomingProps } = omit(props, ['unmount', 'static'])

  // 处理默认插槽
  let children = slots.default?.(slot)

  // 生成data-*属性，用于状态标记
  let dataAttributes: Record<string, string> = {}
  if (slot) {
    let exposeState = false
    let states = []
    for (let [k, v] of Object.entries(slot)) {
      if (typeof v === 'boolean') {
        exposeState = true
      }
      if (v === true) {
        states.push(k)
      }
    }
    if (exposeState) dataAttributes[`data-headlessui-state`] = states.join(' ')
  }

  // 处理template特殊情况
  if (as === 'template') {
    if (Object.keys(incomingProps).length > 0 || Object.keys(attrs).length > 0) {
      let allProps = [...Object.keys(incomingProps), ...Object.keys(attrs)]
      throw new Error(
        [
          'Passing props on "template"!',
          '',
          `The current component <${name} /> is rendering a "template".`,
          'However we need to passthrough the following props:',
          allProps.map(line => `  - ${line}`).join('\n'),
          '',
          'You can apply a few solutions:',
          [
            'Add an `as="..."` prop, to ensure that we render an actual element instead of a "template".',
            'Render a single element as the child so that we can forward the props onto that element.',
          ].map(line => `  - ${line}`).join('\n'),
        ].join('\n')
      )
    }

    // template元素的特殊处理
    if (Array.isArray(children) && children.length === 1) {
      return children[0]
    }
    return children
  }

  // 创建Vue虚拟节点
  return h(as, Object.assign({}, incomingProps, dataAttributes), {
    default: () => children,
  })
}

// =============================================================================
// 辅助函数
// Vue特有的工具函数
// =============================================================================

/**
 * flattenFragments函数
 * 
 * Vue特有的Fragment处理:
 * - 处理嵌套的slot渲染
 * - 展平多层组件嵌套中的Fragment
 * 
 * 使用场景:
 * <Example><span>something</span></Example>
 * 
 * 当Example定义为:
 * <SomeComponent><slot /></SomeComponent>
 */
function flattenFragments(children: VNode[]): VNode[] {
  return children.flatMap((child) => {
    if (child.type === Fragment) {
      return flattenFragments(child.children as VNode[])
    }
    return [child]
  })
}

/**
 * mergeProps函数
 * 
 * Vue版本的props合并实现:
 * 1. 合并事件处理器
 * 2. 处理disabled状态
 * 3. 处理事件冒泡
 * 
 * 与React版本的主要区别:
 * - 适配Vue的事件系统
 * - 不需要处理React特有的合成事件
 */
function mergeProps(...listOfProps: Record<any, any>[]) {
  if (listOfProps.length === 0) return {}
  if (listOfProps.length === 1) return listOfProps[0]

  let target: Record<any, any> = {}
  let eventHandlers: Record<
    string,
    ((event: { defaultPrevented: boolean }, ...args: any[]) => void | undefined)[]
  > = {}

  // 收集所有props和事件处理器
  for (let props of listOfProps) {
    for (let prop in props) {
      if (prop.startsWith('on') && typeof props[prop] === 'function') {
        eventHandlers[prop] ??= []
        eventHandlers[prop].push(props[prop])
      } else {
        target[prop] = props[prop]
      }
    }
  }

  // 处理disabled状态
  if (target.disabled || target['aria-disabled']) {
    return Object.assign(
      target,
      Object.fromEntries(Object.keys(eventHandlers).map((eventName) => [eventName, undefined]))
    )
  }

  // 合并事件处理器
  for (let eventName in eventHandlers) {
    Object.assign(target, {
      [eventName](event: { defaultPrevented: boolean }, ...args: any[]) {
        let handlers = eventHandlers[eventName]
        for (let handler of handlers) {
          if (event instanceof Event && event.defaultPrevented) {
            return
          }
          handler(event, ...args)
        }
      },
    })
  }

  return target
}

/**
 * 工具函数
 */

/** 清理undefined值 */
export function compact<T extends Record<any, any>>(object: T) {
  let clone = Object.assign({}, object)
  for (let key in clone) {
    if (clone[key] === undefined) delete clone[key]
  }
  return clone
}

/** 排除指定键 */
export function omit<T extends Record<any, any>, Keys extends keyof T>(
  object: T,
  keysToOmit: readonly Keys[] = []
) {
  let clone = Object.assign({}, object) as T
  for (let key of keysToOmit) {
    if (key in clone) delete clone[key]
  }
  return clone as Omit<T, Keys>
}

/**
  // 合并事件处理器
  for (let eventName in eventHandlers) {
    Object.assign(target, {
      [eventName](event: { defaultPrevented: boolean }, ...args: any[]) {
        let handlers = eventHandlers[eventName]
        for (let handler of handlers) {
          if (event instanceof Event && event.defaultPrevented) {
            return
          }
          handler(event, ...args)
        }
      },
    })
  }

  return target
}

/**
 * 工具函数
 */

/** 清理undefined值 */
export function compact<T extends Record<any, any>>(object: T) {
  let clone = Object.assign({}, object)
  for (let key in clone) {
    if (clone[key] === undefined) delete clone[key]
  }
  return clone
}

/** 排除指定键 */
export function omit<T extends Record<any, any>, Keys extends keyof T>(
  object: T,
  keysToOmit: readonly Keys[] = []
) {
  let clone = Object.assign({}, object) as T
  for (let key of keysToOmit) {
    if (key in clone) delete clone[key]
  }
  return clone as Omit<T, Keys>
}

/**
 * 验证元素是否有效
 * 
 * Vue特有的元素验证逻辑:
 * - 检查字符串类型(原生标签)
 * - 检查对象类型(组件)
 * - 检查函数类型(内置组件如Transition)
 */
function isValidElement(input: any): boolean {
  if (input == null) return false // 无子元素
  if (typeof input.type === 'string') return true // 'div', 'span'等
  if (typeof input.type === 'object') return true // 其他组件
  if (typeof input.type === 'function') return true // 内置组件如Transition
  return false // 注释、字符串等
}
