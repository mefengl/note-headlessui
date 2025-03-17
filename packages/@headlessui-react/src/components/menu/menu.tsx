/**
 * Menu组件 - HeadlessUI中的下拉菜单实现
 * 
 * WAI-ARIA规范: https://www.w3.org/WAI/ARIA/apg/patterns/menubutton/
 * 这是一个完全无样式的可访问性菜单组件,遵循WAI-ARIA菜单按钮模式规范
 */

'use client'

import { useFocusRing } from '@react-aria/focus'
import { useHover } from '@react-aria/interactions'
import React, {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ElementType,
  type MutableRefObject,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type Ref,
} from 'react'
import { flushSync } from 'react-dom'
import { useActivePress } from '../../hooks/use-active-press'
import { useDidElementMove } from '../../hooks/use-did-element-move'
import { useDisposables } from '../../hooks/use-disposables'
import { useElementSize } from '../../hooks/use-element-size'
import { useEvent } from '../../hooks/use-event'
import { useId } from '../../hooks/use-id'
import { useInertOthers } from '../../hooks/use-inert-others'
import { useIsoMorphicEffect } from '../../hooks/use-iso-morphic-effect'
import { useOnDisappear } from '../../hooks/use-on-disappear'
import { useOutsideClick } from '../../hooks/use-outside-click'
import { useOwnerDocument } from '../../hooks/use-owner'
import { useResolveButtonType } from '../../hooks/use-resolve-button-type'
import { useScrollLock } from '../../hooks/use-scroll-lock'
import { useSyncRefs } from '../../hooks/use-sync-refs'
import { useTextValue } from '../../hooks/use-text-value'
import { useTrackedPointer } from '../../hooks/use-tracked-pointer'
import { transitionDataAttributes, useTransition } from '../../hooks/use-transition'
import { useTreeWalker } from '../../hooks/use-tree-walker'
import {
  FloatingProvider,
  useFloatingPanel,
  useFloatingPanelProps,
  useFloatingReference,
  useFloatingReferenceProps,
  useResolvedAnchor,
  type AnchorProps,
} from '../../internal/floating'
import { OpenClosedProvider, State, useOpenClosed } from '../../internal/open-closed'
import type { Props } from '../../types'
import { isDisabledReactIssue7711 } from '../../utils/bugs'
import { Focus, calculateActiveIndex } from '../../utils/calculate-active-index'
import { disposables } from '../../utils/disposables'
import {
  Focus as FocusManagementFocus,
  FocusableMode,
  focusFrom,
  isFocusableElement,
  restoreFocusIfNecessary,
  sortByDomNode,
} from '../../utils/focus-management'
import { match } from '../../utils/match'
import {
  RenderFeatures,
  forwardRefWithAs,
  mergeProps,
  useRender,
  type HasDisplayName,
  type RefProp,
} from '../../utils/render'
import { useDescriptions } from '../description/description'
import { Keys } from '../keyboard'
import { useLabelContext, useLabels } from '../label/label'
import { Portal } from '../portal/portal'

// =============================================================================
// 菜单状态管理 - 核心枚举和类型
// =============================================================================

/**
 * 菜单状态枚举
 * 一个菜单只有两种状态:
 * - Open: 菜单展开
 * - Closed: 菜单收起
 */
enum MenuStates {
  Open,
  Closed,
}

/**
 * 激活触发器枚举
 * 用于追踪菜单项是如何被激活的:
 * - Pointer: 通过鼠标/触摸等指针设备
 * - Other: 其他方式(如键盘)
 */
enum ActivationTrigger {
  Pointer,
  Other,
}

/**
 * 菜单项数据引用类型
 * 存储每个菜单项的关键信息:
 * - textValue: 菜单项的文本内容,用于搜索匹配
 * - disabled: 是否禁用
 * - domRef: 对应DOM节点的引用
 */
type MenuItemDataRef = MutableRefObject<{
  textValue?: string
  disabled: boolean
  domRef: MutableRefObject<HTMLElement | null>
}>

/**
 * 菜单状态定义
 * 包含菜单所需的所有状态数据:
 * - __demoMode: 是否处于演示模式
 * - menuState: 当前菜单打开状态
 * - buttonElement: 触发按钮元素
 * - itemsElement: 菜单列表容器元素
 * - items: 所有菜单项的信息
 * - searchQuery: 当前搜索查询
 * - activeItemIndex: 当前激活项的索引
 * - activationTrigger: 当前激活方式
 */
interface StateDefinition {
  __demoMode: boolean
  menuState: MenuStates
  buttonElement: HTMLButtonElement | null
  itemsElement: HTMLElement | null
  items: { id: string; dataRef: MenuItemDataRef }[]
  searchQuery: string
  activeItemIndex: number | null
  activationTrigger: ActivationTrigger
}

/**
 * 动作类型枚举
 * 定义所有可能的状态更新动作:
 * - OpenMenu/CloseMenu: 打开/关闭菜单
 * - GoToItem: 导航到特定菜单项
 * - Search/ClearSearch: 搜索相关操作
 * - RegisterItem/UnregisterItem: 菜单项注册管理
 * - SetButtonElement/SetItemsElement: 更新DOM引用
 */
enum ActionTypes {
  OpenMenu,
  CloseMenu,
  GoToItem,
  Search,
  ClearSearch,
  RegisterItem,
  UnregisterItem,
  SetButtonElement,
  SetItemsElement,
}

/**
 * 状态调整函数 - 保持菜单项顺序与DOM顺序一致
 * 
 * @param state 当前菜单状态
 * @param adjustment 用于调整items数组的函数(可选)
 * 
 * 主要功能:
 * 1. 根据DOM顺序对菜单项进行排序
 * 2. 维护激活项索引的正确性
 * 3. 处理项目插入/删除后的状态调整
 */
function adjustOrderedState(
  state: StateDefinition,
  adjustment: (items: StateDefinition['items']) => StateDefinition['items'] = (i) => i
) {
  let currentActiveItem = state.activeItemIndex !== null ? state.items[state.activeItemIndex] : null

  let sortedItems = sortByDomNode(
    adjustment(state.items.slice()),
    (item) => item.dataRef.current.domRef.current
  )

  // If we inserted an item before the current active item then the active item index
  // would be wrong. To fix this, we will re-lookup the correct index.
  let adjustedActiveItemIndex = currentActiveItem ? sortedItems.indexOf(currentActiveItem) : null

  // Reset to `null` in case the currentActiveItem was removed.
  if (adjustedActiveItemIndex === -1) {
    adjustedActiveItemIndex = null
  }

  return {
    items: sortedItems,
    activeItemIndex: adjustedActiveItemIndex,
  }
}

/**
 * 动作类型联合
 * 定义所有可能的状态更新动作:
 * 
 * - CloseMenu/OpenMenu: 菜单开关控制
 * - GoToItem: 导航到指定项
 * - Search/ClearSearch: 搜索功能
 * - RegisterItem/UnregisterItem: 菜单项注册管理
 * - SetButtonElement/SetItemsElement: DOM引用更新
 */
type Actions =
  | { type: ActionTypes.CloseMenu }
  | { type: ActionTypes.OpenMenu }
  | { type: ActionTypes.GoToItem; focus: Focus.Specific; id: string; trigger?: ActivationTrigger }
  | {
      type: ActionTypes.GoToItem
      focus: Exclude<Focus, Focus.Specific>
      trigger?: ActivationTrigger
    }
  | { type: ActionTypes.Search; value: string }
  | { type: ActionTypes.ClearSearch }
  | { type: ActionTypes.RegisterItem; id: string; dataRef: MenuItemDataRef }
  | { type: ActionTypes.UnregisterItem; id: string }
  | { type: ActionTypes.SetButtonElement; element: HTMLButtonElement | null }
  | { type: ActionTypes.SetItemsElement; element: HTMLElement | null }

/**
 * 状态处理器集合
 * 包含所有动作类型对应的处理逻辑
 * 
 * 每个处理器都接收当前状态和具体动作，返回新的状态
 * 使用TypeScript的高级类型确保类型安全
 */
let reducers: {
  [P in ActionTypes]: (
    state: StateDefinition,
    action: Extract<Actions, { type: P }>
  ) => StateDefinition
} = {
  /**
   * 关闭菜单处理器
   * - 如果菜单已关闭,返回原状态
   * - 否则清除激活项并关闭菜单
   */
  [ActionTypes.CloseMenu](state) {
    if (state.menuState === MenuStates.Closed) return state
    return { ...state, activeItemIndex: null, menuState: MenuStates.Closed }
  },

  /**
   * 打开菜单处理器
   * - 如果菜单已打开,返回原状态
   * - 否则关闭演示模式并打开菜单
   */
  [ActionTypes.OpenMenu](state) {
    if (state.menuState === MenuStates.Open) return state
    return {
      ...state,
      __demoMode: false,
      menuState: MenuStates.Open,
    }
  },

  /**
   * 项目导航处理器 
   * 处理所有菜单项导航相关的逻辑:
   * - Focus.Nothing: 清除激活状态
   * - Focus.Specific: 导航到指定项
   * - Focus.Next/Previous: 导航到下一个/上一个项
   * - Focus.First/Last: 导航到第一个/最后一个项
   * 
   * 包含多项性能优化:
   * 1. 避免不必要的DOM排序
   * 2. 优化相邻项的导航
   * 3. 处理边界情况(第一项/最后一项)
   */
  [ActionTypes.GoToItem]: (state, action) => {
    if (state.menuState === MenuStates.Closed) return state

    let base = {
      ...state,
      searchQuery: '',
      activationTrigger: action.trigger ?? ActivationTrigger.Other,
      __demoMode: false,
    }

    // Optimization:
    //
    // There is no need to sort the DOM nodes if we know that we don't want to focus anything
    if (action.focus === Focus.Nothing) {
      return {
        ...base,
        activeItemIndex: null,
      }
    }

    // Optimization:
    //
    // There is no need to sort the DOM nodes if we know exactly where to go
    if (action.focus === Focus.Specific) {
      return {
        ...base,
        activeItemIndex: state.items.findIndex((o) => o.id === action.id),
      }
    }

    // Optimization:
    //
    // If the current DOM node and the previous DOM node are next to each other,
    // or if the previous DOM node is already the first DOM node, then we don't
    // have to sort all the DOM nodes.
    else if (action.focus === Focus.Previous) {
      let activeItemIdx = state.activeItemIndex
      if (activeItemIdx !== null) {
        let currentDom = state.items[activeItemIdx].dataRef.current.domRef
        let previousItemIndex = calculateActiveIndex(action, {
          resolveItems: () => state.items,
          resolveActiveIndex: () => state.activeItemIndex,
          resolveId: (item) => item.id,
          resolveDisabled: (item) => item.dataRef.current.disabled,
        })
        if (previousItemIndex !== null) {
          let previousDom = state.items[previousItemIndex].dataRef.current.domRef
          if (
            // Next to each other
            currentDom.current?.previousElementSibling === previousDom.current ||
            // Or already the first element
            previousDom.current?.previousElementSibling === null
          ) {
            return {
              ...base,
              activeItemIndex: previousItemIndex,
            }
          }
        }
      }
    }

    // Optimization:
    //
    // If the current DOM node and the next DOM node are next to each other, or
    // if the next DOM node is already the last DOM node, then we don't have to
    // sort all the DOM nodes.
    else if (action.focus === Focus.Next) {
      let activeItemIdx = state.activeItemIndex
      if (activeItemIdx !== null) {
        let currentDom = state.items[activeItemIdx].dataRef.current.domRef
        let nextItemIndex = calculateActiveIndex(action, {
          resolveItems: () => state.items,
          resolveActiveIndex: () => state.activeItemIndex,
          resolveId: (item) => item.id,
          resolveDisabled: (item) => item.dataRef.current.disabled,
        })
        if (nextItemIndex !== null) {
          let nextDom = state.items[nextItemIndex].dataRef.current.domRef
          if (
            // Next to each other
            currentDom.current?.nextElementSibling === nextDom.current ||
            // Or already the last element
            nextDom.current?.nextElementSibling === null
          ) {
            return {
              ...base,
              activeItemIndex: nextItemIndex,
            }
          }
        }
      }
    }

    // Slow path:
    //
    // Ensure all the items are correctly sorted according to DOM position
    let adjustedState = adjustOrderedState(state)
    let activeItemIndex = calculateActiveIndex(action, {
      resolveItems: () => adjustedState.items,
      resolveActiveIndex: () => adjustedState.activeItemIndex,
      resolveId: (item) => item.id,
      resolveDisabled: (item) => item.dataRef.current.disabled,
    })

    return {
      ...base,
      ...adjustedState,
      activeItemIndex,
    }
  },

  /**
   * 搜索处理器
   * 实现菜单项的快速查找功能:
   * 1. 累积搜索查询
   * 2. 从当前项开始搜索匹配项
   * 3. 处理未找到匹配的情况
   */
  [ActionTypes.Search]: (state, action) => {
    let wasAlreadySearching = state.searchQuery !== ''
    let offset = wasAlreadySearching ? 0 : 1
    let searchQuery = state.searchQuery + action.value.toLowerCase()

    let reOrderedItems =
      state.activeItemIndex !== null
        ? state.items
            .slice(state.activeItemIndex + offset)
            .concat(state.items.slice(0, state.activeItemIndex + offset))
        : state.items

    let matchingItem = reOrderedItems.find(
      (item) =>
        item.dataRef.current.textValue?.startsWith(searchQuery) && !item.dataRef.current.disabled
    )

    let matchIdx = matchingItem ? state.items.indexOf(matchingItem) : -1
    if (matchIdx === -1 || matchIdx === state.activeItemIndex) return { ...state, searchQuery }
    return {
      ...state,
      searchQuery,
      activeItemIndex: matchIdx,
      activationTrigger: ActivationTrigger.Other,
    }
  },

  /**
   * 清除搜索处理器
   * 重置搜索状态
   */
  [ActionTypes.ClearSearch](state) {
    if (state.searchQuery === '') return state
    return { ...state, searchQuery: '', searchActiveItemIndex: null }
  },

  /**
   * 注册菜单项处理器
   * 添加新的菜单项并保持正确的顺序
   */
  [ActionTypes.RegisterItem]: (state, action) => {
    let adjustedState = adjustOrderedState(state, (items) => [
      ...items,
      { id: action.id, dataRef: action.dataRef },
    ])

    return { ...state, ...adjustedState }
  },

  /**
   * 注销菜单项处理器
   * 移除菜单项并重新调整状态
   */
  [ActionTypes.UnregisterItem]: (state, action) => {
    let adjustedState = adjustOrderedState(state, (items) => {
      let idx = items.findIndex((a) => a.id === action.id)
      if (idx !== -1) items.splice(idx, 1)
      return items
    })

    return {
      ...state,
      ...adjustedState,
      activationTrigger: ActivationTrigger.Other,
    }
  },

  /**
   * 设置按钮元素处理器
   * 更新菜单按钮的DOM引用
   */
  [ActionTypes.SetButtonElement]: (state, action) => {
    if (state.buttonElement === action.element) return state
    return { ...state, buttonElement: action.element }
  },

  /**
   * 设置菜单列表元素处理器
   * 更新菜单列表容器的DOM引用
   */
  [ActionTypes.SetItemsElement]: (state, action) => {
    if (state.itemsElement === action.element) return state
    return { ...state, itemsElement: action.element }
  },
}

/**
 * 菜单Context
 * 提供菜单状态和dispatch函数给所有子组件
 */
let MenuContext = createContext<[StateDefinition, Dispatch<Actions>] | null>(null)
MenuContext.displayName = 'MenuContext'

/**
 * 菜单Context Hook
 * 获取菜单Context,如果不在Menu组件内使用会抛出错误
 */
function useMenuContext(component: string) {
  let context = useContext(MenuContext)
  if (context === null) {
    let err = new Error(`<${component} /> is missing a parent <Menu /> component.`)
    if (Error.captureStackTrace) Error.captureStackTrace(err, useMenuContext)
    throw err
  }
  return context
}

/**
 * 状态归约器
 * 使用match函数将动作分发到对应的处理器
 */
function stateReducer(state: StateDefinition, action: Actions) {
  return match(action.type, reducers, state, action)
}

// ---

let DEFAULT_MENU_TAG = Fragment
type MenuRenderPropArg = {
  open: boolean
  close: () => void
}
type MenuPropsWeControl = never

export type MenuProps<TTag extends ElementType = typeof DEFAULT_MENU_TAG> = Props<
  TTag,
  MenuRenderPropArg,
  MenuPropsWeControl,
  {
    __demoMode?: boolean
  }
>

function MenuFn<TTag extends ElementType = typeof DEFAULT_MENU_TAG>(
  props: MenuProps<TTag>,
  ref: Ref<HTMLElement>
) {
  let { __demoMode = false, ...theirProps } = props
  let reducerBag = useReducer(stateReducer, {
    __demoMode,
    menuState: __demoMode ? MenuStates.Open : MenuStates.Closed,
    buttonElement: null,
    itemsElement: null,
    items: [],
    searchQuery: '',
    activeItemIndex: null,
    activationTrigger: ActivationTrigger.Other,
  } as StateDefinition)
  let [{ menuState, itemsElement, buttonElement }, dispatch] = reducerBag
  let menuRef = useSyncRefs(ref)

  // Handle outside click
  let outsideClickEnabled = menuState === MenuStates.Open
  useOutsideClick(outsideClickEnabled, [buttonElement, itemsElement], (event, target) => {
    dispatch({ type: ActionTypes.CloseMenu })

    if (!isFocusableElement(target, FocusableMode.Loose)) {
      event.preventDefault()
      buttonElement?.focus()
    }
  })

  let close = useEvent(() => {
    dispatch({ type: ActionTypes.CloseMenu })
  })

  let slot = useMemo(
    () => ({ open: menuState === MenuStates.Open, close }) satisfies MenuRenderPropArg,
    [menuState, close]
  )

  let ourProps = { ref: menuRef }

  let render = useRender()

  return (
    <FloatingProvider>
      <MenuContext.Provider value={reducerBag}>
        <OpenClosedProvider
          value={match(menuState, {
            [MenuStates.Open]: State.Open,
            [MenuStates.Closed]: State.Closed,
          })}
        >
          {render({
            ourProps,
            theirProps,
            slot,
            defaultTag: DEFAULT_MENU_TAG,
            name: 'Menu',
          })}
        </OpenClosedProvider>
      </MenuContext.Provider>
    </FloatingProvider>
  )
}

// ---

/**
 * 菜单按钮组件属性定义
 * 
 * 渲染参数包括:
 * - open: 菜单是否打开
 * - active: 按钮是否处于激活状态
 * - hover: 是否悬停
 * - focus: 是否聚焦
 * - disabled: 是否禁用
 * - autofocus: 是否自动聚焦
 */
let DEFAULT_BUTTON_TAG = 'button' as const
type ButtonRenderPropArg = {
  open: boolean
  active: boolean
  hover: boolean
  focus: boolean
  disabled: boolean
  autofocus: boolean
}

// 我们控制的WAI-ARIA属性
type ButtonPropsWeControl = 'aria-controls' | 'aria-expanded' | 'aria-haspopup'

export type MenuButtonProps<TTag extends ElementType = typeof DEFAULT_BUTTON_TAG> = Props<
  TTag,
  ButtonRenderPropArg,
  ButtonPropsWeControl,
  {
    disabled?: boolean
    autoFocus?: boolean
  }
>

/**
 * 菜单按钮组件实现
 * 
 * 核心功能:
 * 1. 状态管理 - 处理按钮的各种状态(hover/focus/active等)
 * 2. 键盘交互 - 实现无障碍的键盘操作
 * 3. WAI-ARIA - 提供完整的ARIA属性支持
 * 4. 事件处理 - 统一管理点击、键盘等事件
 * 
 * @param props - 按钮属性
 * @param ref - 引用转发
 */
function ButtonFn<TTag extends ElementType = typeof DEFAULT_BUTTON_TAG>(
  props: MenuButtonProps<TTag>,
  ref: Ref<HTMLButtonElement>
) {
  // 生成唯一ID并解构属性
  let internalId = useId()
  let {
    id = `headlessui-menu-button-${internalId}`,
    disabled = false,
    autoFocus = false,
    ...theirProps
  } = props

  // 获取菜单上下文
  let [state, dispatch] = useMenuContext('Menu.Button')
  
  // 获取浮动定位相关props
  let getFloatingReferenceProps = useFloatingReferenceProps()

  /**
   * 合并多个refs:
   * 1. 外部传入的ref
   * 2. 浮动定位ref
   * 3. 按钮元素ref(用于更新state)
   */
  let buttonRef = useSyncRefs(
    ref,
    useFloatingReference(),
    useEvent((element) => dispatch({ type: ActionTypes.SetButtonElement, element }))
  )

  /**
   * 键盘按下事件处理
   * 实现WAI-ARIA规范的键盘交互:
   * - Space/Enter: 打开菜单并聚焦第一项
   * - ArrowDown: 打开菜单并聚焦第一项
   * - ArrowUp: 打开菜单并聚焦最后一项
   */
  let handleKeyDown = useEvent((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case Keys.Space:
      case Keys.Enter:
      case Keys.ArrowDown:
        event.preventDefault()
        event.stopPropagation()
        flushSync(() => dispatch({ type: ActionTypes.OpenMenu }))
        dispatch({ type: ActionTypes.GoToItem, focus: Focus.First })
        break
      case Keys.ArrowUp:
        event.preventDefault()
        event.stopPropagation()
        flushSync(() => dispatch({ type: ActionTypes.OpenMenu }))
        dispatch({ type: ActionTypes.GoToItem, focus: Focus.Last })
        break
    }
  })

  /**
   * 键盘抬起事件处理
   * 修复Firefox中Space键的特殊行为
   */
  let handleKeyUp = useEvent((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case Keys.Space:
        // Firefox中preventDefault()对Space的keyUp事件无效
        // 需要额外处理以防止触发click事件
        event.preventDefault()
        break
    }
  })

  /**
   * 点击事件处理
   * - 处理禁用状态
   * - 切换菜单开关状态
   * - 聚焦管理
   */
  let handleClick = useEvent((event: ReactMouseEvent) => {
    if (isDisabledReactIssue7711(event.currentTarget)) return event.preventDefault()
    if (disabled) return

    if (state.menuState === MenuStates.Open) {
      flushSync(() => dispatch({ type: ActionTypes.CloseMenu }))
      state.buttonElement?.focus({ preventScroll: true })
    } else {
      event.preventDefault()
      dispatch({ type: ActionTypes.OpenMenu })
    }
  })

  // 状态hooks
  let { isFocusVisible: focus, focusProps } = useFocusRing({ autoFocus })
  let { isHovered: hover, hoverProps } = useHover({ isDisabled: disabled })
  let { pressed: active, pressProps } = useActivePress({ disabled })

  // 准备传递给子组件的数据
  let slot = useMemo(() => {
    return {
      open: state.menuState === MenuStates.Open,
      active: active || state.menuState === MenuStates.Open,
      disabled,
      hover,
      focus,
      autofocus: autoFocus,
    } satisfies ButtonRenderPropArg
  }, [state, hover, focus, active, disabled, autoFocus])

  // 合并所有props
  let ourProps = mergeProps(
    getFloatingReferenceProps(),
    {
      ref: buttonRef,
      id,
      type: useResolveButtonType(props, state.buttonElement),
      'aria-haspopup': 'menu',
      'aria-controls': state.itemsElement?.id,
      'aria-expanded': state.menuState === MenuStates.Open,
      disabled: disabled || undefined,
      autoFocus,
      onKeyDown: handleKeyDown,
      onKeyUp: handleKeyUp,
      onClick: handleClick,
    },
    focusProps,
    hoverProps,
    pressProps
  )

  // 获取渲染函数并渲染
  let render = useRender()
  return render({
    ourProps,
    theirProps,
    slot,
    defaultTag: DEFAULT_BUTTON_TAG,
    name: 'Menu.Button',
  })
}

// ---

/**
 * 菜单列表组件属性定义
 * 
 * 渲染参数:
 * - open: 菜单是否打开
 * 
 * WAI-ARIA属性:
 * - aria-activedescendant: 当前激活项
 * - aria-labelledby: 菜单标签元素
 * - role: 元素角色
 * - tabIndex: Tab键顺序
 */
let DEFAULT_ITEMS_TAG = 'div' as const
type ItemsRenderPropArg = {
  open: boolean
}
type ItemsPropsWeControl = 'aria-activedescendant' | 'aria-labelledby' | 'role' | 'tabIndex'

// 渲染特性配置
let ItemsRenderFeatures = RenderFeatures.RenderStrategy | RenderFeatures.Static

export type MenuItemsProps<TTag extends ElementType = typeof DEFAULT_ITEMS_TAG> = Props<
  TTag,
  ItemsRenderPropArg,
  ItemsPropsWeControl,
  {
    /**
     * 锚点配置,用于浮动定位
     */
    anchor?: AnchorProps

    /**
     * 是否使用Portal渲染
     * - true: 渲染到body下
     * - false: 渲染在原位置
     */
    portal?: boolean

    /**
     * 是否为模态
     * - true: 启用焦点陷阱和滚动锁定
     * - false: 普通弹出
     */
    modal?: boolean

    /**
     * 是否启用过渡动画
     */
    transition?: boolean

    /**
     * 静态渲染选项
     * - static: 始终渲染DOM
     * - unmount: 关闭时卸载
     */
    static?: boolean
    unmount?: boolean
  }
>

/**
 * 菜单列表组件实现
 * 
 * 核心功能:
 * 1. 容器管理 - 处理列表容器的渲染位置和行为
 * 2. 键盘导航 - 实现方向键、Home/End等导航
 * 3. 搜索功能 - 支持按字符快速定位
 * 4. 焦点管理 - 控制焦点的进出和循环
 * 5. WAI-ARIA - 提供完整的ARIA属性支持
 * 
 * @param props - 组件属性
 * @param ref - 引用转发
 */
function ItemsFn<TTag extends ElementType = typeof DEFAULT_ITEMS_TAG>(
  props: MenuItemsProps<TTag>,
  ref: Ref<HTMLElement>
) {
  // 生成唯一ID并解构属性
  let internalId = useId()
  let {
    id = `headlessui-menu-items-${internalId}`,
    anchor: rawAnchor,
    portal = false,
    modal = true,
    transition = false,
    ...theirProps
  } = props

  // 获取各种上下文和状态
  let anchor = useResolvedAnchor(rawAnchor)
  let [state, dispatch] = useMenuContext('Menu.Items')
  let [floatingRef, style] = useFloatingPanel(anchor)
  let getFloatingPanelProps = useFloatingPanelProps()

  /**
   * 本地状态管理
   * 为了提高过渡动画的准确性,在组件内部单独维护一份元素引用
   * 而不是依赖context中的值
   */
  let [localItemsElement, setLocalItemsElement] = useState<HTMLElement | null>(null)

  /**
   * 合并多个refs:
   * 1. 外部传入的ref 
   * 2. 浮动定位ref(如果启用了anchor)
   * 3. 元素ref(用于更新state)
   * 4. 本地状态ref
   */
  let itemsRef = useSyncRefs(
    ref,
    anchor ? floatingRef : null,
    useEvent((element) => dispatch({ type: ActionTypes.SetItemsElement, element })),
    setLocalItemsElement
  )

  // 获取文档对象
  let portalOwnerDocument = useOwnerDocument(state.buttonElement)
  let ownerDocument = useOwnerDocument(state.itemsElement)

  // 如果启用了锚点,强制使用Portal
  if (anchor) {
    portal = true
  }

  /**
   * 过渡状态管理
   * 根据菜单打开状态和OpenClosed上下文控制可见性
   */
  let usesOpenClosedState = useOpenClosed()
  let [visible, transitionData] = useTransition(
    transition,
    localItemsElement,
    usesOpenClosedState !== null
      ? (usesOpenClosedState & State.Open) === State.Open
      : state.menuState === MenuStates.Open
  )

  /**
   * 监听按钮消失
   * 当触发按钮被隐藏时自动关闭菜单
   */
  useOnDisappear(visible, state.buttonElement, () => {
    dispatch({ type: ActionTypes.CloseMenu })
  })

  /**
   * 滚动锁定
   * 当菜单打开且为模态时,锁定页面滚动
   */
  let scrollLockEnabled = state.__demoMode ? false : modal && state.menuState === MenuStates.Open
  useScrollLock(scrollLockEnabled, ownerDocument)

  /**
   * 其他元素失活
   * 当菜单打开且为模态时,使其他元素失活
   */
  let inertOthersEnabled = state.__demoMode ? false : modal && state.menuState === MenuStates.Open
  useInertOthers(inertOthersEnabled, {
    allowed: useCallback(
      () => [state.buttonElement, state.itemsElement],
      [state.buttonElement, state.itemsElement]
    ),
  })

  /**
   * 按钮移动检测
   * 如果按钮移动了位置,取消过渡动画避免视觉跳动
   */
  let didButtonMoveEnabled = state.menuState !== MenuStates.Open
  let didButtonMove = useDidElementMove(didButtonMoveEnabled, state.buttonElement)
  let panelEnabled = didButtonMove ? false : visible

  /**
   * 自动聚焦
   * 菜单打开时自动聚焦到列表容器
   */
  useEffect(() => {
    let container = state.itemsElement
    if (!container) return
    if (state.menuState !== MenuStates.Open) return
    if (container === ownerDocument?.activeElement) return

    container.focus({ preventScroll: true })
  }, [state.menuState, state.itemsElement, ownerDocument])

  /**
   * 元素角色设置
   * 为菜单项之外的元素设置none角色
   */
  useTreeWalker(state.menuState === MenuStates.Open, {
    container: state.itemsElement,
    accept(node) {
      if (node.getAttribute('role') === 'menuitem') return NodeFilter.FILTER_REJECT
      if (node.hasAttribute('role')) return NodeFilter.FILTER_SKIP
      return NodeFilter.FILTER_ACCEPT
    },
    walk(node) {
      node.setAttribute('role', 'none')
    },
  })

  // 用于处理搜索的清理器
  let searchDisposables = useDisposables()

  /**
   * 键盘事件处理
   * 实现WAI-ARIA规范的键盘交互:
   * - Space/Enter: 点击当前项
   * - 方向键: 在项目间导航
   * - Home/End: 跳到首尾项
   * - 字符键: 搜索匹配项
   * - Escape: 关闭菜单
   * - Tab: 关闭菜单并移动焦点
   */
  let handleKeyDown = useEvent((event: ReactKeyboardEvent<HTMLElement>) => {
    searchDisposables.dispose()

    switch (event.key) {
      case Keys.Space:
        if (state.searchQuery !== '') {
          event.preventDefault()
          event.stopPropagation()
          return dispatch({ type: ActionTypes.Search, value: event.key })
        }
        // 搜索模式下继续往下

      case Keys.Enter:
        event.preventDefault()
        event.stopPropagation()
        dispatch({ type: ActionTypes.CloseMenu })
        if (state.activeItemIndex !== null) {
          let { dataRef } = state.items[state.activeItemIndex]
          dataRef.current?.domRef.current?.click()
        }
        restoreFocusIfNecessary(state.buttonElement)
        break

      case Keys.ArrowDown:
        event.preventDefault()
        event.stopPropagation()
        return dispatch({ type: ActionTypes.GoToItem, focus: Focus.Next })

      case Keys.ArrowUp:
        event.preventDefault()
        event.stopPropagation()
        return dispatch({ type: ActionTypes.GoToItem, focus: Focus.Previous })

      case Keys.Home:
      case Keys.PageUp:
        event.preventDefault()
        event.stopPropagation()
        return dispatch({ type: ActionTypes.GoToItem, focus: Focus.First })

      case Keys.End:
      case Keys.PageDown:
        event.preventDefault()
        event.stopPropagation()
        return dispatch({ type: ActionTypes.GoToItem, focus: Focus.Last })

      case Keys.Escape:
        event.preventDefault()
        event.stopPropagation()
        flushSync(() => dispatch({ type: ActionTypes.CloseMenu }))
        state.buttonElement?.focus({ preventScroll: true })
        break

      case Keys.Tab:
        event.preventDefault()
        event.stopPropagation()
        flushSync(() => dispatch({ type: ActionTypes.CloseMenu }))
        focusFrom(
          state.buttonElement!,
          event.shiftKey ? FocusManagementFocus.Previous : FocusManagementFocus.Next
        )
        break

      default:
        if (event.key.length === 1) {
          dispatch({ type: ActionTypes.Search, value: event.key })
          searchDisposables.setTimeout(() => dispatch({ type: ActionTypes.ClearSearch }), 350)
        }
        break
    }
  })

  /**
   * 空格键抬起事件处理
   * 修复Firefox的特殊行为
   */
  let handleKeyUp = useEvent((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case Keys.Space:
        // Firefox中preventDefault()对Space的keyUp事件无效
        // 需要额外处理以防止触发click事件
        event.preventDefault()
        break
    }
  })

  // 准备传递给子组件的数据
  let slot = useMemo(() => {
    return {
      open: state.menuState === MenuStates.Open,
    } satisfies ItemsRenderPropArg
  }, [state.menuState])

  // 合并所有props
  let ourProps = mergeProps(anchor ? getFloatingPanelProps() : {}, {
    'aria-activedescendant':
      state.activeItemIndex === null ? undefined : state.items[state.activeItemIndex]?.id,
    'aria-labelledby': state.buttonElement?.id,
    id,
    onKeyDown: handleKeyDown,
    onKeyUp: handleKeyUp,
    role: 'menu',
    // 菜单关闭时不可聚焦,这样可以在打开的菜单上按Tab时
    // 跳过菜单列表直接聚焦到下一个可聚焦元素
    tabIndex: state.menuState === MenuStates.Open ? 0 : undefined,
    ref: itemsRef,
    style: {
      ...theirProps.style,
      ...style,
      '--button-width': useElementSize(state.buttonElement, true).width,
    } as CSSProperties,
    ...transitionDataAttributes(transitionData),
  })

  // 获取渲染函数
  let render = useRender()

  /**
   * 渲染结构:
   * 1. Portal - 可选的传送门
   * 2. 实际的菜单列表
   */
  return (
    <Portal enabled={portal ? props.static || visible : false} ownerDocument={portalOwnerDocument}>
      {render({
        ourProps,
        theirProps,
        slot,
        defaultTag: DEFAULT_ITEMS_TAG,
        features: ItemsRenderFeatures,
        visible: panelEnabled,
        name: 'Menu.Items',
      })}
    </Portal>
  )
}

// ---

/**
 * 菜单项组件属性定义
 * 
 * 渲染参数:
 * - active: (已弃用)使用focus代替
 * - focus: 是否获得焦点
 * - disabled: 是否禁用
 * - close: 关闭菜单的函数
 */
let DEFAULT_ITEM_TAG = Fragment
type ItemRenderPropArg = {
  /** @deprecated use `focus` instead */
  active: boolean
  focus: boolean
  disabled: boolean
  close: () => void
}

// WAI-ARIA属性
type ItemPropsWeControl =
  | 'aria-describedby'
  | 'aria-disabled'
  | 'aria-labelledby'
  | 'role'
  | 'tabIndex'

export type MenuItemProps<TTag extends ElementType = typeof DEFAULT_ITEM_TAG> = Props<
  TTag,
  ItemRenderPropArg,
  ItemPropsWeControl,
  {
    disabled?: boolean
  }
>

/**
 * 菜单项组件实现
 * 
 * 核心功能:
 * 1. 状态管理 - 处理激活、禁用等状态
 * 2. 无障碍支持 - WAI-ARIA角色和属性
 * 3. 事件处理 - 鼠标和键盘交互
 * 4. 自动滚动 - 保持焦点项在视图内
 * 
 * @param props - 菜单项属性
 * @param ref - 引用转发
 */
function ItemFn<TTag extends ElementType = typeof DEFAULT_ITEM_TAG>(
  props: MenuItemProps<TTag>,
  ref: Ref<HTMLElement>
) {
  // 生成唯一ID并解构属性
  let internalId = useId()
  let { id = `headlessui-menu-item-${internalId}`, disabled = false, ...theirProps } = props

  // 获取菜单上下文和当前激活状态
  let [state, dispatch] = useMenuContext('Menu.Item')
  let active = state.activeItemIndex !== null ? state.items[state.activeItemIndex].id === id : false

  // 内部引用管理
  let internalItemRef = useRef<HTMLElement | null>(null)
  let itemRef = useSyncRefs(ref, internalItemRef)

  /**
   * 自动滚动处理
   * 当项目被键盘激活时,确保其滚动到可视区域
   */
  useIsoMorphicEffect(() => {
    if (state.__demoMode) return
    if (state.menuState !== MenuStates.Open) return
    if (!active) return
    if (state.activationTrigger === ActivationTrigger.Pointer) return
    
    return disposables().requestAnimationFrame(() => {
      internalItemRef.current?.scrollIntoView?.({ block: 'nearest' })
    })
  }, [
    state.__demoMode,
    internalItemRef,
    active,
    state.menuState,
    state.activationTrigger,
    /* 当激活项位置改变时重新触发scrollIntoView */ 
    state.activeItemIndex,
  ])

  // 获取文本值(用于搜索)
  let getTextValue = useTextValue(internalItemRef)

  /**
   * 项目数据包
   * 存储供父组件使用的项目数据
   */
  let bag = useRef<MenuItemDataRef['current']>({
    disabled,
    domRef: internalItemRef,
    get textValue() {
      return getTextValue()
    },
  })

  // 同步禁用状态
  useIsoMorphicEffect(() => {
    bag.current.disabled = disabled
  }, [bag, disabled])

  /**
   * 项目注册
   * 在挂载时注册项目,卸载时注销
   */
  useIsoMorphicEffect(() => {
    dispatch({ type: ActionTypes.RegisterItem, id, dataRef: bag })
    return () => dispatch({ type: ActionTypes.UnregisterItem, id })
  }, [bag, id])

  // 关闭菜单的事件处理器
  let close = useEvent(() => {
    dispatch({ type: ActionTypes.CloseMenu })
  })

  /**
   * 点击事件处理
   * - 处理禁用状态
   * - 关闭菜单
   * - 恢复焦点
   */
  let handleClick = useEvent((event: MouseEvent) => {
    if (disabled) return event.preventDefault()
    dispatch({ type: ActionTypes.CloseMenu })
    restoreFocusIfNecessary(state.buttonElement)
  })

  /**
   * 焦点事件处理
   * 根据禁用状态决定是否激活项目
   */
  let handleFocus = useEvent(() => {
    if (disabled) return dispatch({ type: ActionTypes.GoToItem, focus: Focus.Nothing })
    dispatch({ type: ActionTypes.GoToItem, focus: Focus.Specific, id })
  })

  // 指针追踪器
  let pointer = useTrackedPointer()

  /**
   * 鼠标进入事件处理
   * 处理项目的指针激活
   */
  let handleEnter = useEvent((evt) => {
    pointer.update(evt)
    if (disabled) return
    if (active) return
    dispatch({
      type: ActionTypes.GoToItem,
      focus: Focus.Specific,
      id,
      trigger: ActivationTrigger.Pointer,
    })
  })

  /**
   * 鼠标移动事件处理
   * 仅在指针确实移动时才更新激活状态
   */
  let handleMove = useEvent((evt) => {
    if (!pointer.wasMoved(evt)) return
    if (disabled) return
    if (active) return
    dispatch({
      type: ActionTypes.GoToItem,
      focus: Focus.Specific,
      id,
      trigger: ActivationTrigger.Pointer,
    })
  })

  /**
   * 鼠标离开事件处理
   * 清除指针激活的项目
   */
  let handleLeave = useEvent((evt) => {
    if (!pointer.wasMoved(evt)) return
    if (disabled) return
    if (!active) return
    dispatch({ type: ActionTypes.GoToItem, focus: Focus.Nothing })
  })

  // 处理WAI-ARIA标签和描述
  let [labelledby, LabelProvider] = useLabels()
  let [describedby, DescriptionProvider] = useDescriptions()

  // 准备传递给子组件的数据
  let slot = useMemo(
    () => ({ active, focus: active, disabled, close }) satisfies ItemRenderPropArg,
    [active, disabled, close]
  )

  // 合并所有props
  let ourProps = {
    id,
    ref: itemRef,
    role: 'menuitem',
    tabIndex: disabled === true ? undefined : -1,
    'aria-disabled': disabled === true ? true : undefined,
    'aria-labelledby': labelledby,
    'aria-describedby': describedby,
    disabled: undefined, // 永远不转发disabled属性
    onClick: handleClick,
    onFocus: handleFocus,
    onPointerEnter: handleEnter,
    onMouseEnter: handleEnter,
    onPointerMove: handleMove,
    onMouseMove: handleMove,
    onPointerLeave: handleLeave,
    onMouseLeave: handleLeave,
  }

  // 获取渲染函数
  let render = useRender()

  /**
   * 渲染结构:
   * 1. LabelProvider - 提供标签上下文
   * 2. DescriptionProvider - 提供描述上下文
   * 3. 实际的菜单项内容
   */
  return (
    <LabelProvider>
      <DescriptionProvider>
        {render({
          ourProps,
          theirProps,
          slot,
          defaultTag: DEFAULT_ITEM_TAG,
          name: 'Menu.Item',
        })}
      </DescriptionProvider>
    </LabelProvider>
  )
}

// ---

/**
 * 菜单分组组件属性定义
 * 
 * WAI-ARIA属性:
 * - role: 组的角色
 * - aria-labelledby: 组标签元素
 */
let DEFAULT_SECTION_TAG = 'div' as const
type SectionRenderPropArg = {}
type SectionPropsWeControl = 'role' | 'aria-labelledby'

export type MenuSectionProps<TTag extends ElementType = typeof DEFAULT_SECTION_TAG> = Props<
  TTag,
  SectionRenderPropArg,
  SectionPropsWeControl
>

/**
 * 菜单分组组件实现
 * 用于将相关的菜单项分组展示
 * 
 * 核心功能:
 * 1. 语义化分组 - 使用group角色
 * 2. WAI-ARIA支持 - 提供标签关联
 * 
 * @param props - 组件属性
 * @param ref - 引用转发
 */
function SectionFn<TTag extends ElementType = typeof DEFAULT_SECTION_TAG>(
  props: MenuSectionProps<TTag>,
  ref: Ref<HTMLElement>
) {
  // 获取标签上下文
  let [labelledby, LabelProvider] = useLabels()

  // 合并props
  let theirProps = props
  let ourProps = { ref, 'aria-labelledby': labelledby, role: 'group' }

  // 获取渲染函数
  let render = useRender()

  // 渲染分组
  return (
    <LabelProvider>
      {render({
        ourProps,
        theirProps,
        slot: {},
        defaultTag: DEFAULT_SECTION_TAG,
        name: 'Menu.Section',
      })}
    </LabelProvider>
  )
}

/**
 * 菜单分组标题组件属性定义
 * 
 * WAI-ARIA属性:
 * - role: presentation(纯展示用途)
 */
let DEFAULT_HEADING_TAG = 'header' as const
type HeadingRenderPropArg = {}
type HeadingPropsWeControl = 'role'

export type MenuHeadingProps<TTag extends ElementType = typeof DEFAULT_HEADING_TAG> = Props<
  TTag,
  HeadingRenderPropArg,
  HeadingPropsWeControl
>

/**
 * 菜单分组标题组件实现
 * 用于为菜单分组提供标题
 * 
 * 核心功能:
 * 1. 自动ID - 生成唯一标识
 * 2. 标签注册 - 与分组关联
 * 3. 语义化 - 使用presentation角色
 * 
 * @param props - 组件属性
 * @param ref - 引用转发
 */
function HeadingFn<TTag extends ElementType = typeof DEFAULT_HEADING_TAG>(
  props: MenuHeadingProps<TTag>,
  ref: Ref<HTMLElement>
) {
  // 生成唯一ID
  let internalId = useId()
  let { id = `headlessui-menu-heading-${internalId}`, ...theirProps } = props

  // 获取标签上下文并注册
  let context = useLabelContext()
  useIsoMorphicEffect(() => context.register(id), [id, context.register])

  // 合并props
  let ourProps = { id, ref, role: 'presentation', ...context.props }

  // 获取渲染函数
  let render = useRender()

  // 渲染标题
  return render({
    ourProps,
    theirProps,
    slot: {},
    defaultTag: DEFAULT_HEADING_TAG,
    name: 'Menu.Heading',
  })
}

/**
 * 菜单分隔线组件属性定义
 * 
 * WAI-ARIA属性:
 * - role: separator(分隔线角色)
 */
let DEFAULT_SEPARATOR_TAG = 'div' as const
type SeparatorRenderPropArg = {}
type SeparatorPropsWeControl = 'role'

export type MenuSeparatorProps<TTag extends ElementType = typeof DEFAULT_SEPARATOR_TAG> = Props<
  TTag,
  SeparatorRenderPropArg,
  SeparatorPropsWeControl
>

/**
 * 菜单分隔线组件实现
 * 用于分隔不同的菜单项或分组
 * 
 * 核心功能:
 * 1. 语义化 - 使用separator角色
 * 2. 无状态 - 纯展示组件
 * 
 * @param props - 组件属性
 * @param ref - 引用转发
 */
function SeparatorFn<TTag extends ElementType = typeof DEFAULT_SEPARATOR_TAG>(
  props: MenuSeparatorProps<TTag>,
  ref: Ref<HTMLElement>
) {
  // 合并props
  let theirProps = props
  let ourProps = { ref, role: 'separator' }

  // 获取渲染函数
  let render = useRender()

  // 渲染分隔线
  return render({
    ourProps,
    theirProps,
    slot: {},
    defaultTag: DEFAULT_SEPARATOR_TAG,
    name: 'Menu.Separator',
  })
}

// ---

export interface _internal_ComponentMenu extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_MENU_TAG>(
    props: MenuProps<TTag> & RefProp<typeof MenuFn>
  ): React.JSX.Element
}

export interface _internal_ComponentMenuButton extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_BUTTON_TAG>(
    props: MenuButtonProps<TTag> & RefProp<typeof ButtonFn>
  ): React.JSX.Element
}

export interface _internal_ComponentMenuItems extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_ITEMS_TAG>(
    props: MenuItemsProps<TTag> & RefProp<typeof ItemsFn>
  ): React.JSX.Element
}

export interface _internal_ComponentMenuItem extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_ITEM_TAG>(
    props: MenuItemProps<TTag> & RefProp<typeof ItemFn>
  ): React.JSX.Element
}

export interface _internal_ComponentMenuSection extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_SECTION_TAG>(
    props: MenuSectionProps<TTag> & RefProp<typeof SectionFn>
  ): React.JSX.Element
}

export interface _internal_ComponentMenuHeading extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_HEADING_TAG>(
    props: MenuHeadingProps<TTag> & RefProp<typeof HeadingFn>
  ): React.JSX.Element
}

export interface _internal_ComponentMenuSeparator extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_SEPARATOR_TAG>(
    props: MenuSeparatorProps<TTag> & RefProp<typeof SeparatorFn>
  ): React.JSX.Element
}

// --

let MenuRoot = forwardRefWithAs(MenuFn) as _internal_ComponentMenu
export let MenuButton = forwardRefWithAs(ButtonFn) as _internal_ComponentMenuButton
export let MenuItems = forwardRefWithAs(ItemsFn) as _internal_ComponentMenuItems
export let MenuItem = forwardRefWithAs(ItemFn) as _internal_ComponentMenuItem
export let MenuSection = forwardRefWithAs(SectionFn) as _internal_ComponentMenuSection
export let MenuHeading = forwardRefWithAs(HeadingFn) as _internal_ComponentMenuHeading
export let MenuSeparator = forwardRefWithAs(SeparatorFn) as _internal_ComponentMenuSeparator

export let Menu = Object.assign(MenuRoot, {
  /** @deprecated use `<MenuButton>` instead of `<Menu.Button>` */
  Button: MenuButton,
  /** @deprecated use `<MenuItems>` instead of `<Menu.Items>` */
  Items: MenuItems,
  /** @deprecated use `<MenuItem>` instead of `<Menu.Item>` */
  Item: MenuItem,
  /** @deprecated use `<MenuSection>` instead of `<Menu.Section>` */
  Section: MenuSection,
  /** @deprecated use `<MenuHeading>` instead of `<Menu.Heading>` */
  Heading: MenuHeading,
  /** @deprecated use `<MenuSeparator>` instead of `<Menu.Separator>` */
  Separator: MenuSeparator,
})
