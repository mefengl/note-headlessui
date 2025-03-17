/**
 * Tabs 标签页组件模块
 * 
 * 这是一个完全无样式的标签页组件，提供类似浏览器标签页的交互体验。
 * 组件特点：
 * 1. 完全无样式 - 所有样式由用户自定义
 * 2. 完整键盘支持：
 *    - 方向键：在标签间导航
 *    - Home/End：跳转到第一个/最后一个标签
 *    - Space/Enter：选中当前标签
 * 3. 两种激活模式：
 *    - auto：焦点跟随自动激活标签
 *    - manual：需要手动点击才激活标签
 * 4. 完整的WAI-ARIA无障碍支持
 * 5. 支持垂直和水平布局
 * 
 * 使用示例:
 * ```vue
 * <TabGroup>
 *   <TabList>
 *     <Tab>标签1</Tab>
 *     <Tab>标签2</Tab>
 *   </TabList>
 *   <TabPanels>
 *     <TabPanel>内容1</TabPanel>
 *     <TabPanel>内容2</TabPanel>
 *   </TabPanels>
 * </TabGroup>
 * ```
 */

import {
  Fragment,
  computed,
  defineComponent,
  h,
  inject,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch,
  watchEffect,
  type InjectionKey,
  type Ref,
} from 'vue'
import { useId } from '../../hooks/use-id'
import { useResolveButtonType } from '../../hooks/use-resolve-button-type'
import { FocusSentinel } from '../../internal/focus-sentinel'
import { Hidden } from '../../internal/hidden'
import { Keys } from '../../keyboard'
import { dom } from '../../utils/dom'
import { Focus, FocusResult, focusIn, sortByDomNode } from '../../utils/focus-management'
import { match } from '../../utils/match'
import { microTask } from '../../utils/micro-task'
import { getOwnerDocument } from '../../utils/owner'
import { Features, omit, render } from '../../utils/render'

/**
 * 标签导航方向枚举
 * Forwards: 向前导航
 * Backwards: 向后导航
 */
enum Direction {
  Forwards,
  Backwards,
}

/**
 * 排序比较结果枚举
 * Less: 小于
 * Equal: 等于
 * Greater: 大于
 */
enum Ordering {
  Less = -1,
  Equal = 0,
  Greater = 1,
}

/**
 * Tabs组件状态定义
 * 用于在组件层级间共享状态
 */
type StateDefinition = {
  /** 当前选中的标签索引 */
  selectedIndex: Ref<number | null>
  /** 标签布局方向 */
  orientation: Ref<'vertical' | 'horizontal'>
  /** 标签激活模式 */
  activation: Ref<'auto' | 'manual'>
  /** 所有标签页的引用数组 */
  tabs: Ref<Ref<HTMLElement | null>[]>
  /** 所有面板的引用数组 */
  panels: Ref<Ref<HTMLElement | null>[]>

  // 状态操作方法
  /** 设置选中标签 */
  setSelectedIndex(index: number): void
  /** 注册标签页 */
  registerTab(tab: Ref<HTMLElement | null>): void
  /** 注销标签页 */
  unregisterTab(tab: Ref<HTMLElement | null>): void
  /** 注册面板 */
  registerPanel(panel: Ref<HTMLElement | null>): void
  /** 注销面板 */
  unregisterPanel(panel: Ref<HTMLElement | null>): void
}

/**
 * Tabs组件上下文
 * 使用Vue的inject/provide机制在组件层级间共享状态
 */
let TabsContext = Symbol('TabsContext') as InjectionKey<StateDefinition>

/**
 * 获取Tabs上下文的工具函数
 */
function useTabsContext(component: string) {
  let context = inject(TabsContext, null)
  if (context === null) {
    let err = new Error(`<${component} /> is missing a parent <TabGroup /> component.`)
    if (Error.captureStackTrace) Error.captureStackTrace(err, useTabsContext)
    throw err
  }
  return context
}

/**
 * SSR(服务端渲染)上下文
 * 用于在服务端生成唯一的标签页ID
 */
let TabsSSRContext = Symbol('TabsSSRContext') as InjectionKey<
  Ref<{ tabs: string[]; panels: string[] } | null>
>

/**
 * TabGroup组件 - 标签页容器
 * 
 * 核心功能：
 * 1. 状态管理：
 *    - 支持受控和非受控模式
 *    - 维护选中标签索引
 *    - 管理标签和面板的注册
 * 2. 布局支持：
 *    - 水平布局（默认）
 *    - 垂直布局
 * 3. 激活模式：
 *    - auto：焦点跟随自动激活（默认）
 *    - manual：需要手动点击激活
 * 
 * Props：
 * - as：渲染的元素类型，默认template
 * - selectedIndex：当前选中索引（受控模式）
 * - defaultIndex：默认选中索引
 * - vertical：是否垂直布局
 * - manual：是否手动激活模式
 */
export let TabGroup = defineComponent({
  name: 'TabGroup',
  emits: {
    change: (_index: number) => true,
  },
  props: {
    as: { type: [Object, String], default: 'template' },
    selectedIndex: { type: [Number], default: null },
    defaultIndex: { type: [Number], default: 0 },
    vertical: { type: [Boolean], default: false },
    manual: { type: [Boolean], default: false },
  },
  inheritAttrs: false,
  setup(props, { slots, attrs, emit }) {
    let selectedIndex = ref<StateDefinition['selectedIndex']['value']>(
      props.selectedIndex ?? props.defaultIndex
    )
    let tabs = ref<StateDefinition['tabs']['value']>([])
    let panels = ref<StateDefinition['panels']['value']>([])

    let isControlled = computed(() => props.selectedIndex !== null)
    let realSelectedIndex = computed(() =>
      isControlled.value ? props.selectedIndex : selectedIndex.value
    )

    function setSelectedIndex(indexToSet: number) {
      let tabs = sortByDomNode(api.tabs.value, dom)
      let panels = sortByDomNode(api.panels.value, dom)

      let focusableTabs = tabs.filter((tab) => !dom(tab)?.hasAttribute('disabled'))

      if (
        // Underflow
        indexToSet < 0 ||
        // Overflow
        indexToSet > tabs.length - 1
      ) {
        let direction = match(
          selectedIndex.value === null // Not set yet
            ? Ordering.Equal
            : Math.sign(indexToSet - selectedIndex.value!),
          {
            [Ordering.Less]: () => Direction.Backwards,
            [Ordering.Equal]: () => {
              return match(Math.sign(indexToSet), {
                [Ordering.Less]: () => Direction.Forwards,
                [Ordering.Equal]: () => Direction.Forwards,
                [Ordering.Greater]: () => Direction.Backwards,
              })
            },
            [Ordering.Greater]: () => Direction.Forwards,
          }
        )

        let nextSelectedIndex = match(direction, {
          [Direction.Forwards]: () => tabs.indexOf(focusableTabs[0]),
          [Direction.Backwards]: () => tabs.indexOf(focusableTabs[focusableTabs.length - 1]),
        })
        if (nextSelectedIndex !== -1) {
          selectedIndex.value = nextSelectedIndex
        }
        api.tabs.value = tabs
        api.panels.value = panels
      }

      // Middle
      else {
        let before = tabs.slice(0, indexToSet)
        let after = tabs.slice(indexToSet)

        let next = [...after, ...before].find((tab) => focusableTabs.includes(tab))
        if (!next) return

        let localSelectedIndex = tabs.indexOf(next) ?? api.selectedIndex.value
        if (localSelectedIndex === -1) localSelectedIndex = api.selectedIndex.value

        selectedIndex.value = localSelectedIndex
        api.tabs.value = tabs
        api.panels.value = panels
      }
    }

    let api = {
      selectedIndex: computed(() => selectedIndex.value ?? props.defaultIndex ?? null),
      orientation: computed(() => (props.vertical ? 'vertical' : 'horizontal')),
      activation: computed(() => (props.manual ? 'manual' : 'auto')),
      tabs,
      panels,
      setSelectedIndex(index: number) {
        if (realSelectedIndex.value !== index) {
          emit('change', index)
        }

        if (!isControlled.value) {
          setSelectedIndex(index)
        }
      },
      registerTab(tab: (typeof tabs)['value'][number]) {
        if (tabs.value.includes(tab)) return
        let activeTab = tabs.value[selectedIndex.value!]

        tabs.value.push(tab)
        tabs.value = sortByDomNode(tabs.value, dom)

        // When the component is uncontrolled, then we want to maintain the
        // actively selected tab even if new tabs are inserted or removed before
        // the active tab.
        //
        // When the component is controlled, then we don't want to do this and
        // instead we want to select the tab based on the `selectedIndex` prop.
        if (!isControlled.value) {
          let localSelectedIndex = tabs.value.indexOf(activeTab) ?? selectedIndex.value

          if (localSelectedIndex !== -1) {
            selectedIndex.value = localSelectedIndex
          }
        }
      },
      unregisterTab(tab: (typeof tabs)['value'][number]) {
        let idx = tabs.value.indexOf(tab)
        if (idx !== -1) tabs.value.splice(idx, 1)
      },
      registerPanel(panel: (typeof panels)['value'][number]) {
        if (panels.value.includes(panel)) return
        panels.value.push(panel)
        panels.value = sortByDomNode(panels.value, dom)
      },
      unregisterPanel(panel: (typeof panels)['value'][number]) {
        let idx = panels.value.indexOf(panel)
        if (idx !== -1) panels.value.splice(idx, 1)
      },
    }

    provide(TabsContext, api)

    let SSRCounter = ref({ tabs: [], panels: [] })
    let mounted = ref(false)
    onMounted(() => {
      mounted.value = true
    })
    provide(
      TabsSSRContext,
      computed(() => (mounted.value ? null : SSRCounter.value))
    )

    let incomingSelectedIndex = computed(() => props.selectedIndex)

    onMounted(() => {
      watch(
        [incomingSelectedIndex /* Deliberately skipping defaultIndex */],
        () => setSelectedIndex(props.selectedIndex ?? props.defaultIndex),
        { immediate: true }
      )
    })

    watchEffect(() => {
      if (!isControlled.value) return
      if (realSelectedIndex.value == null) return
      if (api.tabs.value.length <= 0) return

      let sorted = sortByDomNode(api.tabs.value, dom)
      let didOrderChange = sorted.some((tab, i) => dom(api.tabs.value[i]) !== dom(tab))

      if (didOrderChange) {
        api.setSelectedIndex(
          sorted.findIndex((x) => dom(x) === dom(api.tabs.value[realSelectedIndex.value!]))
        )
      }
    })

    return () => {
      let slot = { selectedIndex: selectedIndex.value }

      return h(Fragment, [
        tabs.value.length <= 0 &&
          h(FocusSentinel, {
            onFocus: () => {
              for (let tab of tabs.value) {
                let el = dom(tab)
                if (el?.tabIndex === 0) {
                  el.focus()
                  return true
                }
              }

              return false
            },
          }),
        render({
          theirProps: {
            ...attrs,
            ...omit(props, ['selectedIndex', 'defaultIndex', 'manual', 'vertical', 'onChange']),
          },
          ourProps: {},
          slot,
          slots,
          attrs,
          name: 'TabGroup',
        }),
      ])
    }
  },
})

/**
 * TabList组件 - 标签列表容器
 * 
 * 功能：
 * 1. 提供标签页的容器
 * 2. 设置正确的ARIA属性
 * 
 * Props：
 * - as：渲染的元素类型，默认div
 */
export let TabList = defineComponent({
  name: 'TabList',
  props: {
    as: { type: [Object, String], default: 'div' },
  },
  setup(props, { attrs, slots }) {
    let api = useTabsContext('TabList')

    return () => {
      let slot = { selectedIndex: api.selectedIndex.value }

      let ourProps = {
        role: 'tablist',
        'aria-orientation': api.orientation.value,
      }
      let theirProps = props

      return render({
        ourProps,
        theirProps,
        slot,
        attrs,
        slots,
        name: 'TabList',
      })
    }
  },
})

/**
 * Tab组件 - 单个标签页
 * 
 * 功能：
 * 1. 键盘导航：
 *    - 方向键：切换标签焦点
 *    - Home/End：跳转到首/尾标签
 *    - Space/Enter：选中标签
 * 2. 状态管理：
 *    - 选中状态
 *    - 禁用状态
 * 3. 自动注册到TabGroup
 * 
 * Props：
 * - as：渲染的元素类型，默认button
 * - disabled：是否禁用
 * - id：标签ID
 */
export let Tab = defineComponent({
  name: 'Tab',
  props: {
    as: { type: [Object, String], default: 'button' },
    disabled: { type: [Boolean], default: false },
    id: { type: String, default: () => `headlessui-tabs-tab-${useId()}` },
  },
  setup(props, { attrs, slots, expose }) {
    let api = useTabsContext('Tab')

    let internalTabRef = ref<HTMLElement | null>(null)

    expose({ el: internalTabRef, $el: internalTabRef })

    onMounted(() => api.registerTab(internalTabRef))
    onUnmounted(() => api.unregisterTab(internalTabRef))

    let SSRContext = inject(TabsSSRContext)!
    // Note: there's a divergence here between React and Vue. Vue can work with `indexOf` implementation while React on the server can't.
    let mySSRIndex = computed(() => {
      if (SSRContext.value) {
        let mySSRIndex = SSRContext.value.tabs.indexOf(props.id)
        if (mySSRIndex === -1) return SSRContext.value.tabs.push(props.id) - 1
        return mySSRIndex
      }

      return -1
    })

    let myIndex = computed(() => {
      let myIndex = api.tabs.value.indexOf(internalTabRef)
      if (myIndex === -1) return mySSRIndex.value
      return myIndex
    })
    let selected = computed(() => myIndex.value === api.selectedIndex.value)

    function activateUsing(cb: () => FocusResult) {
      let result = cb()
      if (result === FocusResult.Success && api.activation.value === 'auto') {
        let newTab = getOwnerDocument(internalTabRef)?.activeElement
        let idx = api.tabs.value.findIndex((tab) => dom(tab) === newTab)
        if (idx !== -1) api.setSelectedIndex(idx)
      }
      return result
    }

    function handleKeyDown(event: KeyboardEvent) {
      let list = api.tabs.value.map((tab) => dom(tab)).filter(Boolean) as HTMLElement[]

      if (event.key === Keys.Space || event.key === Keys.Enter) {
        event.preventDefault()
        event.stopPropagation()

        api.setSelectedIndex(myIndex.value)
        return
      }

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

      let result = activateUsing(() =>
        match(api.orientation.value, {
          vertical() {
            if (event.key === Keys.ArrowUp) return focusIn(list, Focus.Previous | Focus.WrapAround)
            if (event.key === Keys.ArrowDown) return focusIn(list, Focus.Next | Focus.WrapAround)
            return FocusResult.Error
          },
          horizontal() {
            if (event.key === Keys.ArrowLeft)
              return focusIn(list, Focus.Previous | Focus.WrapAround)
            if (event.key === Keys.ArrowRight) return focusIn(list, Focus.Next | Focus.WrapAround)
            return FocusResult.Error
          },
        })
      )

      if (result === FocusResult.Success) {
        return event.preventDefault()
      }
    }

    let ready = ref(false)
    function handleSelection() {
      if (ready.value) return
      ready.value = true

      if (props.disabled) return

      dom(internalTabRef)?.focus({ preventScroll: true })
      api.setSelectedIndex(myIndex.value)

      microTask(() => {
        ready.value = false
      })
    }

    // This is important because we want to only focus the tab when it gets focus
    // OR it finished the click event (mouseup). However, if you perform a `click`,
    // then you will first get the `focus` and then get the `click` event.
    function handleMouseDown(event: MouseEvent) {
      event.preventDefault()
    }

    let type = useResolveButtonType(
      computed(() => ({ as: props.as, type: attrs.type })),
      internalTabRef
    )

    return () => {
      let slot = { selected: selected.value, disabled: props.disabled ?? false }
      let { id, ...theirProps } = props
      let ourProps = {
        ref: internalTabRef,
        onKeydown: handleKeyDown,
        onMousedown: handleMouseDown,
        onClick: handleSelection,
        id,
        role: 'tab',
        type: type.value,
        'aria-controls': dom(api.panels.value[myIndex.value])?.id,
        'aria-selected': selected.value,
        tabIndex: selected.value ? 0 : -1,
        disabled: props.disabled ? true : undefined,
      }

      return render({
        ourProps,
        theirProps,
        slot,
        attrs,
        slots,
        name: 'Tab',
      })
    }
  },
})

/**
 * TabPanels组件 - 面板容器
 * 
 * 功能：
 * 1. 提供标签面板的容器
 * 2. 传递选中状态给子组件
 * 
 * Props：
 * - as：渲染的元素类型，默认div
 */
export let TabPanels = defineComponent({
  name: 'TabPanels',
  props: {
    as: { type: [Object, String], default: 'div' },
  },
  setup(props, { slots, attrs }) {
    let api = useTabsContext('TabPanels')

    return () => {
      let slot = { selectedIndex: api.selectedIndex.value }

      return render({
        theirProps: props,
        ourProps: {},
        slot,
        attrs,
        slots,
        name: 'TabPanels',
      })
    }
  },
})

/**
 * TabPanel组件 - 单个面板
 * 
 * 功能：
 * 1. 条件渲染：
 *    - 支持动态挂载/卸载
 *    - 支持静态渲染(始终保持在DOM中)
 * 2. 可访问性：
 *    - 自动关联对应的标签
 *    - 正确的ARIA属性
 * 3. 自动注册到TabGroup
 * 
 * Props：
 * - as：渲染的元素类型，默认div
 * - static：是否静态渲染
 * - unmount：不可见时是否卸载
 * - id：面板ID
 * - tabIndex：Tab键序号
 */
export let TabPanel = defineComponent({
  name: 'TabPanel',
  props: {
    as: { type: [Object, String], default: 'div' },
    static: { type: Boolean, default: false },
    unmount: { type: Boolean, default: true },
    id: { type: String, default: () => `headlessui-tabs-panel-${useId()}` },
    tabIndex: { type: Number, default: 0 },
  },
  setup(props, { attrs, slots, expose }) {
    let api = useTabsContext('TabPanel')

    let internalPanelRef = ref<HTMLElement | null>(null)

    expose({ el: internalPanelRef, $el: internalPanelRef })

    onMounted(() => api.registerPanel(internalPanelRef))
    onUnmounted(() => api.unregisterPanel(internalPanelRef))

    let SSRContext = inject(TabsSSRContext)!
    let mySSRIndex = computed(() => {
      if (SSRContext.value) {
        let mySSRIndex = SSRContext.value.panels.indexOf(props.id)
        if (mySSRIndex === -1) return SSRContext.value.panels.push(props.id) - 1
        return mySSRIndex
      }

      return -1
    })

    let myIndex = computed(() => {
      let myIndex = api.panels.value.indexOf(internalPanelRef)
      if (myIndex === -1) return mySSRIndex.value
      return myIndex
    })
    let selected = computed(() => myIndex.value === api.selectedIndex.value)

    return () => {
      let slot = { selected: selected.value }
      let { id, tabIndex, ...theirProps } = props
      let ourProps = {
        ref: internalPanelRef,
        id,
        role: 'tabpanel',
        'aria-labelledby': dom(api.tabs.value[myIndex.value])?.id,
        tabIndex: selected.value ? tabIndex : -1,
      }

      if (!selected.value && props.unmount && !props.static) {
        return h(Hidden, { as: 'span', 'aria-hidden': true, ...ourProps })
      }

      return render({
        ourProps,
        theirProps,
        slot,
        attrs,
        slots,
        features: Features.Static | Features.RenderStrategy,
        visible: selected.value,
        name: 'TabPanel',
      })
    }
  },
})
