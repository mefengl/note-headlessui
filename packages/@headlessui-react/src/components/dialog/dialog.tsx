/**
 * Dialog对话框组件
 * 实现WAI-ARIA对话框模式：https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/
 * 
 * 主要特性：
 * 1. 完整的WAI-ARIA支持
 * 2. 焦点陷阱和管理
 * 3. 键盘导航(Esc关闭)
 * 4. 点击外部区域关闭
 * 5. 滚动锁定
 * 6. Portal传送门
 * 7. 动画过渡支持
 * 8. 可访问性支持
 * 
 * 核心子组件：
 * - Dialog: 对话框容器
 * - Dialog.Panel: 内容面板
 * - Dialog.Title: 标题
 * - Dialog.Description: 描述文本
 * - Dialog.Backdrop: 背景遮罩
 */

'use client'

// WAI-ARIA: https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/
import React, {
  Fragment,
  createContext,
  createRef,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ContextType,
  type ElementType,
  type MutableRefObject,
  type MouseEvent as ReactMouseEvent,
  type Ref,
  type RefObject,
} from 'react'
import { useEscape } from '../../hooks/use-escape'
import { useEvent } from '../../hooks/use-event'
import { useId } from '../../hooks/use-id'
import { useInertOthers } from '../../hooks/use-inert-others'
import { useIsTouchDevice } from '../../hooks/use-is-touch-device'
import { useOnDisappear } from '../../hooks/use-on-disappear'
import { useOutsideClick } from '../../hooks/use-outside-click'
import { useOwnerDocument } from '../../hooks/use-owner'
import {
  MainTreeProvider,
  useMainTreeNode,
  useRootContainers,
} from '../../hooks/use-root-containers'
import { useScrollLock } from '../../hooks/use-scroll-lock'
import { useServerHandoffComplete } from '../../hooks/use-server-handoff-complete'
import { useSyncRefs } from '../../hooks/use-sync-refs'
import { CloseProvider } from '../../internal/close-provider'
import { ResetOpenClosedProvider, State, useOpenClosed } from '../../internal/open-closed'
import { ForcePortalRoot } from '../../internal/portal-force-root'
import type { Props } from '../../types'
import { match } from '../../utils/match'
import {
  RenderFeatures,
  forwardRefWithAs,
  useRender,
  type HasDisplayName,
  type PropsForFeatures,
  type RefProp,
} from '../../utils/render'
import {
  Description,
  useDescriptions,
  type _internal_ComponentDescription,
} from '../description/description'
import { FocusTrap, FocusTrapFeatures } from '../focus-trap/focus-trap'
import { Portal, PortalGroup, useNestedPortals } from '../portal/portal'
import { Transition, TransitionChild } from '../transition/transition'

/**
 * 对话框状态枚举
 */
enum DialogStates {
  Open,   // 打开状态
  Closed  // 关闭状态
}

/**
 * 对话框状态定义
 */
interface StateDefinition {
  titleId: string | null          // 标题ID
  panelRef: MutableRefObject<HTMLElement | null>  // 面板DOM引用
}

/**
 * 动作类型枚举
 */
enum ActionTypes {
  SetTitleId,  // 设置标题ID动作
}

/**
 * 动作类型定义
 */
type Actions = { 
  type: ActionTypes.SetTitleId
  id: string | null 
}

/**
 * 状态归约器映射
 * 处理所有可能的状态更新动作
 */
let reducers: {
  [P in ActionTypes]: (
    state: StateDefinition,
    action: Extract<Actions, { type: P }>
  ) => StateDefinition
} = {
  [ActionTypes.SetTitleId](state, action) {
    if (state.titleId === action.id) return state
    return { ...state, titleId: action.id }
  },
}

/**
 * Dialog上下文
 * 在组件树中共享对话框状态和动作
 */
let DialogContext = createContext<
  | [
      {
        dialogState: DialogStates   // 当前状态(开启/关闭)
        unmount: boolean           // 关闭时是否卸载
        close: () => void         // 关闭方法
        setTitleId: (id: string | null) => void  // 设置标题ID
      },
      StateDefinition             // 对话框状态
    ]
  | null
>(null)
DialogContext.displayName = 'DialogContext'

/**
 * Dialog上下文Hook
 * 获取上下文数据,如果不在Dialog内使用会抛出错误
 */
function useDialogContext(component: string) {
  let context = useContext(DialogContext)
  if (context === null) {
    let err = new Error(`<${component} /> is missing a parent <Dialog /> component.`)
    if (Error.captureStackTrace) Error.captureStackTrace(err, useDialogContext)
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

/**
 * Dialog内部实现组件
 * 处理核心逻辑:
 * 1. 状态管理
 * 2. 可访问性
 * 3. 焦点管理
 * 4. 滚动锁定
 * 5. 点击外部关闭
 * 6. Portal渲染
 */
let InternalDialog = forwardRefWithAs(function InternalDialog<
  TTag extends ElementType = typeof DEFAULT_DIALOG_TAG,
>(props: DialogProps<TTag>, ref: Ref<HTMLElement>) {
  let internalId = useId()
  let {
    id = `headlessui-dialog-${internalId}`,
    open,
    onClose,
    initialFocus,
    role = 'dialog',
    autoFocus = true,
    __demoMode = false,
    unmount = false,
    ...theirProps
  } = props

  let didWarnOnRole = useRef(false)

  role = (function () {
    if (role === 'dialog' || role === 'alertdialog') {
      return role
    }

    if (!didWarnOnRole.current) {
      didWarnOnRole.current = true
      console.warn(
        `Invalid role [${role}] passed to <Dialog />. Only \`dialog\` and and \`alertdialog\` are supported. Using \`dialog\` instead.`
      )
    }

    return 'dialog'
  })()

  let usesOpenClosedState = useOpenClosed()
  if (open === undefined && usesOpenClosedState !== null) {
    // Update the `open` prop based on the open closed state
    open = (usesOpenClosedState & State.Open) === State.Open
  }

  let internalDialogRef = useRef<HTMLElement | null>(null)
  let dialogRef = useSyncRefs(internalDialogRef, ref)

  let ownerDocument = useOwnerDocument(internalDialogRef)

  let dialogState = open ? DialogStates.Open : DialogStates.Closed

  let [state, dispatch] = useReducer(stateReducer, {
    titleId: null,
    descriptionId: null,
    panelRef: createRef(),
  } as StateDefinition)

  let close = useEvent(() => onClose(false))

  let setTitleId = useEvent((id: string | null) => dispatch({ type: ActionTypes.SetTitleId, id }))

  let ready = useServerHandoffComplete()
  let enabled = ready ? dialogState === DialogStates.Open : false
  let [portals, PortalWrapper] = useNestedPortals()

  // We use this because reading these values during initial render(s)
  // can result in `null` rather then the actual elements
  // This doesn't happen when using certain components like a
  // `<Dialog.Title>` because they cause the parent to re-render
  let defaultContainer: RefObject<HTMLElement> = {
    get current() {
      return state.panelRef.current ?? internalDialogRef.current
    },
  }

  let mainTreeNode = useMainTreeNode()
  let { resolveContainers: resolveRootContainers } = useRootContainers({
    mainTreeNode,
    portals,
    defaultContainers: [defaultContainer],
  })

  // When the `Dialog` is wrapped in a `Transition` (or another Headless UI component that exposes
  // the OpenClosed state) then we get some information via context about its state. When the
  // `Transition` is about to close, then the `State.Closing` state will be exposed. This allows us
  // to enable/disable certain functionality in the `Dialog` upfront instead of waiting until the
  // `Transition` is done transitioning.
  let isClosing =
    usesOpenClosedState !== null ? (usesOpenClosedState & State.Closing) === State.Closing : false

  // Ensure other elements can't be interacted with
  let inertOthersEnabled = __demoMode ? false : isClosing ? false : enabled
  useInertOthers(inertOthersEnabled, {
    allowed: useEvent(() => [
      // Allow the headlessui-portal of the Dialog to be interactive. This
      // contains the current dialog and the necessary focus guard elements.
      internalDialogRef.current?.closest<HTMLElement>('[data-headlessui-portal]') ?? null,
    ]),
    disallowed: useEvent(() => [
      // Disallow the "main" tree root node
      mainTreeNode?.closest<HTMLElement>('body > *:not(#headlessui-portal-root)') ?? null,
    ]),
  })

  // Close Dialog on outside click
  useOutsideClick(enabled, resolveRootContainers, (event) => {
    event.preventDefault()
    close()
  })

  // Handle `Escape` to close
  useEscape(enabled, ownerDocument?.defaultView, (event) => {
    event.preventDefault()
    event.stopPropagation()

    // Ensure that we blur the current activeElement to prevent maintaining
    // focus and potentially scrolling the page to the end (because the Dialog
    // is rendered in a Portal at the end of the document.body and the browser
    // tries to keep the focused element in view)
    //
    // Typically only happens in Safari.
    if (
      document.activeElement &&
      'blur' in document.activeElement &&
      typeof document.activeElement.blur === 'function'
    ) {
      document.activeElement.blur()
    }

    close()
  })

  // Scroll lock
  let scrollLockEnabled = __demoMode ? false : isClosing ? false : enabled
  useScrollLock(scrollLockEnabled, ownerDocument, resolveRootContainers)

  // Ensure we close the dialog as soon as the dialog itself becomes hidden
  useOnDisappear(enabled, internalDialogRef, close)

  let [describedby, DescriptionProvider] = useDescriptions()

  let contextBag = useMemo<ContextType<typeof DialogContext>>(
    () => [{ dialogState, close, setTitleId, unmount }, state],
    [dialogState, state, close, setTitleId, unmount]
  )

  let slot = useMemo(
    () => ({ open: dialogState === DialogStates.Open }) satisfies DialogRenderPropArg,
    [dialogState]
  )

  let ourProps = {
    ref: dialogRef,
    id,
    role,
    tabIndex: -1,
    'aria-modal': __demoMode ? undefined : dialogState === DialogStates.Open ? true : undefined,
    'aria-labelledby': state.titleId,
    'aria-describedby': describedby,
    unmount,
  }

  let shouldMoveFocusInside = !useIsTouchDevice()
  let focusTrapFeatures = FocusTrapFeatures.None

  if (enabled && !__demoMode) {
    focusTrapFeatures |= FocusTrapFeatures.RestoreFocus
    focusTrapFeatures |= FocusTrapFeatures.TabLock

    if (autoFocus) {
      focusTrapFeatures |= FocusTrapFeatures.AutoFocus
    }

    if (shouldMoveFocusInside) {
      focusTrapFeatures |= FocusTrapFeatures.InitialFocus
    }
  }

  let render = useRender()

  return (
    <ResetOpenClosedProvider>
      <ForcePortalRoot force={true}>
        <Portal>
          <DialogContext.Provider value={contextBag}>
            <PortalGroup target={internalDialogRef}>
              <ForcePortalRoot force={false}>
                <DescriptionProvider slot={slot}>
                  <PortalWrapper>
                    <FocusTrap
                      initialFocus={initialFocus}
                      initialFocusFallback={internalDialogRef}
                      containers={resolveRootContainers}
                      features={focusTrapFeatures}
                    >
                      <CloseProvider value={close}>
                        {render({
                          ourProps,
                          theirProps,
                          slot,
                          defaultTag: DEFAULT_DIALOG_TAG,
                          features: DialogRenderFeatures,
                          visible: dialogState === DialogStates.Open,
                          name: 'Dialog',
                        })}
                      </CloseProvider>
                    </FocusTrap>
                  </PortalWrapper>
                </DescriptionProvider>
              </ForcePortalRoot>
            </PortalGroup>
          </DialogContext.Provider>
        </Portal>
      </ForcePortalRoot>
    </ResetOpenClosedProvider>
  )
})

// ---

/**
 * Dialog组件默认标签
 */
let DEFAULT_DIALOG_TAG = 'div' as const

/**
 * Dialog渲染属性参数
 */
type DialogRenderPropArg = {
  open: boolean  // 是否打开
}

/**
 * Dialog组件控制的aria属性
 */
type DialogPropsWeControl = 
  | 'aria-describedby'  // 描述文本ID
  | 'aria-labelledby'   // 标题ID
  | 'aria-modal'        // 模态框标识

/**
 * Dialog渲染特性
 */
let DialogRenderFeatures = RenderFeatures.RenderStrategy | RenderFeatures.Static

/**
 * Dialog组件属性
 */
export type DialogProps<TTag extends ElementType = typeof DEFAULT_DIALOG_TAG> = Props<
  TTag,
  DialogRenderPropArg,
  DialogPropsWeControl,
  PropsForFeatures<typeof DialogRenderFeatures> & {
    open?: boolean                // 是否打开
    onClose: (value: boolean) => void  // 关闭回调
    initialFocus?: MutableRefObject<HTMLElement | null>  // 初始焦点元素
    role?: 'dialog' | 'alertdialog'  // ARIA角色
    autoFocus?: boolean           // 是否自动聚焦
    transition?: boolean         // 是否启用过渡动画
    __demoMode?: boolean        // 演示模式(禁用某些特性)
  }
>

/**
 * Dialog组件函数实现
 * 处理属性验证和过渡动画集成
 */
function DialogFn<TTag extends ElementType = typeof DEFAULT_DIALOG_TAG>(
  props: DialogProps<TTag>,
  ref: Ref<HTMLElement>
) {
  let { transition = false, open, ...rest } = props

  // Validations
  let usesOpenClosedState = useOpenClosed()
  let hasOpen = props.hasOwnProperty('open') || usesOpenClosedState !== null
  let hasOnClose = props.hasOwnProperty('onClose')

  if (!hasOpen && !hasOnClose) {
    throw new Error(
      `You have to provide an \`open\` and an \`onClose\` prop to the \`Dialog\` component.`
    )
  }

  if (!hasOpen) {
    throw new Error(
      `You provided an \`onClose\` prop to the \`Dialog\`, but forgot an \`open\` prop.`
    )
  }

  if (!hasOnClose) {
    throw new Error(
      `You provided an \`open\` prop to the \`Dialog\`, but forgot an \`onClose\` prop.`
    )
  }

  if (!usesOpenClosedState && typeof props.open !== 'boolean') {
    throw new Error(
      `You provided an \`open\` prop to the \`Dialog\`, but the value is not a boolean. Received: ${props.open}`
    )
  }

  if (typeof props.onClose !== 'function') {
    throw new Error(
      `You provided an \`onClose\` prop to the \`Dialog\`, but the value is not a function. Received: ${props.onClose}`
    )
  }

  if ((open !== undefined || transition) && !rest.static) {
    return (
      <MainTreeProvider>
        <Transition show={open} transition={transition} unmount={rest.unmount}>
          <InternalDialog ref={ref} {...rest} />
        </Transition>
      </MainTreeProvider>
    )
  }

  return (
    <MainTreeProvider>
      <InternalDialog ref={ref} open={open} {...rest} />
    </MainTreeProvider>
  )
}

// --- 

/**
 * Panel(内容面板)组件默认标签
 */
let DEFAULT_PANEL_TAG = 'div' as const

/**
 * Panel渲染属性参数
 */
type PanelRenderPropArg = {
  open: boolean  // 是否打开
}

/**
 * Panel组件属性
 */
export type DialogPanelProps<TTag extends ElementType = typeof DEFAULT_PANEL_TAG> = Props<
  TTag,
  PanelRenderPropArg,
  never,
  { 
    transition?: boolean  // 是否启用过渡动画
  }
>

/**
 * Panel组件实现
 * 提供内容面板容器,处理点击事件冒泡
 */
function PanelFn<TTag extends ElementType = typeof DEFAULT_PANEL_TAG>(
  props: DialogPanelProps<TTag>,
  ref: Ref<HTMLElement>
) {
  let internalId = useId()
  let { id = `headlessui-dialog-panel-${internalId}`, transition = false, ...theirProps } = props
  let [{ dialogState, unmount }, state] = useDialogContext('Dialog.Panel')
  let panelRef = useSyncRefs(ref, state.panelRef)

  let slot = useMemo(
    () => ({ open: dialogState === DialogStates.Open }) satisfies PanelRenderPropArg,
    [dialogState]
  )

  // Prevent the click events inside the Dialog.Panel from bubbling through the React Tree which
  // could submit wrapping <form> elements even if we portalled the Dialog.
  let handleClick = useEvent((event: ReactMouseEvent) => {
    event.stopPropagation()
  })

  let ourProps = {
    ref: panelRef,
    id,
    onClick: handleClick,
  }

  let Wrapper = transition ? TransitionChild : Fragment
  let wrapperProps = transition ? { unmount } : {}

  let render = useRender()

  return (
    <Wrapper {...wrapperProps}>
      {render({
        ourProps,
        theirProps,
        slot,
        defaultTag: DEFAULT_PANEL_TAG,
        name: 'Dialog.Panel',
      })}
    </Wrapper>
  )
}

// ---

/**
 * Backdrop(背景遮罩)组件默认标签
 */
let DEFAULT_BACKDROP_TAG = 'div' as const

/**
 * Backdrop渲染属性参数
 */
type BackdropRenderPropArg = {
  open: boolean  // 是否打开
}

/**
 * Backdrop组件属性
 */
export type DialogBackdropProps<TTag extends ElementType = typeof DEFAULT_BACKDROP_TAG> = Props<
  TTag,
  BackdropRenderPropArg,
  never,
  { 
    transition?: boolean  // 是否启用过渡动画
  }
>

/**
 * Backdrop组件实现
 * 提供背景遮罩层
 */
function BackdropFn<TTag extends ElementType = typeof DEFAULT_BACKDROP_TAG>(
  props: DialogBackdropProps<TTag>,
  ref: Ref<HTMLElement>
) {
  let { transition = false, ...theirProps } = props
  let [{ dialogState, unmount }] = useDialogContext('Dialog.Backdrop')

  let slot = useMemo(
    () => ({ open: dialogState === DialogStates.Open }) satisfies BackdropRenderPropArg,
    [dialogState]
  )

  let ourProps = { ref, 'aria-hidden': true }

  let Wrapper = transition ? TransitionChild : Fragment
  let wrapperProps = transition ? { unmount } : {}

  let render = useRender()

  return (
    <Wrapper {...wrapperProps}>
      {render({
        ourProps,
        theirProps,
        slot,
        defaultTag: DEFAULT_BACKDROP_TAG,
        name: 'Dialog.Backdrop',
      })}
    </Wrapper>
  )
}

// ---

/**
 * Title(标题)组件默认标签
 */
let DEFAULT_TITLE_TAG = 'h2' as const

/**
 * Title渲染属性参数
 */
type TitleRenderPropArg = {
  open: boolean  // 是否打开
}

/**
 * Title组件属性
 */
export type DialogTitleProps<TTag extends ElementType = typeof DEFAULT_TITLE_TAG> = Props<
  TTag,
  TitleRenderPropArg
>

/**
 * Title组件实现
 * 提供对话框标题,自动管理aria-labelledby
 */
function TitleFn<TTag extends ElementType = typeof DEFAULT_TITLE_TAG>(
  props: DialogTitleProps<TTag>,
  ref: Ref<HTMLElement>
) {
  let internalId = useId()
  let { id = `headlessui-dialog-title-${internalId}`, ...theirProps } = props
  let [{ dialogState, setTitleId }] = useDialogContext('Dialog.Title')

  let titleRef = useSyncRefs(ref)

  useEffect(() => {
    setTitleId(id)
    return () => setTitleId(null)
  }, [id, setTitleId])

  let slot = useMemo(
    () => ({ open: dialogState === DialogStates.Open }) satisfies TitleRenderPropArg,
    [dialogState]
  )

  let ourProps = { ref: titleRef, id }

  let render = useRender()

  return render({
    ourProps,
    theirProps,
    slot,
    defaultTag: DEFAULT_TITLE_TAG,
    name: 'Dialog.Title',
  })
}

// ---

/**
 * 组件类型定义和导出
 */
export interface _internal_ComponentDialog extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_DIALOG_TAG>(
    props: DialogProps<TTag> & RefProp<typeof DialogFn>
  ): React.JSX.Element
}

export interface _internal_ComponentDialogPanel extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_PANEL_TAG>(
    props: DialogPanelProps<TTag> & RefProp<typeof PanelFn>
  ): React.JSX.Element
}

export interface _internal_ComponentDialogBackdrop extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_BACKDROP_TAG>(
    props: DialogBackdropProps<TTag> & RefProp<typeof BackdropFn>
  ): React.JSX.Element
}

export interface _internal_ComponentDialogTitle extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_TITLE_TAG>(
    props: DialogTitleProps<TTag> & RefProp<typeof TitleFn>
  ): React.JSX.Element
}

export interface _internal_ComponentDialogDescription extends _internal_ComponentDescription {}

/**
 * 最终导出
 * 提供两种使用方式:
 * 1. 分离组件: <Dialog>, <DialogPanel>, <DialogTitle>, <DialogDescription>
 * 2. 命名空间(已废弃): <Dialog.Panel>, <Dialog.Title>, <Dialog.Description>
 */
let DialogRoot = forwardRefWithAs(DialogFn) as _internal_ComponentDialog
export let DialogPanel = forwardRefWithAs(PanelFn) as _internal_ComponentDialogPanel
export let DialogBackdrop = forwardRefWithAs(BackdropFn) as _internal_ComponentDialogBackdrop
export let DialogTitle = forwardRefWithAs(TitleFn) as _internal_ComponentDialogTitle
/** @deprecated use `<Description>` instead of `<DialogDescription>` */
export let DialogDescription = Description as _internal_ComponentDialogDescription

export let Dialog = Object.assign(DialogRoot, {
  /** @deprecated use `<DialogPanel>` instead of `<Dialog.Panel>` */
  Panel: DialogPanel,
  /** @deprecated use `<DialogTitle>` instead of `<Dialog.Title>` */
  Title: DialogTitle,
  /** @deprecated use `<Description>` instead of `<Dialog.Description>` */
  Description: Description as _internal_ComponentDialogDescription,
})
