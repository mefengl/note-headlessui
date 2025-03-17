/**
 * Switch开关组件
 * 一个无样式、可访问性强的开关切换组件
 * 
 * 主要功能和特点：
 * 1. 支持受控和非受控两种使用模式
 * 2. 完整的键盘操作支持(空格切换、回车提交)
 * 3. 完整的WAI-ARIA属性支持
 * 4. 支持表单集成
 * 5. 支持禁用状态
 * 6. 支持焦点管理
 * 7. 支持Group分组使用
 * 8. 支持自定义样式
 * 
 * 使用场景：
 * 1. 开关切换设置
 * 2. 表单中的布尔选项
 * 3. 功能的启用/禁用控制
 * 4. 主题切换等
 * 
 * 核心子组件：
 * - Switch：主要开关按钮
 * - Switch.Group：开关按钮组
 * - Switch.Label：关联的标签
 * - Switch.Description：关联的描述
 */

'use client'

import { useFocusRing } from '@react-aria/focus'
import { useHover } from '@react-aria/interactions'
import React, {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type Ref,
} from 'react'
import { useActivePress } from '../../hooks/use-active-press'
import { useControllable } from '../../hooks/use-controllable'
import { useDefaultValue } from '../../hooks/use-default-value'
import { useDisposables } from '../../hooks/use-disposables'
import { useEvent } from '../../hooks/use-event'
import { useId } from '../../hooks/use-id'
import { useResolveButtonType } from '../../hooks/use-resolve-button-type'
import { useSyncRefs } from '../../hooks/use-sync-refs'
import { useDisabled } from '../../internal/disabled'
import { FormFields } from '../../internal/form-fields'
import { useProvidedId } from '../../internal/id'
import type { Props } from '../../types'
import { isDisabledReactIssue7711 } from '../../utils/bugs'
import { attemptSubmit } from '../../utils/form'
import {
  forwardRefWithAs,
  mergeProps,
  useRender,
  type HasDisplayName,
  type RefProp,
} from '../../utils/render'
import {
  Description,
  useDescribedBy,
  useDescriptions,
  type _internal_ComponentDescription,
} from '../description/description'
import { Keys } from '../keyboard'
import { Label, useLabelledBy, useLabels, type _internal_ComponentLabel } from '../label/label'

/**
 * Switch组件状态定义接口
 * 用于在Switch.Group中共享Switch实例的状态
 */
interface StateDefinition {
  switch: HTMLButtonElement | null         // Switch按钮元素引用
  setSwitch(element: HTMLButtonElement): void  // 设置Switch按钮引用的方法
}

/**
 * Switch.Group上下文
 * 用于在组件树中共享Switch状态
 */
let GroupContext = createContext<StateDefinition | null>(null)
GroupContext.displayName = 'GroupContext'

// ---

/**
 * Switch.Group的默认渲染标签
 * 使用Fragment作为默认容器,不引入额外的DOM节点
 */
let DEFAULT_GROUP_TAG = Fragment

/**
 * Switch.Group组件属性类型定义
 */
export type SwitchGroupProps<TTag extends ElementType = typeof DEFAULT_GROUP_TAG> = Props<TTag>

/**
 * Switch.Group组件实现
 * 提供以下功能:
 * 1. 管理Switch实例的状态
 * 2. 提供Label和Description的关联
 * 3. 处理Label的点击事件
 */
function GroupFn<TTag extends ElementType = typeof DEFAULT_GROUP_TAG>(
  props: SwitchGroupProps<TTag>
) {
  let [switchElement, setSwitchElement] = useState<HTMLButtonElement | null>(null)
  let [labelledby, LabelProvider] = useLabels()
  let [describedby, DescriptionProvider] = useDescriptions()

  let context = useMemo<StateDefinition>(
    () => ({ switch: switchElement, setSwitch: setSwitchElement }),
    [switchElement, setSwitchElement]
  )

  let ourProps = {}
  let theirProps = props

  let render = useRender()

  return (
    <DescriptionProvider name="Switch.Description" value={describedby}>
      <LabelProvider
        name="Switch.Label"
        value={labelledby}
        props={{
          htmlFor: context.switch?.id,
          onClick(event: React.MouseEvent<HTMLLabelElement>) {
            if (!switchElement) return
            if (event.currentTarget instanceof HTMLLabelElement) {
              event.preventDefault()
            }
            switchElement.click()
            switchElement.focus({ preventScroll: true })
          },
        }}
      >
        <GroupContext.Provider value={context}>
          {render({
            ourProps,
            theirProps,
            slot: {},
            defaultTag: DEFAULT_GROUP_TAG,
            name: 'Switch.Group',
          })}
        </GroupContext.Provider>
      </LabelProvider>
    </DescriptionProvider>
  )
}

// ---

/**
 * Switch的默认渲染标签
 * 使用button作为开关按钮
 */
let DEFAULT_SWITCH_TAG = 'button' as const

/**
 * Switch渲染属性参数
 * 包含组件的各种状态信息供样式定制使用
 */
type SwitchRenderPropArg = {
  checked: boolean      // 是否选中
  hover: boolean       // 是否处于悬停状态
  focus: boolean       // 是否处于焦点状态
  active: boolean      // 是否处于激活状态
  autofocus: boolean   // 是否自动获得焦点
  changing: boolean    // 是否正在切换状态中
  disabled: boolean    // 是否禁用
}

/**
 * Switch组件需要控制的ARIA属性
 * 用于提供完整的可访问性支持
 */
type SwitchPropsWeControl = 
  | 'aria-checked'     // 开关状态
  | 'aria-describedby' // 描述文本ID
  | 'aria-labelledby'  // 标签文本ID
  | 'role'            // ARIA角色

/**
 * Switch组件属性类型定义
 */
export type SwitchProps<TTag extends ElementType = typeof DEFAULT_SWITCH_TAG> = Props<
  TTag,
  SwitchRenderPropArg,
  SwitchPropsWeControl,
  {
    checked?: boolean              // 受控模式的选中状态
    defaultChecked?: boolean       // 非受控模式的默认选中状态
    onChange?(checked: boolean): void  // 状态改变回调
    name?: string                  // 表单字段名
    value?: string                // 表单提交值
    form?: string                 // 关联表单ID
    autoFocus?: boolean           // 自动聚焦
    disabled?: boolean            // 禁用状态
    tabIndex?: number            // Tab键序号
  }
>

/**
 * Switch组件核心实现
 * 
 * 实现细节：
 * 1. 状态管理：
 *    - 使用useControllable实现受控/非受控模式
 *    - 使用useState管理动画状态
 * 2. 事件处理：
 *    - 处理点击事件
 *    - 处理键盘事件(空格切换、回车提交)
 * 3. 可访问性：
 *    - 完整的ARIA属性支持
 *    - 键盘操作支持
 * 4. 表单集成：
 *    - 支持表单提交和重置
 *    - 支持自定义表单关联
 */
function SwitchFn<TTag extends ElementType = typeof DEFAULT_SWITCH_TAG>(
  props: SwitchProps<TTag>,
  ref: Ref<HTMLButtonElement>
) {
  let internalId = useId()
  let providedId = useProvidedId()
  let providedDisabled = useDisabled()
  
  let {
    id = providedId || `headlessui-switch-${internalId}`,
    disabled = providedDisabled || false,
    checked: controlledChecked,
    defaultChecked: _defaultChecked,
    onChange: controlledOnChange,
    name,
    value,
    form,
    autoFocus = false,
    ...theirProps
  } = props

  let groupContext = useContext(GroupContext)

  // 元素引用管理
  let [switchElement, setSwitchElement] = useState<HTMLButtonElement | null>(null)
  let internalSwitchRef = useRef<HTMLButtonElement | null>(null)
  let switchRef = useSyncRefs(
    internalSwitchRef,
    ref,
    groupContext === null ? null : groupContext.setSwitch,
    setSwitchElement
  )

  // 状态管理
  let defaultChecked = useDefaultValue(_defaultChecked)
  let [checked, onChange] = useControllable(
    controlledChecked,
    controlledOnChange,
    defaultChecked ?? false
  )

  // 动画状态管理
  let d = useDisposables()
  let [changing, setChanging] = useState(false)
  let toggle = useEvent(() => {
    setChanging(true)
    onChange?.(!checked)
    d.nextFrame(() => {
      setChanging(false)
    })
  })

  // 事件处理
  let handleClick = useEvent((event: ReactMouseEvent) => {
    if (isDisabledReactIssue7711(event.currentTarget)) return event.preventDefault()
    event.preventDefault()
    toggle()
  })

  let handleKeyUp = useEvent((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === Keys.Space) {
      event.preventDefault()
      toggle()
    } else if (event.key === Keys.Enter) {
      attemptSubmit(event.currentTarget)
    }
  })

  let handleKeyPress = useEvent((event: ReactKeyboardEvent<HTMLElement>) => event.preventDefault())

  // 可访问性支持
  let labelledBy = useLabelledBy()
  let describedBy = useDescribedBy()

  // 交互状态管理
  let { isFocusVisible: focus, focusProps } = useFocusRing({ autoFocus })
  let { isHovered: hover, hoverProps } = useHover({ isDisabled: disabled })
  let { pressed: active, pressProps } = useActivePress({ disabled })

  // 渲染属性
  let slot = useMemo(() => {
    return {
      checked,
      disabled,
      hover,
      focus,
      active,
      autofocus: autoFocus,
      changing,
    } satisfies SwitchRenderPropArg
  }, [checked, hover, focus, active, disabled, changing, autoFocus])

  // 合并最终属性
  let ourProps = mergeProps(
    {
      id,
      ref: switchRef,
      role: 'switch',
      type: useResolveButtonType(props, switchElement),
      tabIndex: props.tabIndex === -1 ? 0 : props.tabIndex ?? 0,
      'aria-checked': checked,
      'aria-labelledby': labelledBy,
      'aria-describedby': describedBy,
      disabled: disabled || undefined,
      autoFocus,
      onClick: handleClick,
      onKeyUp: handleKeyUp,
      onKeyPress: handleKeyPress,
    },
    focusProps,
    hoverProps,
    pressProps
  )

  // 表单重置处理
  let reset = useCallback(() => {
    if (defaultChecked === undefined) return
    return onChange?.(defaultChecked)
  }, [onChange, defaultChecked])

  let render = useRender()

  return (
    <>
      {name != null && (
        <FormFields
          disabled={disabled}
          data={{ [name]: value || 'on' }}
          overrides={{ type: 'checkbox', checked }}
          form={form}
          onReset={reset}
        />
      )}
      {render({ ourProps, theirProps, slot, defaultTag: DEFAULT_SWITCH_TAG, name: 'Switch' })}
    </>
  )
}

// ---

/**
 * 组件类型定义
 */
export interface _internal_ComponentSwitch extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_SWITCH_TAG>(
    props: SwitchProps<TTag> & RefProp<typeof SwitchFn>
  ): React.JSX.Element
}

export interface _internal_ComponentSwitchGroup extends HasDisplayName {
  <TTag extends ElementType = typeof DEFAULT_GROUP_TAG>(
    props: SwitchGroupProps<TTag> & RefProp<typeof GroupFn>
  ): React.JSX.Element
}

export interface _internal_ComponentSwitchLabel extends _internal_ComponentLabel {}
export interface _internal_ComponentSwitchDescription extends _internal_ComponentDescription {}

let SwitchRoot = forwardRefWithAs(SwitchFn) as _internal_ComponentSwitch

/** @deprecated use `<Field>` instead of `<SwitchGroup>` */
export let SwitchGroup = GroupFn as _internal_ComponentSwitchGroup

/** @deprecated use `<Label>` instead of `<SwitchLabel>` */
export let SwitchLabel = Label as _internal_ComponentSwitchLabel

/** @deprecated use `<Description>` instead of `<SwitchDescription>` */
export let SwitchDescription = Description as _internal_ComponentSwitchDescription

export let Switch = Object.assign(SwitchRoot, {
  /** @deprecated use `<Field>` instead of `<Switch.Group>` */
  Group: SwitchGroup,
  /** @deprecated use `<Label>` instead of `<Switch.Label>` */
  Label: SwitchLabel,
  /** @deprecated use `<Description>` instead of `<Switch.Description>` */
  Description: SwitchDescription,
})
