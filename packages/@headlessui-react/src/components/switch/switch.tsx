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
 * Switch 组件的状态定义
 * 用于在 Switch.Group 中共享组件状态
 */
interface StateDefinition {
  switch: HTMLButtonElement | null        // 开关按钮元素引用
  setSwitch(element: HTMLButtonElement): void  // 设置开关按钮的方法
}

/**
 * Switch Group上下文
 * 用于在 Switch.Group 中共享状态
 */
let GroupContext = createContext<StateDefinition | null>(null)
GroupContext.displayName = 'GroupContext'

// ---

/**
 * Switch.Group的默认标签
 */
let DEFAULT_GROUP_TAG = Fragment

/**
 * Switch.Group的属性类型定义
 */
export type SwitchGroupProps<TTag extends ElementType = typeof DEFAULT_GROUP_TAG> = Props<TTag>

/**
 * Switch.Group组件实现
 * 提供开关组上下文,管理Label和Description的关联
 */
function GroupFn<TTag extends ElementType = typeof DEFAULT_GROUP_TAG>(
  props: SwitchGroupProps<TTag>
) {
  let [switchElement, setSwitchElement] = useState<HTMLButtonElement | null>(null)  // 存储Switch实例
  let [labelledby, LabelProvider] = useLabels()  // Label关联
  let [describedby, DescriptionProvider] = useDescriptions()  // Description关联

  // 创建上下文值
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
          // 处理Label点击事件
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
 * Switch组件的默认标签
 */
let DEFAULT_SWITCH_TAG = 'button' as const

/**
 * Switch渲染属性参数
 * 包含开关的各种状态信息
 */
type SwitchRenderPropArg = {
  checked: boolean      // 是否选中
  hover: boolean       // 是否悬停
  focus: boolean       // 是否聚焦
  active: boolean      // 是否激活
  autofocus: boolean   // 是否自动聚焦
  changing: boolean    // 是否正在变化
  disabled: boolean    // 是否禁用
}

/**
 * Switch组件我们控制的aria属性
 */
type SwitchPropsWeControl = 'aria-checked' | 'aria-describedby' | 'aria-labelledby' | 'role'

/**
 * Switch组件属性类型定义
 * 支持受控和非受控模式
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
 * Switch 开关组件核心实现
 * 主要功能:
 * 1. 支持受控和非受控两种模式
 * 2. 集成表单支持
 * 3. 支持键盘操作
 * 4. 完整的可访问性支持
 * 5. 支持在 Group 中使用
 */
function SwitchFn<TTag extends ElementType = typeof DEFAULT_SWITCH_TAG>(
  props: SwitchProps<TTag>,
  ref: Ref<HTMLButtonElement>
) {
  // ID管理
  let internalId = useId()
  let providedId = useProvidedId()
  let providedDisabled = useDisabled()
  
  // 属性处理
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

  // 获取 Group 上下文
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

  // 处理动画状态
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

  // 处理按键事件,阻止默认行为
  let handleKeyPress = useEvent((event: ReactKeyboardEvent<HTMLElement>) => event.preventDefault())

  // 可访问性配置
  let labelledBy = useLabelledBy()
  let describedBy = useDescribedBy()

  // 处理交互状态
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

  // 合并组件属性
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

  // 处理表单重置
  let reset = useCallback(() => {
    if (defaultChecked === undefined) return
    return onChange?.(defaultChecked)
  }, [onChange, defaultChecked])

  let render = useRender()

  return (
    <>
      {/* 表单集成支持 */}
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
