/**
 * Tabs组件 - HeadlessUI中的标签页组件
 * 
 * 实现了WAI-ARIA Tabs模式，提供完全无样式的可访问性标签页功能。
 * 支持键盘导航、自动激活、手动激活等特性。
 */

'use client'

import { useFocusRing } from '@react-aria/focus'
import { useHover } from '@react-aria/interactions'
import React, {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ElementType,
  type MutableRefObject,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type Ref,
} from 'react'
import { useActivePress } from '../../hooks/use-active-press'
import { useEvent } from '../../hooks/use-event'
import { useId } from '../../hooks/use-id'
import { useIsoMorphicEffect } from '../../hooks/use-iso-morphic-effect'
import { useLatestValue } from '../../hooks/use-latest-value'
import { useResolveButtonType } from '../../hooks/use-resolve-button-type'
import { useSyncRefs } from '../../hooks/use-sync-refs'
import { FocusSentinel } from '../../internal/focus-sentinel'
import { Hidden } from '../../internal/hidden'
import type { Props } from '../../types'
import { Focus, FocusResult, focusIn, sortByDomNode } from '../../utils/focus-management'
import { match } from '../../utils/match'
import { microTask } from '../../utils/micro-task'
import { getOwnerDocument } from '../../utils/owner'
import {
  RenderFeatures,
  forwardRefWithAs,
  mergeProps,
  useRender,
  type HasDisplayName,
  type PropsForFeatures,
  type RefProp,
} from '../../utils/render'
import { StableCollection, useStableCollectionIndex } from '../../utils/stable-collection'
import { Keys } from '../keyboard'

enum Direction {
  Forwards,
  Backwards,
}

enum Ordering {
  Less = -1,
  Equal = 0,
  Greater = 1,
}

/**
 * 标签页状态定义
 * 包含标签页系统所需的所有状态数据:
 * - selectedIndex: 当前选中的标签索引
 * - tabs: 所有标签元素
 * - panels: 所有面板元素
 */
interface StateDefinition {
  info: MutableRefObject<{ isControlled: boolean }>
  selectedIndex: number

  tabs: MutableRefObject<HTMLElement | null>[]
  panels: MutableRefObject<HTMLElement | null>[]
}

/**
 * 动作类型枚举
 * 定义所有可能的状态更新动作:
 * - SetSelectedIndex: 设置当前选中标签
 * - RegisterTab/UnregisterTab: 标签注册管理
 * - RegisterPanel/UnregisterPanel: 面板注册管理
 */
enum ActionTypes {
  SetSelectedIndex,

  RegisterTab,
  UnregisterTab,

  RegisterPanel,
  UnregisterPanel,
}

/**
 * 动作类型联合
 * 定义每个动作类型的具体数据结构
 */
type Actions =
  | { type: ActionTypes.SetSelectedIndex; index: number }
  | { type: ActionTypes.RegisterTab; tab: MutableRefObject<HTMLElement | null> }
  | { type: ActionTypes.UnregisterTab; tab: MutableRefObject<HTMLElement | null> }
  | { type: ActionTypes.RegisterPanel; panel: MutableRefObject<HTMLElement | null> }
  | { type: ActionTypes.UnregisterPanel; panel: MutableRefObject<HTMLElement | null> }

/**
 * 状态处理器集合
 * 包含所有动作类型对应的处理逻辑
 */
let reducers: {
  [P in ActionTypes]: (
    state: StateDefinition,
    action: Extract<Actions, { type: P }>
  ) => StateDefinition
} = {
  [ActionTypes.SetSelectedIndex](state, action) {
    let tabs = sortByDomNode(state.tabs, (tab) => tab.current)
    let panels = sortByDomNode(state.panels, (panel) => panel.current)

    let focusableTabs = tabs.filter((tab) => !tab.current?.hasAttribute('disabled'))

    let nextState = { ...state, tabs, panels }

    if (
      // Underflow
      action.index < 0 ||
      // Overflow
      action.index > tabs.length - 1
    ) {
      let direction = match(Math.sign(action.index - state.selectedIndex), {
        [Ordering.Less]: () => Direction.Backwards,
        [Ordering.Equal]: () => {
          return match(Math.sign(action.index), {
            [Ordering.Less]: () => Direction.Forwards,
            [Ordering.Equal]: () => Direction.Forwards,
            [Ordering.Greater]: () => Direction.Backwards,
          })
        },
        [Ordering.Greater]: () => Direction.Forwards,
      })

      // If there are no focusable tabs then.
      // We won't change the selected index
      // because it's likely the user is
      // lazy loading tabs and there's
      // nothing to focus on yet
      if (focusableTabs.length === 0) {
        return nextState
      }

      let nextSelectedIndex = match(direction, {
        [Direction.Forwards]: () => tabs.indexOf(focusableTabs[0]),
        [Direction.Backwards]: () => tabs.indexOf(focusableTabs[focusableTabs.length - 1]),
      })

      return {
        ...nextState,
        selectedIndex: nextSelectedIndex === -1 ? state.selectedIndex : nextSelectedIndex,
      }
    }

    // Middle
    let before = tabs.slice(0, action.index)
    let after = tabs.slice(action.index)

    let next = [...after, ...before].find((tab) => focusableTabs.includes(tab))
    if (!next) return nextState

    let selectedIndex = tabs.indexOf(next) ?? state.selectedIndex
    if (selectedIndex === -1) selectedIndex = state.selectedIndex

    return { ...nextState, selectedIndex }
  },
  [ActionTypes.RegisterTab](state, action) {
    if (state.tabs.includes(action.tab)) return state
    let activeTab = state.tabs[state.selectedIndex]

    let adjustedTabs = sortByDomNode([...state.tabs, action.tab], (tab) => tab.current)
    let selectedIndex = state.selectedIndex

    // When the component is uncontrolled, then we want to maintain the actively
    // selected tab even if new tabs are inserted or removed before the active
    // tab.
    //
    // When the component is controlled, then we don't want to do this and
    // instead we want to select the tab based on the `selectedIndex` prop.
    if (!state.info.current.isControlled) {
      selectedIndex = adjustedTabs.indexOf(activeTab)
      if (selectedIndex === -1) selectedIndex = state.selectedIndex
    }

    return { ...state, tabs: adjustedTabs, selectedIndex }
  },
  [ActionTypes.UnregisterTab](state, action) {
    return { ...state, tabs: state.tabs.filter((tab) => tab !== action.tab) }
  },
  [ActionTypes.RegisterPanel](state, action) {
    if (state.panels.includes(action.panel)) return state
    return {
      ...state,
      panels: sortByDomNode([...state.panels, action.panel], (panel) => panel.current),
    }
  },
  [ActionTypes.UnregisterPanel](state, action) {
    return { ...state, panels: state.panels.filter((panel) => panel !== action.panel) }
  },
}

/**
 * Tabs数据上下文
 * 提供标签页状态和配置给所有子组件:
 * - selectedIndex: 当前选中标签索引
 * - tabs/panels: 标签和面板元素引用
 * - orientation: 标签方向(水平/垂直)
 * - activation: 激活模式(自动/手动)
 */
let TabsDataContext = createContext<
  | ({
      orientation: 'horizontal' | 'vertical'
      activation: 'auto' | 'manual'
    } & StateDefinition)
  | null
>(null)
TabsDataContext.displayName = 'TabsDataContext'

/**
 * Tabs数据Hook
 * 获取标签页上下文数据,如果不在Tabs组件内使用会抛出错误
 */
function useData(component: string) {
  let context = useContext(TabsDataContext)
  if (context === null) {
    let err = new Error(`<${component} /> is missing a parent <Tab.Group /> component.`)
    if (Error.captureStackTrace) Error.captureStackTrace(err, useData)
    throw err
  }
  return context
}
type _Data = ReturnType<typeof useData>

/**
 * Tabs动作上下文
 * 提供标签页的动作函数给所有子组件:
 * - registerTab/unregisterTab: 标签注册管理
 * - registerPanel/unregisterPanel: 面板注册管理
 * - change: 切换选中标签
 */
let TabsActionsContext = createContext<{
  registerTab(tab: MutableRefObject<HTMLElement | null>): () => void
  registerPanel(panel: MutableRefObject<HTMLElement | null>): () => void
  change(index: number): void
} | null>(null)
TabsActionsContext.displayName = 'TabsActionsContext'

/**
 * Tabs动作Hook
 * 获取标签页动作函数,如果不在Tabs组件内使用会抛出错误
 */
function useActions(component: string) {
  let context = useContext(TabsActionsContext)
  if (context === null) {
    let err = new Error(`<${component} /> is missing a parent <Tab.Group /> component.`)
    if (Error.captureStackTrace) Error.captureStackTrace(err, useActions)
    throw err
  }
  return context
}
type _Actions = ReturnType<typeof useActions>

/**
 * 状态归约器
 * 使用match函数将动作分发到对应的处理器
 */
function stateReducer(state: StateDefinition, action: Actions) {
  return match(action.type, reducers, state, action)
}

// ---

let DEFAULT_TABS_TAG = 'div' as const
type TabsRenderPropArg = {
  selectedIndex: number
}
type TabsPropsWeControl = never

/**
 * TabGroup组件属性
 * 
 * @property defaultIndex - 默认选中标签的索引，默认为0
 * @property onChange - 选中标签变化时的回调函数
 * @property selectedIndex - 受控模式下的当前选中标签索引
 * @property vertical - 是否垂直布局，默认为false
 * @property manual - 是否手动激活模式，默认为false(自动激活)
 */
export type TabGroupProps<TTag extends ElementType = typeof DEFAULT_TABS_TAG> = Props<
  TTag,
  TabsRenderPropArg,
  TabsPropsWeControl,
  {
    defaultIndex?: number
    onChange?: (index: number) => void
    selectedIndex?: number
    vertical?: boolean
    manual?: boolean
  }
>

/**
 * TabGroup组件实现
 * 作为整个标签页系统的根组件，负责:
 * 1. 状态管理 - 通过useReducer管理标签页状态
 * 2. 上下文提供 - 提供数据和动作上下文给子组件
 * 3. 键盘导航 - 处理方向键导航
 * 4. 焦点管理 - 使用FocusSentinel确保正确的焦点行为
 * 
 * @param props - 组件属性
 * @param ref - 根元素引用
 */
function GroupFn<TTag extends ElementType = typeof DEFAULT_TABS_TAG>(
  props: TabGroupProps<TTag>,
  ref: Ref<HTMLElement>
) {
  let {
    defaultIndex = 0,
    vertical = false,
    manual = false,
    onChange,
    selectedIndex = null,
    ...theirProps
  } = props
  
  // 确定标签页方向和激活模式
  const orientation = vertical ? 'vertical' : 'horizontal'
  const activation = manual ? 'manual' : 'auto'

  // 组件是否受控
  let isControlled = selectedIndex !== null
  let info = useLatestValue({ isControlled })

  // 同步引用
  let tabsRef = useSyncRefs(ref)
  
  // 初始化状态管理
  let [state, dispatch] = useReducer(stateReducer, {
    info,
    selectedIndex: selectedIndex ?? defaultIndex,
    tabs: [],
    panels: [],
  })
  
  // 计算渲染属性
  let slot = useMemo(
    () => ({ selectedIndex: state.selectedIndex }) satisfies TabsRenderPropArg,
    [state.selectedIndex]
  )
  
  // 保存最新的回调和标签引用
  let onChangeRef = useLatestValue(onChange || (() => {}))
  let stableTabsRef = useLatestValue(state.tabs)

  // 组装标签页数据
  let tabsData = useMemo<_Data>(
    () => ({ orientation, activation, ...state }),
    [orientation, activation, state]
  )

  // 标签注册处理函数
  let registerTab = useEvent((tab) => {
    dispatch({ type: ActionTypes.RegisterTab, tab })
    return () => dispatch({ type: ActionTypes.UnregisterTab, tab })
  })

  // 面板注册处理函数
  let registerPanel = useEvent((panel) => {
    dispatch({ type: ActionTypes.RegisterPanel, panel })
    return () => dispatch({ type: ActionTypes.UnregisterPanel, panel })
  })

  // 选中标签变更处理函数
  let change = useEvent((index: number) => {
    if (realSelectedIndex.current !== index) {
      onChangeRef.current(index)
    }

    if (!isControlled) {
      dispatch({ type: ActionTypes.SetSelectedIndex, index })
    }
  })

  // 跟踪实际选中的索引
  let realSelectedIndex = useLatestValue(isControlled ? props.selectedIndex : state.selectedIndex)
  
  // 组装标签页动作
  let tabsActions = useMemo<_Actions>(() => ({ registerTab, registerPanel, change }), [])

  // 处理受控组件的selectedIndex更新
  useIsoMorphicEffect(() => {
    dispatch({ type: ActionTypes.SetSelectedIndex, index: selectedIndex ?? defaultIndex })
  }, [selectedIndex /* 故意跳过defaultIndex */])

  // 处理标签DOM顺序变化
  useIsoMorphicEffect(() => {
    if (realSelectedIndex.current === undefined) return
    if (state.tabs.length <= 0) return

    let sorted = sortByDomNode(state.tabs, (tab) => tab.current)
    let didOrderChange = sorted.some((tab, i) => state.tabs[i] !== tab)

    if (didOrderChange) {
      change(sorted.indexOf(state.tabs[realSelectedIndex.current]))
    }
  })

  let ourProps = { ref: tabsRef }
  let render = useRender()

  return (
    <StableCollection>
      <TabsActionsContext.Provider value={tabsActions}>
        <TabsDataContext.Provider value={tabsData}>
          {/* 当没有标签时添加焦点哨兵 */}
          {tabsData.tabs.length <= 0 && (
            <FocusSentinel
              onFocus={() => {
                for (let tab of stableTabsRef.current) {
                  if (tab.current?.tabIndex === 0) {
                    tab.current?.focus()
                    return true
                  }
                }
                return false
              }}
            />
          )}
          {render({
            ourProps,
            theirProps,
            slot,
            defaultTag: DEFAULT_TABS_TAG,
            name: 'Tabs',
          })}
        </TabsDataContext.Provider>
      </TabsActionsContext.Provider>
    </StableCollection>
  )
}

// ---

let DEFAULT_LIST_TAG = 'div' as const
type ListRenderPropArg = {
  selectedIndex: number
}
type ListPropsWeControl = 'aria-orientation' | 'role'

/**
 * TabList组件属性
 * 用于包装标签按钮的列表容器
 * 
 * @property selectedIndex - 当前选中的标签索引
 */
export type TabListProps<TTag extends ElementType = typeof DEFAULT_LIST_TAG> = Props<
  TTag,
  ListRenderPropArg,
  ListPropsWeControl,
  {
    //
  }
>

/**
 * TabList组件实现
 * 作为标签按钮的列表容器，提供WAI-ARIA标准的tablist角色
 * 
 * 核心功能：
 * 1. WAI-ARIA支持 - 提供正确的role和aria属性
 * 2. 方向支持 - 根据orientation属性正确设置aria-orientation
 * 
 * @param props - 组件属性
 * @param ref - 元素引用
 */
function ListFn<TTag extends ElementType = typeof DEFAULT_LIST_TAG>(
  props: TabListProps<TTag>,
  ref: Ref<HTMLElement>
) {
  let { orientation, selectedIndex } = useData('Tab.List')
  let listRef = useSyncRefs(ref)

  let slot = useMemo(() => ({ selectedIndex }) satisfies ListRenderPropArg, [selectedIndex])

  let theirProps = props
  let ourProps = {
    ref: listRef,
    role: 'tablist',
    'aria-orientation': orientation,
  }

  let render = useRender()

  return render({
    ourProps,
    theirProps,
    slot,
    defaultTag: DEFAULT_LIST_TAG,
    name: 'Tabs.List',
  })
}

// ---

let DEFAULT_TAB_TAG = 'button' as const
type TabRenderPropArg = {
  hover: boolean
  focus: boolean
  active: boolean
  autofocus: boolean
  selected: boolean
  disabled: boolean
}
type TabPropsWeControl = 'aria-controls' | 'aria-selected' | 'role' | 'tabIndex'

/**
 * Tab组件属性
 * 单个标签按钮的属性定义
 * 
 * @property autoFocus - 是否自动获取焦点
 * @property disabled - 是否禁用
 */
export type TabProps<TTag extends ElementType = typeof DEFAULT_TAB_TAG> = Props<
  TTag,
  TabRenderPropArg,
  TabPropsWeControl,
  {
    autoFocus?: boolean
    disabled?: boolean
  }
>

/**
 * Tab组件实现
 * 标签页中的单个标签按钮，负责：
 * 1. 状态管理 - 处理选中、悬停、焦点等状态
 * 2. 键盘导航 - 实现标准的键盘操作
 * 3. WAI-ARIA支持 - 提供完整的可访问性支持
 * 
 * 键盘支持：
 * - Space/Enter: 选中标签
 * - Left/Right: 水平模式下的导航
 * - Up/Down: 垂直模式下的导航
 * - Home/PageUp: 跳转到第一个标签
 * - End/PageDown: 跳转到最后一个标签
 * 
 * @param props - 组件属性
 * @param ref - 元素引用
 */
function TabFn<TTag extends ElementType = typeof DEFAULT_TAB_TAG>(
  props: TabProps<TTag>,
  ref: Ref<HTMLElement>
) {
  let internalId = useId()
  let {
    id = `headlessui-tabs-tab-${internalId}`,
    disabled = false,
    autoFocus = false,
    ...theirProps
  } = props

  let { orientation, activation, selectedIndex, tabs, panels } = useData('Tab')
  let actions = useActions('Tab')
  let data = useData('Tab')

  // 状态和引用管理
  let [tabElement, setTabElement] = useState<HTMLElement | null>(null)
  let internalTabRef = useRef<HTMLElement | null>(null)
  let tabRef = useSyncRefs(internalTabRef, ref, setTabElement)

  // 注册标签到上下文
  useIsoMorphicEffect(() => actions.registerTab(internalTabRef), [actions, internalTabRef])

  // 确定标签索引和选中状态
  let mySSRIndex = useStableCollectionIndex('tabs')
  let myIndex = tabs.indexOf(internalTabRef)
  if (myIndex === -1) myIndex = mySSRIndex
  let selected = myIndex === selectedIndex

  /**
   * 标签激活处理函数
   * 在自动模式下，焦点变化会触发标签选中
   */
  let activateUsing = useEvent((cb: () => FocusResult) => {
    let result = cb()
    if (result === FocusResult.Success && activation === 'auto') {
      let newTab = getOwnerDocument(internalTabRef)?.activeElement
      let idx = data.tabs.findIndex((tab) => tab.current === newTab)
      if (idx !== -1) actions.change(idx)
    }
    return result
  })

  /**
   * 键盘事件处理
   * 实现标准的键盘导航功能
   */
  let handleKeyDown = useEvent((event: ReactKeyboardEvent<HTMLElement>) => {
    let list = tabs.map((tab) => tab.current).filter(Boolean) as HTMLElement[]

    // Space/Enter: 选中当前标签
    if (event.key === Keys.Space || event.key === Keys.Enter) {
      event.preventDefault()
      event.stopPropagation()
      actions.change(myIndex)
      return
    }

    // Home/PageUp: 跳转到第一个标签
    // End/PageDown: 跳转到最后一个标签
    switch (event.key) {
      case Keys.Home:
      case Keys.PageUp:
        event.preventDefault()
        event.stopPropagation()
        return activateUsing(() => focusIn(list, Focus.First))

      case Keys.End:
      case Keys.PageDown:
        event.preventDefault()
        event.stopPropagation()
        return activateUsing(() => focusIn(list, Focus.Last))
    }

    // 根据方向处理箭头键导航
    let result = activateUsing(() => {
      return match(orientation, {
        vertical() {
          if (event.key === Keys.ArrowUp) return focusIn(list, Focus.Previous | Focus.WrapAround)
          if (event.key === Keys.ArrowDown) return focusIn(list, Focus.Next | Focus.WrapAround)
          return FocusResult.Error
        },
        horizontal() {
          if (event.key === Keys.ArrowLeft) return focusIn(list, Focus.Previous | Focus.WrapAround)
          if (event.key === Keys.ArrowRight) return focusIn(list, Focus.Next | Focus.WrapAround)
          return FocusResult.Error
        },
      })
    })

    if (result === FocusResult.Success) {
      return event.preventDefault()
    }
  })

  // 处理标签选中逻辑
  let ready = useRef(false)
  let handleSelection = useEvent(() => {
    if (ready.current) return
    ready.current = true

    internalTabRef.current?.focus({ preventScroll: true })
    actions.change(myIndex)

    microTask(() => {
      ready.current = false
    })
  })

  // 阻止鼠标按下默认行为，确保正确的点击和焦点行为
  let handleMouseDown = useEvent((event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault()
  })

  // 状态hooks
  let { isFocusVisible: focus, focusProps } = useFocusRing({ autoFocus })
  let { isHovered: hover, hoverProps } = useHover({ isDisabled: disabled })
  let { pressed: active, pressProps } = useActivePress({ disabled })

  // 渲染属性
  let slot = useMemo(() => {
    return {
      selected,
      hover,
      active,
      focus,
      autofocus: autoFocus,
      disabled,
    } satisfies TabRenderPropArg
  }, [selected, hover, focus, active, autoFocus, disabled])

  // 组件属性
  let ourProps = mergeProps(
    {
      ref: tabRef,
      onKeyDown: handleKeyDown,
      onMouseDown: handleMouseDown,
      onClick: handleSelection,
      id,
      role: 'tab',
      type: useResolveButtonType(props, tabElement),
      'aria-controls': panels[myIndex]?.current?.id,
      'aria-selected': selected,
      tabIndex: selected ? 0 : -1,
      disabled: disabled || undefined,
      autoFocus,
    },
    focusProps,
    hoverProps,
    pressProps
  )

  let render = useRender()

  return render({
    ourProps,
    theirProps,
    slot,
    defaultTag: DEFAULT_TAB_TAG,
    name: 'Tabs.Tab',
  })
}

// ---

let DEFAULT_PANELS_TAG = 'div' as const
type PanelsRenderPropArg = {
  selectedIndex: number
}

/**
 * TabPanels组件属性
 * 用于包装所有面板内容的容器组件
 * 
 * @property selectedIndex - 当前选中的面板索引
 */
export type TabPanelsProps<TTag extends ElementType = typeof DEFAULT_PANELS_TAG> = Props<
  TTag,
  PanelsRenderPropArg
>

/**
 * TabPanels组件实现
 * 作为面板的容器组件，主要职责：
 * 1. 维护面板容器引用
 * 2. 传递选中状态到子组件
 * 
 * @param props - 组件属性
 * @param ref - 容器元素引用
 */
function PanelsFn<TTag extends ElementType = typeof DEFAULT_PANELS_TAG>(
  props: TabPanelsProps<TTag>,
  ref: Ref<HTMLElement>
) {
  let { selectedIndex } = useData('Tab.Panels')
  let panelsRef = useSyncRefs(ref)

  let slot = useMemo(() => ({ selectedIndex }) satisfies PanelsRenderPropArg, [selectedIndex])

  let theirProps = props
  let ourProps = { ref: panelsRef }

  let render = useRender()

  return render({
    ourProps,
    theirProps,
    slot,
    defaultTag: DEFAULT_PANELS_TAG,
    name: 'Tabs.Panels',
  })
}

// ---

let DEFAULT_PANEL_TAG = 'div' as const
type PanelRenderPropArg = {
  selected: boolean
  focus: boolean
}
type PanelPropsWeControl = 'role' | 'aria-labelledby'
let PanelRenderFeatures = RenderFeatures.RenderStrategy | RenderFeatures.Static

/**
 * TabPanel组件属性
 * 
 * @property id - 面板唯一标识
 * @property tabIndex - 面板Tab键序号
 * @property unmount - 是否在隐藏时卸载内容
 * @property static - 是否始终保持渲染
 */
export type TabPanelProps<TTag extends ElementType = typeof DEFAULT_PANEL_TAG> = Props<
  TTag,
  PanelRenderPropArg,
  PanelPropsWeControl,
  PropsForFeatures<typeof PanelRenderFeatures> & { 
    id?: string
    tabIndex?: number 
  }
>

/**
 * TabPanel组件实现
 * 单个面板组件，负责：
 * 1. 内容渲染控制 - 根据选中状态和配置决定是否渲染
 * 2. WAI-ARIA支持 - 提供正确的role和aria属性
 * 3. 焦点管理 - 处理面板的焦点状态
 * 4. 可访问性 - 与对应的标签建立关联
 * 
 * @param props - 组件属性
 * @param ref - 面板元素引用
 */
function PanelFn<TTag extends ElementType = typeof DEFAULT_PANEL_TAG>(
  props: TabPanelProps<TTag>,
  ref: Ref<HTMLElement>
) {
  let internalId = useId()
  let { id = `headlessui-tabs-panel-${internalId}`, tabIndex = 0, ...theirProps } = props
  let { selectedIndex, tabs, panels } = useData('Tab.Panel')
  let actions = useActions('Tab.Panel')

  // 状态和引用管理
  let internalPanelRef = useRef<HTMLElement | null>(null)
  let panelRef = useSyncRefs(internalPanelRef, ref)

  // 注册面板到上下文
  useIsoMorphicEffect(() => actions.registerPanel(internalPanelRef), [actions, internalPanelRef])

  // 确定面板索引和选中状态
  let mySSRIndex = useStableCollectionIndex('panels')
  let myIndex = panels.indexOf(internalPanelRef)
  if (myIndex === -1) myIndex = mySSRIndex
  let selected = myIndex === selectedIndex

  // 焦点管理
  let { isFocusVisible: focus, focusProps } = useFocusRing()
  
  // 渲染属性
  let slot = useMemo(() => ({ selected, focus }) satisfies PanelRenderPropArg, [selected, focus])

  // 组件属性
  let ourProps = mergeProps(
    {
      ref: panelRef,
      id,
      role: 'tabpanel',
      'aria-labelledby': tabs[myIndex]?.current?.id,
      tabIndex: selected ? tabIndex : -1,
    },
    focusProps
  )

  let render = useRender()

  // 根据配置决定渲染策略
  if (!selected && (theirProps.unmount ?? true) && !(theirProps.static ?? false)) {
    return <Hidden aria-hidden="true" {...ourProps} />
  }

  return render({
    ourProps,
    theirProps,
    slot,
    defaultTag: DEFAULT_PANEL_TAG,
    features: PanelRenderFeatures,
    visible: selected,
    name: 'Tabs.Panel',
  })
}

// ---

/**
 * Tab组件接口
 * 定义单个标签按钮组件的类型，支持:
 * 1. 泛型标签类型 - 默认为button
 * 2. 组件属性 - TabProps
 * 3. ref转发 - 通过RefProp
 */
export interface _internal_ComponentTab extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_TAB_TAG>(
    props: TabProps<TTag> & RefProp<typeof TabFn>
  ): React.JSX.Element
}

/**
 * TabGroup组件接口
 * 定义整个标签页组的类型，支持:
 * 1. 泛型容器类型 - 默认为div
 * 2. 分组属性 - TabGroupProps
 * 3. ref转发 - 通过RefProp
 */
export interface _internal_ComponentTabGroup extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_TABS_TAG>(
    props: TabGroupProps<TTag> & RefProp<typeof GroupFn>
  ): React.JSX.Element
}

/**
 * TabList组件接口
 * 定义标签列表容器的类型，支持:
 * 1. 泛型容器类型 - 默认为div
 * 2. 列表属性 - TabListProps
 * 3. ref转发 - 通过RefProp
 */
export interface _internal_ComponentTabList extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_LIST_TAG>(
    props: TabListProps<TTag> & RefProp<typeof ListFn>
  ): React.JSX.Element
}

/**
 * TabPanels组件接口
 * 定义面板容器的类型，支持:
 * 1. 泛型容器类型 - 默认为div
 * 2. 面板容器属性 - TabPanelsProps
 * 3. ref转发 - 通过RefProp
 */
export interface _internal_ComponentTabPanels extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_PANELS_TAG>(
    props: TabPanelsProps<TTag> & RefProp<typeof PanelsFn>
  ): React.JSX.Element
}

/**
 * TabPanel组件接口
 * 定义单个面板的类型，支持:
 * 1. 泛型容器类型 - 默认为div
 * 2. 面板属性 - TabPanelProps
 * 3. ref转发 - 通过RefProp
 */
export interface _internal_ComponentTabPanel extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_PANEL_TAG>(
    props: TabPanelProps<TTag> & RefProp<typeof PanelFn>
  ): React.JSX.Element
}

/**
 * 组件导出
 * 使用forwardRefWithAs包装所有组件以支持:
 * 1. ref转发
 * 2. as属性 - 允许改变渲染的HTML元素
 * 3. 类型安全
 */
let TabRoot = forwardRefWithAs(TabFn) as _internal_ComponentTab
export let TabGroup = forwardRefWithAs(GroupFn) as _internal_ComponentTabGroup
export let TabList = forwardRefWithAs(ListFn) as _internal_ComponentTabList
export let TabPanels = forwardRefWithAs(PanelsFn) as _internal_ComponentTabPanels
export let TabPanel = forwardRefWithAs(PanelFn) as _internal_ComponentTabPanel

/**
 * 最终导出
 * 提供两种使用方式:
 * 1. 分离组件: <TabGroup>, <TabList>, <Tab>, <TabPanels>, <TabPanel>
 * 2. 命名空间(已废弃): <Tab.Group>, <Tab.List>, <Tab>, <Tab.Panels>, <Tab.Panel>
 */
export let Tab = Object.assign(TabRoot, {
  /** @deprecated use `<TabGroup>` instead of `<Tab.Group>` */
  Group: TabGroup,
  /** @deprecated use `<TabList>` instead of `<Tab.List>` */
  List: TabList,
  /** @deprecated use `<TabPanels>` instead of `<Tab.Panels>` */
  Panels: TabPanels,
  /** @deprecated use `<TabPanel>` instead of `<Tab.Panel>` */
  Panel: TabPanel,
})
