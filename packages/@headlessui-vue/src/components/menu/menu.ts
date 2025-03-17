/**
 * Menu组件 - HeadlessUI Vue版本的下拉菜单组件
 * 
 * 实现了WAI-ARIA Menu Button模式，提供完全无样式的可访问性菜单功能。
 * 
 * 主要特性：
 * 1. 完整键盘导航支持
 * 2. 搜索/筛选功能
 * 3. 可访问性支持
 * 4. 自动焦点管理
 * 5. 外部点击关闭
 * 6. 完全可定制的样式
 * 
 * 核心子组件：
 * - Menu: 菜单容器
 * - MenuButton: 触发按钮
 * - MenuItems: 选项列表容器
 * - MenuItem: 单个选项
 */

import {
  computed,
  defineComponent,
  inject,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watchEffect,
  type ComputedRef,
  type InjectionKey,
  type Ref,
  type UnwrapNestedRefs,
} from 'vue'
import { useId } from '../../hooks/use-id'
import { useOutsideClick } from '../../hooks/use-outside-click'
import { useResolveButtonType } from '../../hooks/use-resolve-button-type'
import { useTextValue } from '../../hooks/use-text-value'
import { useTrackedPointer } from '../../hooks/use-tracked-pointer'
import { useTreeWalker } from '../../hooks/use-tree-walker'
import { State, useOpenClosed, useOpenClosedProvider } from '../../internal/open-closed'
import { Keys } from '../../keyboard'
import { Focus, calculateActiveIndex } from '../../utils/calculate-active-index'
import { dom } from '../../utils/dom'
import {
  Focus as FocusManagementFocus,
  FocusableMode,
  focusFrom,
  isFocusableElement,
  restoreFocusIfNecessary,
  sortByDomNode,
} from '../../utils/focus-management'
import { match } from '../../utils/match'
import { Features, render } from '../../utils/render'

/**
 * 菜单状态枚举
 */
enum MenuStates {
  Open,    // 打开状态
  Closed   // 关闭状态
}

/**
 * 激活触发方式枚举
 */
enum ActivationTrigger {
  Pointer,  // 通过指针设备(鼠标/触摸)
  Other     // 其他方式(如键盘)
}

/**
 * 工具函数：确保在下一帧执行回调
 */
function nextFrame(cb: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(cb))
}

/**
 * 菜单项数据类型
 */
type MenuItemData = {
  textValue: string                 // 文本值(用于搜索)
  disabled: boolean                 // 是否禁用
  domRef: Ref<HTMLElement | null>   // DOM元素引用
}

/**
 * 菜单状态定义
 * 包含菜单所需的所有状态和方法
 */
type StateDefinition = {
  // 状态数据
  menuState: Ref<MenuStates>                  // 当前菜单状态
  buttonRef: Ref<HTMLButtonElement | null>    // 按钮元素引用
  itemsRef: Ref<HTMLDivElement | null>       // 选项列表容器引用
  items: Ref<{ id: string; dataRef: ComputedRef<MenuItemData> }[]>  // 所有选项
  searchQuery: Ref<string>                    // 搜索查询
  activeItemIndex: Ref<number | null>         // 当前激活项索引
  activationTrigger: Ref<ActivationTrigger>   // 激活触发方式

  // 状态操作方法
  closeMenu(): void                           // 关闭菜单
  openMenu(): void                            // 打开菜单
  goToItem(focus: Focus, id?: string, trigger?: ActivationTrigger): void  // 切换选中项
  search(value: string): void                 // 搜索选项
  clearSearch(): void                         // 清除搜索
  registerItem(id: string, dataRef: ComputedRef<MenuItemData>): void    // 注册选项
  unregisterItem(id: string): void           // 注销选项
}

/**
 * 菜单上下文
 * 用于在组件树中共享菜单状态
 */
let MenuContext = Symbol('MenuContext') as InjectionKey<StateDefinition>

/**
 * 菜单上下文Hook
 * 获取上下文数据,如果不在Menu内使用会抛出错误
 */
function useMenuContext(component: string) {
  let context = inject(MenuContext, null)
  if (context === null) {
    let err = new Error(`<${component} /> is missing a parent <Menu /> component.`)
    if (Error.captureStackTrace) Error.captureStackTrace(err, useMenuContext)
    throw err
  }
  return context
}

/**
 * Menu组件实现
 * 主要职责：
 * 1. 状态管理
 * 2. 键盘导航
 * 3. 搜索功能
 * 4. 选项管理
 */
export let Menu = defineComponent({
  name: 'Menu',
  props: { 
    as: { type: [Object, String], default: 'template' }  // 渲染的HTML标签或组件
  },
  setup(props, { slots, attrs }) {
    // 初始化状态
    let menuState = ref<StateDefinition['menuState']['value']>(MenuStates.Closed)
    let buttonRef = ref<StateDefinition['buttonRef']['value']>(null)
    let itemsRef = ref<StateDefinition['itemsRef']['value']>(null)
    let items = ref<StateDefinition['items']['value']>([])
    let searchQuery = ref<StateDefinition['searchQuery']['value']>('')
    let activeItemIndex = ref<StateDefinition['activeItemIndex']['value']>(null)
    let activationTrigger = ref<StateDefinition['activationTrigger']['value']>(
      ActivationTrigger.Other
    )

    /**
     * 调整选项顺序
     * 处理选项的DOM顺序并维护正确的activeItemIndex
     */
    function adjustOrderedState(
      adjustment: (
        items: UnwrapNestedRefs<StateDefinition['items']['value']>
      ) => UnwrapNestedRefs<StateDefinition['items']['value']> = (i) => i
    ) {
      let currentActiveItem =
        activeItemIndex.value !== null ? items.value[activeItemIndex.value] : null

      let sortedItems = sortByDomNode(adjustment(items.value.slice()), (item) =>
        dom(item.dataRef.domRef)
      )

      // 如果在当前激活项之前插入了一个项，则激活项索引会错误。为了解决这个问题，我们将重新查找正确的索引。
      let adjustedActiveItemIndex = currentActiveItem
        ? sortedItems.indexOf(currentActiveItem)
        : null

      // 如果currentActiveItem被移除，则重置为`null`。
      if (adjustedActiveItemIndex === -1) {
        adjustedActiveItemIndex = null
      }

      return {
        items: sortedItems,
        activeItemIndex: adjustedActiveItemIndex,
      }
    }

    // 组装API对象
    let api = {
      menuState,
      buttonRef,
      itemsRef,
      items,
      searchQuery,
      activeItemIndex,
      activationTrigger,
      closeMenu: () => {
        menuState.value = MenuStates.Closed
        activeItemIndex.value = null
      },
      openMenu: () => (menuState.value = MenuStates.Open),
      goToItem(focus: Focus, id?: string, trigger?: ActivationTrigger) {
        let adjustedState = adjustOrderedState()
        let nextActiveItemIndex = calculateActiveIndex(
          focus === Focus.Specific
            ? { focus: Focus.Specific, id: id! }
            : { focus: focus as Exclude<Focus, Focus.Specific> },
          {
            resolveItems: () => adjustedState.items,
            resolveActiveIndex: () => adjustedState.activeItemIndex,
            resolveId: (item) => item.id,
            resolveDisabled: (item) => item.dataRef.disabled,
          }
        )

        searchQuery.value = ''
        activeItemIndex.value = nextActiveItemIndex
        activationTrigger.value = trigger ?? ActivationTrigger.Other
        items.value = adjustedState.items
      },
      search(value: string) {
        let wasAlreadySearching = searchQuery.value !== ''
        let offset = wasAlreadySearching ? 0 : 1
        searchQuery.value += value.toLowerCase()

        let reOrderedItems =
          activeItemIndex.value !== null
            ? items.value
                .slice(activeItemIndex.value + offset)
                .concat(items.value.slice(0, activeItemIndex.value + offset))
            : items.value

        let matchingItem = reOrderedItems.find(
          (item) => item.dataRef.textValue.startsWith(searchQuery.value) && !item.dataRef.disabled
        )

        let matchIdx = matchingItem ? items.value.indexOf(matchingItem) : -1
        if (matchIdx === -1 || matchIdx === activeItemIndex.value) return

        activeItemIndex.value = matchIdx
        activationTrigger.value = ActivationTrigger.Other
      },
      clearSearch() {
        searchQuery.value = ''
      },
      registerItem(id: string, dataRef: MenuItemData) {
        let adjustedState = adjustOrderedState((items) => {
          return [...items, { id, dataRef }]
        })

        items.value = adjustedState.items
        activeItemIndex.value = adjustedState.activeItemIndex
        activationTrigger.value = ActivationTrigger.Other
      },
      unregisterItem(id: string) {
        let adjustedState = adjustOrderedState((items) => {
          let idx = items.findIndex((a) => a.id === id)
          if (idx !== -1) items.splice(idx, 1)
          return items
        })

        items.value = adjustedState.items
        activeItemIndex.value = adjustedState.activeItemIndex
        activationTrigger.value = ActivationTrigger.Other
      },
    }

    // 处理外部点击关闭
    useOutsideClick(
      [buttonRef, itemsRef],
      (event, target) => {
        api.closeMenu()

        if (!isFocusableElement(target, FocusableMode.Loose)) {
          event.preventDefault()
          dom(buttonRef)?.focus()
        }
      },
      computed(() => menuState.value === MenuStates.Open)
    )

    // 提供上下文
    provide(MenuContext, api)

    useOpenClosedProvider(
      computed(() =>
        match(menuState.value, {
          [MenuStates.Open]: State.Open,
          [MenuStates.Closed]: State.Closed,
        })
      )
    )

    return () => {
      let slot = { open: menuState.value === MenuStates.Open, close: api.closeMenu }
      return render({ ourProps: {}, theirProps: props, slot, slots, attrs, name: 'Menu' })
    }
  },
})

/**
 * MenuButton组件
 * 菜单的触发按钮
 * 
 * 功能：
 * 1. 切换菜单开关状态
 * 2. 键盘快捷键支持
 * 3. 可访问性支持
 */
export let MenuButton = defineComponent({
  name: 'MenuButton',
  props: {
    disabled: { type: Boolean, default: false },   // 是否禁用
    as: { type: [Object, String], default: 'button' }, // 渲染的HTML标签或组件
    id: { type: String, default: () => `headlessui-menu-button-${useId()}` },  // 元素ID
  },
  setup(props, { attrs, slots, expose }) {
    let api = useMenuContext('MenuButton')

    expose({ el: api.buttonRef, $el: api.buttonRef })

    /**
     * 键盘事件处理
     * 实现WAI-ARIA规范的键盘交互
     */
    function handleKeyDown(event: KeyboardEvent) {
      switch (event.key) {
        // Ref: https://www.w3.org/WAI/ARIA/apg/patterns/menubutton/#keyboard-interaction-13

        case Keys.Space:
        case Keys.Enter:
        case Keys.ArrowDown:
          event.preventDefault()
          event.stopPropagation()
          api.openMenu()
          nextTick(() => {
            dom(api.itemsRef)?.focus({ preventScroll: true })
            api.goToItem(Focus.First)
          })
          break

        case Keys.ArrowUp:
          event.preventDefault()
          event.stopPropagation()
          api.openMenu()
          nextTick(() => {
            dom(api.itemsRef)?.focus({ preventScroll: true })
            api.goToItem(Focus.Last)
          })
          break
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      switch (event.key) {
        case Keys.Space:
          // Required for firefox, event.preventDefault() in handleKeyDown for
          // the Space key doesn't cancel the handleKeyUp, which in turn
          // triggers a *click*.
          event.preventDefault()
          break
      }
    }

    function handleClick(event: MouseEvent) {
      if (props.disabled) return
      if (api.menuState.value === MenuStates.Open) {
        api.closeMenu()
        nextTick(() => dom(api.buttonRef)?.focus({ preventScroll: true }))
      } else {
        event.preventDefault()
        api.openMenu()
        nextFrame(() => dom(api.itemsRef)?.focus({ preventScroll: true }))
      }
    }

    let type = useResolveButtonType(
      computed(() => ({ as: props.as, type: attrs.type })),
      api.buttonRef
    )

    return () => {
      let slot = { open: api.menuState.value === MenuStates.Open }

      let { id, ...theirProps } = props
      let ourProps = {
        ref: api.buttonRef,
        id,
        type: type.value,
        'aria-haspopup': 'menu',
        'aria-controls': dom(api.itemsRef)?.id,
        'aria-expanded': api.menuState.value === MenuStates.Open,
        onKeydown: handleKeyDown,
        onKeyup: handleKeyUp,
        onClick: handleClick,
      }

      return render({
        ourProps,
        theirProps,
        slot,
        attrs,
        slots,
        name: 'MenuButton',
      })
    }
  },
})

/**
 * MenuItems组件
 * 菜单选项的容器
 * 
 * 功能：
 * 1. 键盘导航
 * 2. 搜索支持
 * 3. WAI-ARIA属性支持
 * 4. 焦点管理
 */
export let MenuItems = defineComponent({
  name: 'MenuItems',
  props: {
    as: { type: [Object, String], default: 'div' },  // 渲染的HTML标签或组件
    static: { type: Boolean, default: false },       // 是否始终渲染
    unmount: { type: Boolean, default: true },      // 关闭时是否卸载
    id: { type: String, default: () => `headlessui-menu-items-${useId()}` },  // 元素ID
  },
  setup(props, { attrs, slots, expose }) {
    let api = useMenuContext('MenuItems')
    let searchDebounce = ref<ReturnType<typeof setTimeout> | null>(null)

    expose({ el: api.itemsRef, $el: api.itemsRef })

    useTreeWalker({
      container: computed(() => dom(api.itemsRef)),
      enabled: computed(() => api.menuState.value === MenuStates.Open),
      accept(node) {
        if (node.getAttribute('role') === 'menuitem') return NodeFilter.FILTER_REJECT
        if (node.hasAttribute('role')) return NodeFilter.FILTER_SKIP
        return NodeFilter.FILTER_ACCEPT
      },
      walk(node) {
        node.setAttribute('role', 'none')
      },
    })

    function handleKeyDown(event: KeyboardEvent) {
      if (searchDebounce.value) clearTimeout(searchDebounce.value)

      switch (event.key) {
        // Ref: https://www.w3.org/WAI/ARIA/apg/patterns/menu/#keyboard-interaction-12

        // @ts-expect-error Fallthrough is expected here
        case Keys.Space:
          if (api.searchQuery.value !== '') {
            event.preventDefault()
            event.stopPropagation()
            return api.search(event.key)
          }
        // When in type ahead mode, fallthrough
        case Keys.Enter:
          event.preventDefault()
          event.stopPropagation()
          if (api.activeItemIndex.value !== null) {
            let activeItem = api.items.value[api.activeItemIndex.value]
            let _activeItem = activeItem as unknown as UnwrapNestedRefs<typeof activeItem>
            dom(_activeItem.dataRef.domRef)?.click()
          }
          api.closeMenu()
          restoreFocusIfNecessary(dom(api.buttonRef))
          break

        case Keys.ArrowDown:
          event.preventDefault()
          event.stopPropagation()
          return api.goToItem(Focus.Next)

        case Keys.ArrowUp:
          event.preventDefault()
          event.stopPropagation()
          return api.goToItem(Focus.Previous)

        case Keys.Home:
        case Keys.PageUp:
          event.preventDefault()
          event.stopPropagation()
          return api.goToItem(Focus.First)

        case Keys.End:
        case Keys.PageDown:
          event.preventDefault()
          event.stopPropagation()
          return api.goToItem(Focus.Last)

        case Keys.Escape:
          event.preventDefault()
          event.stopPropagation()
          api.closeMenu()
          nextTick(() => dom(api.buttonRef)?.focus({ preventScroll: true }))
          break

        case Keys.Tab:
          event.preventDefault()
          event.stopPropagation()
          api.closeMenu()
          nextTick(() =>
            focusFrom(
              dom(api.buttonRef),
              event.shiftKey ? FocusManagementFocus.Previous : FocusManagementFocus.Next
            )
          )
          break

        default:
          if (event.key.length === 1) {
            api.search(event.key)
            searchDebounce.value = setTimeout(() => api.clearSearch(), 350)
          }
          break
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      switch (event.key) {
        case Keys.Space:
          // Required for firefox, event.preventDefault() in handleKeyDown for
          // the Space key doesn't cancel the handleKeyUp, which in turn
          // triggers a *click*.
          event.preventDefault()
          break
      }
    }

    let usesOpenClosedState = useOpenClosed()
    let visible = computed(() => {
      if (usesOpenClosedState !== null) {
        return (usesOpenClosedState.value & State.Open) === State.Open
      }

      return api.menuState.value === MenuStates.Open
    })

    return () => {
      let slot = { open: api.menuState.value === MenuStates.Open }
      let { id, ...theirProps } = props
      let ourProps = {
        'aria-activedescendant':
          api.activeItemIndex.value === null
            ? undefined
            : api.items.value[api.activeItemIndex.value]?.id,
        'aria-labelledby': dom(api.buttonRef)?.id,
        id,
        onKeydown: handleKeyDown,
        onKeyup: handleKeyUp,
        role: 'menu',
        tabIndex: 0,
        ref: api.itemsRef,
      }

      return render({
        ourProps,
        theirProps,
        slot,
        attrs,
        slots,
        features: Features.RenderStrategy | Features.Static,
        visible: visible.value,
        name: 'MenuItems',
      })
    }
  },
})

/**
 * MenuItem组件
 * 单个菜单选项
 * 
 * 功能：
 * 1. 可禁用
 * 2. 支持键盘和鼠标交互
 * 3. 自动滚动到视图
 * 4. WAI-ARIA属性支持
 */
export let MenuItem = defineComponent({
  name: 'MenuItem',
  inheritAttrs: false,
  props: {
    as: { type: [Object, String], default: 'template' },  // 渲染的HTML标签或组件
    disabled: { type: Boolean, default: false },         // 是否禁用
    id: { type: String, default: () => `headlessui-menu-item-${useId()}` },  // 元素ID
  },
  setup(props, { slots, attrs, expose }) {
    let api = useMenuContext('MenuItem')
    let internalItemRef = ref<HTMLElement | null>(null)

    expose({ el: internalItemRef, $el: internalItemRef })

    let active = computed(() => {
      return api.activeItemIndex.value !== null
        ? api.items.value[api.activeItemIndex.value].id === props.id
        : false
    })

    let getTextValue = useTextValue(internalItemRef)
    let dataRef = computed<MenuItemData>(() => ({
      disabled: props.disabled,
      get textValue() {
        return getTextValue()
      },
      domRef: internalItemRef,
    }))

    onMounted(() => api.registerItem(props.id, dataRef))
    onUnmounted(() => api.unregisterItem(props.id))

    watchEffect(() => {
      if (api.menuState.value !== MenuStates.Open) return
      if (!active.value) return
      if (api.activationTrigger.value === ActivationTrigger.Pointer) return
      nextTick(() => dom(internalItemRef)?.scrollIntoView?.({ block: 'nearest' }))
    })

    function handleClick(event: MouseEvent) {
      if (props.disabled) return event.preventDefault()
      api.closeMenu()
      restoreFocusIfNecessary(dom(api.buttonRef))
    }

    function handleFocus() {
      if (props.disabled) return api.goToItem(Focus.Nothing)
      api.goToItem(Focus.Specific, props.id)
    }

    let pointer = useTrackedPointer()

    function handleEnter(evt: PointerEvent) {
      pointer.update(evt)
    }

    function handleMove(evt: PointerEvent) {
      if (!pointer.wasMoved(evt)) return
      if (props.disabled) return
      if (active.value) return
      api.goToItem(Focus.Specific, props.id, ActivationTrigger.Pointer)
    }

    function handleLeave(evt: PointerEvent) {
      if (!pointer.wasMoved(evt)) return
      if (props.disabled) return
      if (!active.value) return
      api.goToItem(Focus.Nothing)
    }

    return () => {
      let { id, disabled, ...theirProps } = props
      let slot = { active: active.value, disabled, close: api.closeMenu }
      let ourProps = {
        id,
        ref: internalItemRef,
        role: 'menuitem',
        tabIndex: disabled === true ? undefined : -1,
        'aria-disabled': disabled === true ? true : undefined,
        onClick: handleClick,
        onFocus: handleFocus,
        onPointerenter: handleEnter,
        onMouseenter: handleEnter,
        onPointermove: handleMove,
        onMousemove: handleMove,
        onPointerleave: handleLeave,
        onMouseleave: handleLeave,
      }

      return render({
        ourProps,
        theirProps: { ...attrs, ...theirProps },
        slot,
        attrs,
        slots,
        name: 'MenuItem',
      })
    }
  },
})
