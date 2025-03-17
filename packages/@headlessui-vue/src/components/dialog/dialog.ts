/**
 * Dialog 对话框组件模块
 * 
 * 这是一个无样式的模态对话框组件，实现了WAI-ARIA对话框设计模式。
 * WAI-ARIA规范: https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/
 * 
 * 组件特点：
 * 1. 完全无样式 - 所有外观由用户自定义
 * 2. 遵循WAI-ARIA最佳实践：
 *    - 正确的ARIA角色和属性
 *    - 焦点管理和捕获
 *    - ESC键关闭支持
 * 3. 智能的交互控制：
 *    - 自动锁定背景滚动
 *    - 点击外部自动关闭
 *    - 支持嵌套对话框
 * 4. 可组合的子组件：
 *    - DialogOverlay: 背景遮罩
 *    - DialogBackdrop: 背景装饰
 *    - DialogPanel: 内容面板
 *    - DialogTitle: 标题（自动关联ARIA）
 *    - DialogDescription: 描述文本
 * 
 * 使用示例:
 * ```vue
 * <Dialog v-model="isOpen">
 *   <DialogBackdrop />
 *   <DialogPanel>
 *     <DialogTitle>对话框标题</DialogTitle>
 *     <DialogDescription>描述文本</DialogDescription>
 *     <button @click="isOpen = false">关闭</button>
 *   </DialogPanel>
 * </Dialog>
 * ```
 */

import {
  computed,
  defineComponent,
  h,
  inject,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watchEffect,
  type InjectionKey,
  type PropType,
  type Ref,
} from 'vue'
import { FocusTrap } from '../../components/focus-trap/focus-trap'
import { useDocumentOverflowLockedEffect } from '../../hooks/document-overflow/use-document-overflow'
import { useEventListener } from '../../hooks/use-event-listener'
import { useId } from '../../hooks/use-id'
import { useInert } from '../../hooks/use-inert'
import { useOutsideClick } from '../../hooks/use-outside-click'
import { useRootContainers } from '../../hooks/use-root-containers'
import { State, useOpenClosed } from '../../internal/open-closed'
import { ForcePortalRoot } from '../../internal/portal-force-root'
import { StackMessage, useStackProvider } from '../../internal/stack-context'
import { Keys } from '../../keyboard'
import { dom } from '../../utils/dom'
import { match } from '../../utils/match'
import { getOwnerDocument } from '../../utils/owner'
import { Features, render } from '../../utils/render'
import { Description, useDescriptions } from '../description/description'
import { Portal, PortalGroup, useNestedPortals } from '../portal/portal'

/**
 * 对话框状态枚举
 * Open: 打开状态
 * Closed: 关闭状态
 */
enum DialogStates {
  Open,
  Closed,
}

/**
 * 对话框组件状态定义
 * 用于在组件层级间共享状态
 */
interface StateDefinition {
  /** 对话框当前状态 */
  dialogState: Ref<DialogStates>
  /** 标题ID，用于aria-labelledby */
  titleId: Ref<string | null>
  /** 内容面板引用 */
  panelRef: Ref<HTMLDivElement | null>
  /** 设置标题ID */
  setTitleId(id: string | null): void
  /** 关闭对话框 */
  close(): void
}

/**
 * 对话框组件上下文
 * 使用Vue的inject/provide机制在组件层级间共享状态
 */
let DialogContext = Symbol('DialogContext') as InjectionKey<StateDefinition>

/**
 * 获取对话框上下文的工具函数
 */
function useDialogContext(component: string) {
  let context = inject(DialogContext, null)
  if (context === null) {
    let err = new Error(`<${component} /> is missing a parent <Dialog /> component.`)
    if (Error.captureStackTrace) Error.captureStackTrace(err, useDialogContext)
    throw err
  }
  return context
}

// ---

let Missing = 'DC8F892D-2EBD-447C-A4C8-A03058436FF4'

/**
 * Dialog组件 - 对话框容器
 * 
 * 核心功能：
 * 1. 状态管理：
 *    - 打开/关闭状态控制
 *    - 支持受控和非受控模式
 * 2. 焦点管理：
 *    - 打开时自动捕获焦点
 *    - 支持自定义初始焦点
 *    - 关闭时焦点恢复
 * 3. 无障碍支持：
 *    - role="dialog"或"alertdialog"
 *    - aria-modal="true"
 *    - aria-labelledby关联标题
 *    - aria-describedby关联描述
 * 4. 智能交互：
 *    - ESC键关闭
 *    - 点击外部关闭
 *    - 背景滚动锁定
 *    - 支持嵌套对话框
 * 
 * Props:
 * - as: 渲染的元素类型，默认div
 * - static: 是否静态渲染
 * - unmount: 关闭时是否卸载DOM
 * - open: 开启状态
 * - initialFocus: 初始焦点元素
 * - id: 元素ID
 * - role: 对话框角色(dialog/alertdialog)
 */
export let Dialog = defineComponent({
  name: 'Dialog',
  inheritAttrs: false, // Manually handling this
  props: {
    as: { type: [Object, String], default: 'div' },
    static: { type: Boolean, default: false },
    unmount: { type: Boolean, default: true },
    open: { type: [Boolean, String], default: Missing },
    initialFocus: { type: Object as PropType<HTMLElement | null>, default: null },
    id: { type: String, default: () => `headlessui-dialog-${useId()}` },
    role: { type: String as PropType<'dialog' | 'alertdialog'>, default: 'dialog' },
  },
  emits: { close: (_close: boolean) => true },
  setup(props, { emit, attrs, slots, expose }) {
    let ready = ref(false)
    onMounted(() => {
      ready.value = true
    })

    let didWarnOnRole = false
    let role = computed(() => {
      if (props.role === 'dialog' || props.role === 'alertdialog') {
        return props.role
      }

      if (!didWarnOnRole) {
        didWarnOnRole = true
        console.warn(
          `Invalid role [${role}] passed to <Dialog />. Only \`dialog\` and and \`alertdialog\` are supported. Using \`dialog\` instead.`
        )
      }

      return 'dialog'
    })

    let nestedDialogCount = ref(0)

    let usesOpenClosedState = useOpenClosed()
    let open = computed(() => {
      if (props.open === Missing && usesOpenClosedState !== null) {
        return (usesOpenClosedState.value & State.Open) === State.Open
      }
      return props.open
    })

    let internalDialogRef = ref<HTMLDivElement | null>(null)

    let ownerDocument = computed(() => getOwnerDocument(internalDialogRef))

    expose({ el: internalDialogRef, $el: internalDialogRef })

    // Validations
    let hasOpen = props.open !== Missing || usesOpenClosedState !== null

    if (!hasOpen) {
      throw new Error(`You forgot to provide an \`open\` prop to the \`Dialog\`.`)
    }

    if (typeof open.value !== 'boolean') {
      throw new Error(
        `You provided an \`open\` prop to the \`Dialog\`, but the value is not a boolean. Received: ${
          open.value === Missing ? undefined : props.open
        }`
      )
    }

    let dialogState = computed(() =>
      !ready.value ? DialogStates.Closed : open.value ? DialogStates.Open : DialogStates.Closed
    )
    let enabled = computed(() => dialogState.value === DialogStates.Open)

    let hasNestedDialogs = computed(() => nestedDialogCount.value > 1) // 1 is the current dialog
    let hasParentDialog = inject(DialogContext, null) !== null
    let [portals, PortalWrapper] = useNestedPortals()
    let {
      resolveContainers: resolveRootContainers,
      mainTreeNodeRef,
      MainTreeNode,
    } = useRootContainers({
      portals,
      defaultContainers: [computed(() => api.panelRef.value ?? internalDialogRef.value)],
    })

    // If there are multiple dialogs, then you can be the root, the leaf or one
    // in between. We only care about whether you are the top most one or not.
    let position = computed(() => (!hasNestedDialogs.value ? 'leaf' : 'parent'))

    // When the `Dialog` is wrapped in a `Transition` (or another Headless UI component that exposes
    // the OpenClosed state) then we get some information via context about its state. When the
    // `Transition` is about to close, then the `State.Closing` state will be exposed. This allows us
    // to enable/disable certain functionality in the `Dialog` upfront instead of waiting until the
    // `Transition` is done transitioning.
    let isClosing = computed(() =>
      usesOpenClosedState !== null
        ? (usesOpenClosedState.value & State.Closing) === State.Closing
        : false
    )

    // Ensure other elements can't be interacted with
    let inertOthersEnabled = computed(() => {
      // Nested dialogs should not modify the `inert` property, only the root one should.
      if (hasParentDialog) return false
      if (isClosing.value) return false
      return enabled.value
    })
    let resolveRootOfMainTreeNode = computed(() => {
      return (Array.from(ownerDocument.value?.querySelectorAll('body > *') ?? []).find((root) => {
        // Skip the portal root, we don't want to make that one inert
        if (root.id === 'headlessui-portal-root') return false

        // Find the root of the main tree node
        return root.contains(dom(mainTreeNodeRef)) && root instanceof HTMLElement
      }) ?? null) as HTMLElement | null
    })
    useInert(resolveRootOfMainTreeNode, inertOthersEnabled)

    // This would mark the parent dialogs as inert
    let inertParentDialogs = computed(() => {
      if (hasNestedDialogs.value) return true
      return enabled.value
    })
    let resolveRootOfParentDialog = computed(() => {
      return (Array.from(
        ownerDocument.value?.querySelectorAll('[data-headlessui-portal]') ?? []
      ).find((root) => root.contains(dom(mainTreeNodeRef)) && root instanceof HTMLElement) ??
        null) as HTMLElement | null
    })
    useInert(resolveRootOfParentDialog, inertParentDialogs)

    useStackProvider({
      type: 'Dialog',
      enabled: computed(() => dialogState.value === DialogStates.Open),
      element: internalDialogRef,
      onUpdate: (message, type) => {
        if (type !== 'Dialog') return

        return match(message, {
          [StackMessage.Add]: () => (nestedDialogCount.value += 1),
          [StackMessage.Remove]: () => (nestedDialogCount.value -= 1),
        })
      },
    })

    let describedby = useDescriptions({
      name: 'DialogDescription',
      slot: computed(() => ({ open: open.value })),
    })

    let titleId = ref<StateDefinition['titleId']['value']>(null)

    let api = {
      titleId,
      panelRef: ref(null),
      dialogState,
      setTitleId(id: string | null) {
        if (titleId.value === id) return
        titleId.value = id
      },
      close() {
        emit('close', false)
      },
    }

    provide(DialogContext, api)

    // Handle outside click
    let outsideClickEnabled = computed(() => {
      if (!enabled.value) return false
      if (hasNestedDialogs.value) return false
      return true
    })
    useOutsideClick(
      resolveRootContainers,
      (event, target) => {
        event.preventDefault()
        api.close()
        nextTick(() => target?.focus())
      },
      outsideClickEnabled
    )

    // Handle `Escape` to close
    let escapeToCloseEnabled = computed(() => {
      if (hasNestedDialogs.value) return false
      if (dialogState.value !== DialogStates.Open) return false
      return true
    })
    useEventListener(ownerDocument.value?.defaultView, 'keydown', (event) => {
      if (!escapeToCloseEnabled.value) return
      if (event.defaultPrevented) return
      if (event.key !== Keys.Escape) return

      event.preventDefault()
      event.stopPropagation()
      api.close()
    })

    // Scroll lock
    let scrollLockEnabled = computed(() => {
      if (isClosing.value) return false
      if (dialogState.value !== DialogStates.Open) return false
      if (hasParentDialog) return false
      return true
    })
    useDocumentOverflowLockedEffect(ownerDocument, scrollLockEnabled, (meta) => ({
      containers: [...(meta.containers ?? []), resolveRootContainers],
    }))

    // Trigger close when the FocusTrap gets hidden
    watchEffect((onInvalidate) => {
      if (dialogState.value !== DialogStates.Open) return
      let container = dom(internalDialogRef)
      if (!container) return

      let observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
          let rect = entry.target.getBoundingClientRect()
          if (rect.x === 0 && rect.y === 0 && rect.width === 0 && rect.height === 0) {
            api.close()
          }
        }
      })

      observer.observe(container)

      onInvalidate(() => observer.disconnect())
    })

    return () => {
      let { id, open: _, initialFocus, ...theirProps } = props
      let ourProps = {
        // Manually passthrough the attributes, because Vue can't automatically pass
        // it to the underlying div because of all the wrapper components below.
        ...attrs,
        ref: internalDialogRef,
        id,
        role: role.value,
        'aria-modal': dialogState.value === DialogStates.Open ? true : undefined,
        'aria-labelledby': titleId.value,
        'aria-describedby': describedby.value,
      }

      let slot = { open: dialogState.value === DialogStates.Open }

      return h(ForcePortalRoot, { force: true }, () => [
        h(Portal, () =>
          h(PortalGroup, { target: internalDialogRef.value }, () =>
            h(ForcePortalRoot, { force: false }, () =>
              h(
                FocusTrap,
                {
                  initialFocus,
                  containers: resolveRootContainers,
                  features: enabled.value
                    ? match(position.value, {
                        parent: FocusTrap.features.RestoreFocus,
                        leaf: FocusTrap.features.All & ~FocusTrap.features.FocusLock,
                      })
                    : FocusTrap.features.None,
                },
                () =>
                  h(PortalWrapper, {}, () =>
                    render({
                      ourProps,
                      theirProps: { ...theirProps, ...attrs },
                      slot,
                      attrs,
                      slots,
                      visible: dialogState.value === DialogStates.Open,
                      features: Features.RenderStrategy | Features.Static,
                      name: 'Dialog',
                    })
                  )
              )
            )
          )
        ),
        h(MainTreeNode),
      ])
    }
  },
})

// ---

/**
 * DialogOverlay组件 - 背景遮罩层
 * 
 * 特点:
 * 1. 点击时自动关闭对话框
 * 2. 仅响应直接点击事件
 * 3. 自动添加aria-hidden
 * 
 * Props:
 * - as: 渲染的元素类型，默认div
 * - id: 元素ID
 */
export let DialogOverlay = defineComponent({
  name: 'DialogOverlay',
  props: {
    as: { type: [Object, String], default: 'div' },
    id: { type: String, default: () => `headlessui-dialog-overlay-${useId()}` },
  },
  setup(props, { attrs, slots }) {
    let api = useDialogContext('DialogOverlay')

    function handleClick(event: MouseEvent) {
      if (event.target !== event.currentTarget) return
      event.preventDefault()
      event.stopPropagation()
      api.close()
    }

    return () => {
      let { id, ...theirProps } = props
      let ourProps = {
        id,
        'aria-hidden': true,
        onClick: handleClick,
      }

      return render({
        ourProps,
        theirProps,
        slot: { open: api.dialogState.value === DialogStates.Open },
        attrs,
        slots,
        name: 'DialogOverlay',
      })
    }
  },
})

// ---

/**
 * DialogBackdrop组件 - 背景装饰层
 * 
 * 特点:
 * 1. 必须和DialogPanel配合使用
 * 2. 自动添加aria-hidden
 * 3. 强制使用Portal渲染
 * 
 * Props:
 * - as: 渲染的元素类型，默认div
 * - id: 元素ID
 */
export let DialogBackdrop = defineComponent({
  name: 'DialogBackdrop',
  props: {
    as: { type: [Object, String], default: 'div' },
    id: { type: String, default: () => `headlessui-dialog-backdrop-${useId()}` },
  },
  inheritAttrs: false,
  setup(props, { attrs, slots, expose }) {
    let api = useDialogContext('DialogBackdrop')
    let internalBackdropRef = ref(null)

    expose({ el: internalBackdropRef, $el: internalBackdropRef })

    onMounted(() => {
      if (api.panelRef.value === null) {
        throw new Error(
          `A <DialogBackdrop /> component is being used, but a <DialogPanel /> component is missing.`
        )
      }
    })

    return () => {
      let { id, ...theirProps } = props
      let ourProps = {
        id,
        ref: internalBackdropRef,
        'aria-hidden': true,
      }

      return h(ForcePortalRoot, { force: true }, () =>
        h(Portal, () =>
          render({
            ourProps,
            theirProps: { ...attrs, ...theirProps },
            slot: { open: api.dialogState.value === DialogStates.Open },
            attrs,
            slots,
            name: 'DialogBackdrop',
          })
        )
      )
    }
  },
})

// ---

/**
 * DialogPanel组件 - 对话框内容面板
 * 
 * 特点:
 * 1. 阻止点击事件冒泡
 * 2. 自动注册到Dialog上下文
 * 3. 提供ref给父组件
 * 
 * Props:
 * - as: 渲染的元素类型，默认div
 * - id: 元素ID
 */
export let DialogPanel = defineComponent({
  name: 'DialogPanel',
  props: {
    as: { type: [Object, String], default: 'div' },
    id: { type: String, default: () => `headlessui-dialog-panel-${useId()}` },
  },
  setup(props, { attrs, slots, expose }) {
    let api = useDialogContext('DialogPanel')

    expose({ el: api.panelRef, $el: api.panelRef })

    function handleClick(event: MouseEvent) {
      event.stopPropagation()
    }

    return () => {
      let { id, ...theirProps } = props
      let ourProps = {
        id,
        ref: api.panelRef,
        onClick: handleClick,
      }

      return render({
        ourProps,
        theirProps,
        slot: { open: api.dialogState.value === DialogStates.Open },
        attrs,
        slots,
        name: 'DialogPanel',
      })
    }
  },
})

// ---

/**
 * DialogTitle组件 - 对话框标题
 * 
 * 特点:
 * 1. 自动注册ID到Dialog
 * 2. 用于aria-labelledby关联
 * 3. 默认使用h2标签
 * 
 * Props:
 * - as: 渲染的元素类型，默认h2
 * - id: 元素ID
 */
export let DialogTitle = defineComponent({
  name: 'DialogTitle',
  props: {
    as: { type: [Object, String], default: 'h2' },
    id: { type: String, default: () => `headlessui-dialog-title-${useId()}` },
  },
  setup(props, { attrs, slots }) {
    let api = useDialogContext('DialogTitle')

    onMounted(() => {
      api.setTitleId(props.id)
      onUnmounted(() => api.setTitleId(null))
    })

    return () => {
      let { id, ...theirProps } = props
      let ourProps = { id }

      return render({
        ourProps,
        theirProps,
        slot: { open: api.dialogState.value === DialogStates.Open },
        attrs,
        slots,
        name: 'DialogTitle',
      })
    }
  },
})

// ---

/**
 * DialogDescription组件 - 对话框描述文本
 * 由Description组件实现，主要用于提供aria-describedby支持
 */
export let DialogDescription = Description
