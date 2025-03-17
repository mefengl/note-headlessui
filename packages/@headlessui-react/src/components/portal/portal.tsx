/**
 * portal.tsx - React Portal传送门组件
 * 
 * Portal组件允许将子组件渲染到DOM树中的任何位置，
 * 常用于模态框、弹出菜单等需要打破DOM层级限制的场景。
 * 
 * 核心特性：
 * 1. 支持嵌套Portal（通过PortalGroup）
 * 2. 支持在Shadow DOM中使用
 * 3. 自动管理Portal容器的生命周期
 * 4. SSR友好（服务端渲染支持）
 * 
 * 基础用法：
 * ```tsx
 * // 1. 基础Portal - 渲染到body下的portal-root
 * <Portal>
 *   <div>这个div会被渲染到body下</div>
 * </Portal>
 * 
 * // 2. 指定目标容器
 * const target = useRef(null)
 * <div ref={target}>
 *   <PortalGroup target={target}>
 *     <Portal>
 *       渲染到target元素内
 *     </Portal>
 *   </PortalGroup>
 * </div>
 * 
 * // 3. 嵌套Portal
 * const [portals, Wrapper] = useNestedPortals()
 * <Wrapper>
 *   <Portal>
 *     <Portal>
 *       正确处理嵌套关系
 *     </Portal>
 *   </Portal>
 * </Wrapper>
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
  type ContextType,
  type ElementType,
  type MutableRefObject,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'
import { useEvent } from '../../hooks/use-event'
import { useIsoMorphicEffect } from '../../hooks/use-iso-morphic-effect'
import { useOnUnmount } from '../../hooks/use-on-unmount'
import { useOwnerDocument } from '../../hooks/use-owner'
import { useServerHandoffComplete } from '../../hooks/use-server-handoff-complete'
import { optionalRef, useSyncRefs } from '../../hooks/use-sync-refs'
import { usePortalRoot } from '../../internal/portal-force-root'
import type { Props } from '../../types'
import { env } from '../../utils/env'
import { forwardRefWithAs, useRender, type HasDisplayName, type RefProp } from '../../utils/render'

/**
 * usePortalTarget - 获取Portal的目标容器
 * 
 * 工作流程：
 * 1. 检查是否需要强制在当前DOM树中渲染
 * 2. 检查是否有PortalGroup提供的目标容器
 * 3. 如果都没有，则在body下创建默认容器
 * 
 * @param ownerDocument 所属文档对象
 * @returns HTMLElement | null 目标容器元素
 */
function usePortalTarget(ownerDocument: Document | null): HTMLElement | null {
  let forceInRoot = usePortalRoot()
  let groupTarget = useContext(PortalGroupContext)
  let [target, setTarget] = useState(() => {
    // 如果需要强制在当前树中渲染，忽略group target
    if (!forceInRoot && groupTarget !== null) return groupTarget.current ?? null

    // 服务端直接返回null
    if (env.isServer) return null

    // 尝试获取或创建默认容器
    let existingRoot = ownerDocument?.getElementById('headlessui-portal-root')
    if (existingRoot) return existingRoot

    if (ownerDocument === null) return null

    let root = ownerDocument.createElement('div')
    root.setAttribute('id', 'headlessui-portal-root')
    return ownerDocument.body.appendChild(root)
  })

  // 确保容器始终存在于DOM中
  useEffect(() => {
    if (target === null) return
    if (!ownerDocument?.body.contains(target)) {
      ownerDocument?.body.appendChild(target)
    }
  }, [target, ownerDocument])

  // 当group target变化时更新目标容器
  useEffect(() => {
    if (forceInRoot) return
    if (groupTarget === null) return
    setTarget(groupTarget.current)
  }, [groupTarget, setTarget, forceInRoot])

  return target
}

// 定义默认的Portal标签和属性
let DEFAULT_PORTAL_TAG = Fragment
type PortalRenderPropArg = {}
type PortalPropsWeControl = never

/**
 * Portal组件属性定义
 */
export type PortalProps<TTag extends ElementType = typeof DEFAULT_PORTAL_TAG> = Props<
  TTag,
  PortalRenderPropArg,
  PortalPropsWeControl,
  {
    enabled?: boolean      // 是否启用Portal
    ownerDocument?: Document | null // 使用的文档对象
  }
>

/**
 * InternalPortalFn - Portal的内部实现
 * 
 * 负责：
 * 1. 创建和管理Portal容器
 * 2. 处理父子Portal的关系
 * 3. 在组件卸载时清理DOM
 */
let InternalPortalFn = forwardRefWithAs(function InternalPortalFn<
  TTag extends ElementType = typeof DEFAULT_PORTAL_TAG,
>(props: PortalProps<TTag>, ref: Ref<HTMLElement>) {
  let { ownerDocument: incomingOwnerDocument = null, ...theirProps } = props
  
  // Portal根元素的引用
  let internalPortalRootRef = useRef<HTMLElement | null>(null)
  
  // 同步各种ref
  let portalRef = useSyncRefs(
    optionalRef<(typeof internalPortalRootRef)['current']>((ref) => {
      internalPortalRootRef.current = ref
    }),
    ref
  )

  // 获取文档对象
  let defaultOwnerDocument = useOwnerDocument(internalPortalRootRef)
  let ownerDocument = incomingOwnerDocument ?? defaultOwnerDocument

  // 获取目标容器
  let target = usePortalTarget(ownerDocument)

  // 创建Portal容器元素
  let [element] = useState<HTMLDivElement | null>(() =>
    env.isServer ? null : ownerDocument?.createElement('div') ?? null
  )

  // 获取父Portal上下文
  let parent = useContext(PortalParentContext)

  // 等待服务端渲染完成
  let ready = useServerHandoffComplete()

  // 确保Portal容器被正确挂载
  useIsoMorphicEffect(() => {
    if (!target || !element) return
    if (!target.contains(element)) {
      element.setAttribute('data-headlessui-portal', '')
      target.appendChild(element)
    }
  }, [target, element])

  // 注册到父Portal
  useIsoMorphicEffect(() => {
    if (!element) return
    if (!parent) return
    return parent.register(element)
  }, [parent, element])

  // 清理工作
  useOnUnmount(() => {
    if (!target || !element) return
    
    // 移除Portal容器
    if (element instanceof Node && target.contains(element)) {
      target.removeChild(element)
    }

    // 如果目标容器为空，也将其移除
    if (target.childNodes.length <= 0) {
      target.parentElement?.removeChild(target)
    }
  })

  let render = useRender()

  // SSR时不渲染
  if (!ready) return null

  let ourProps = { ref: portalRef }

  // 使用createPortal渲染内容
  return !target || !element
    ? null
    : createPortal(
        render({
          ourProps,
          theirProps,
          slot: {},
          defaultTag: DEFAULT_PORTAL_TAG,
          name: 'Portal',
        }),
        element
      )
})

/**
 * PortalFn - Portal的外部包装器
 * 处理enabled属性，决定是否启用Portal功能
 */
function PortalFn<TTag extends ElementType = typeof DEFAULT_PORTAL_TAG>(
  props: PortalProps<TTag>,
  ref: Ref<HTMLElement>
) {
  let portalRef = useSyncRefs(ref)
  let { enabled = true, ownerDocument, ...theirProps } = props
  let render = useRender()

  return enabled ? (
    <InternalPortalFn {...theirProps} ownerDocument={ownerDocument} ref={portalRef} />
  ) : (
    render({
      ourProps: { ref: portalRef },
      theirProps,
      slot: {},
      defaultTag: DEFAULT_PORTAL_TAG,
      name: 'Portal',
    })
  )
}

// Portal Group相关实现
let DEFAULT_GROUP_TAG = Fragment
type GroupRenderPropArg = {}
type GroupPropsWeControl = never

// Portal Group上下文
let PortalGroupContext = createContext<MutableRefObject<HTMLElement | null> | null>(null)

/**
 * Portal Group属性定义
 */
export type PortalGroupProps<TTag extends ElementType = typeof DEFAULT_GROUP_TAG> = Props<
  TTag,
  GroupRenderPropArg,
  GroupPropsWeControl,
  {
    target: MutableRefObject<HTMLElement | null>
  }
>

/**
 * GroupFn - Portal Group的实现
 * 用于将多个Portal渲染到同一个目标容器
 */
function GroupFn<TTag extends ElementType = typeof DEFAULT_GROUP_TAG>(
  props: PortalGroupProps<TTag>,
  ref: Ref<HTMLElement>
) {
  let { target, ...theirProps } = props
  let groupRef = useSyncRefs(ref)
  let ourProps = { ref: groupRef }
  let render = useRender()

  return (
    <PortalGroupContext.Provider value={target}>
      {render({
        ourProps,
        theirProps,
        defaultTag: DEFAULT_GROUP_TAG,
        name: 'Popover.Group',
      })}
    </PortalGroupContext.Provider>
  )
}

/**
 * Portal父子关系管理上下文
 */
let PortalParentContext = createContext<{
  register: (portal: HTMLElement) => () => void
  unregister: (portal: HTMLElement) => void
  portals: MutableRefObject<HTMLElement[]>
} | null>(null)

/**
 * useNestedPortals - 嵌套Portal管理Hook
 * 
 * 用于：
 * 1. 跟踪Portal的父子关系
 * 2. 维护Portal的注册表
 * 3. 提供Portal的上下文包装器
 * 
 * @returns [portalRefs, PortalWrapper] 
 */
export function useNestedPortals() {
  let parent = useContext(PortalParentContext)
  let portals = useRef<HTMLElement[]>([])

  // 注册Portal
  let register = useEvent((portal: HTMLElement) => {
    portals.current.push(portal)
    if (parent) parent.register(portal)
    return () => unregister(portal)
  })

  // 注销Portal
  let unregister = useEvent((portal: HTMLElement) => {
    let idx = portals.current.indexOf(portal)
    if (idx !== -1) portals.current.splice(idx, 1)
    if (parent) parent.unregister(portal)
  })

  // 创建上下文API
  let api = useMemo<ContextType<typeof PortalParentContext>>(
    () => ({ register, unregister, portals }),
    [register, unregister, portals]
  )

  return [
    portals,
    useMemo(() => {
      return function PortalWrapper({ children }: { children: React.ReactNode }) {
        return <PortalParentContext.Provider value={api}>{children}</PortalParentContext.Provider>
      }
    }, [api]),
  ] as const
}

// 组件类型定义
export interface _internal_ComponentPortal extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_PORTAL_TAG>(
    props: PortalProps<TTag> & RefProp<typeof PortalFn>
  ): React.JSX.Element
}

export interface _internal_ComponentPortalGroup extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_GROUP_TAG>(
    props: PortalGroupProps<TTag> & RefProp<typeof GroupFn>
  ): React.JSX.Element
}

// 创建最终的Portal组件
let PortalRoot = forwardRefWithAs(PortalFn) as unknown as _internal_ComponentPortal
export let PortalGroup = forwardRefWithAs(GroupFn) as _internal_ComponentPortalGroup

// 导出Portal及其Group子组件
export let Portal = Object.assign(PortalRoot, {
  /** @deprecated use `<PortalGroup>` instead of `<Portal.Group>` */
  Group: PortalGroup,
})
