import {
  Fragment,
  computed,
  defineComponent,
  h,
  inject,
  onMounted,
  provide,
  ref,
  watch,
  type InjectionKey,
  type Ref,
} from 'vue'
import { useControllable } from '../../hooks/use-controllable'
import { useId } from '../../hooks/use-id'
import { useResolveButtonType } from '../../hooks/use-resolve-button-type'
import { Hidden, Features as HiddenFeatures } from '../../internal/hidden'
import { Keys } from '../../keyboard'
import { dom } from '../../utils/dom'
import { attemptSubmit } from '../../utils/form'
import { compact, omit, render } from '../../utils/render'
import { Description, useDescriptions } from '../description/description'
import { Label, useLabels } from '../label/label'

/**
 * Switch组件状态定义
 * 用于在 Switch.Group 中共享状态
 */
type StateDefinition = {
  switchRef: Ref<HTMLButtonElement | null>     // 开关按钮元素引用
  labelledby: Ref<string | undefined>          // aria-labelledby属性值
  describedby: Ref<string | undefined>         // aria-describedby属性值
}

/**
 * Switch Group上下文
 * 用于在组件层级间共享状态
 */
let GroupContext = Symbol('GroupContext') as InjectionKey<StateDefinition>

/**
 * Switch Group组件实现
 * 提供Group上下文支持
 */
export let SwitchGroup = defineComponent({
  name: 'SwitchGroup',
  props: {
    as: { type: [Object, String], default: 'template' }
  },
  setup(props, { slots, attrs }) {
    // 创建共享状态
    let switchRef = ref<StateDefinition['switchRef']['value']>(null)
    
    // Label关联设置
    let labelledby = useLabels({
      name: 'SwitchLabel',
      props: {
        htmlFor: computed(() => switchRef.value?.id),
        onClick(event: MouseEvent & { currentTarget: HTMLElement }) {
          if (!switchRef.value) return
          if (event.currentTarget.tagName === 'LABEL') {
            event.preventDefault()
          }
          switchRef.value.click()
          switchRef.value.focus({ preventScroll: true })
        },
      },
    })

    let describedby = useDescriptions({ name: 'SwitchDescription' })

    let api = { switchRef, labelledby, describedby }

    // 提供上下文
    provide(GroupContext, api)

    return () =>
      render({ theirProps: props, ourProps: {}, slot: {}, slots, attrs, name: 'SwitchGroup' })
  }
})

/**
 * Switch开关组件实现
 * 主要功能:
 * 1. 支持v-model双向绑定
 * 2. 支持表单集成
 * 3. 支持键盘操作
 * 4. 完整的可访问性支持
 * 5. 支持在Group中使用
 */
export let Switch = defineComponent({
  name: 'Switch',
  
  emits: { 'update:modelValue': (_value: boolean) => true },
  
  props: {
    as: { type: [Object, String], default: 'button' },
    modelValue: { type: Boolean, default: undefined },       // v-model绑定值
    defaultChecked: { type: Boolean, optional: true },       // 默认选中状态
    form: { type: String, optional: true },                  // 关联表单ID
    name: { type: String, optional: true },                  // 表单字段名
    value: { type: String, optional: true },                 // 表单提交值
    id: { type: String, default: () => `headlessui-switch-${useId()}` },  // 组件ID
    disabled: { type: Boolean, default: false },             // 禁用状态
    tabIndex: { type: Number, default: 0 },                 // Tab键序号
  },

  setup(props, { emit, attrs, slots, expose }) {
    // 获取Group上下文
    let api = inject(GroupContext, null)

    // 状态管理
    let [checked, theirOnChange] = useControllable(
      computed(() => props.modelValue),
      (value: boolean) => emit('update:modelValue', value),
      computed(() => props.defaultChecked)
    )

    // 状态切换
    function toggle() {
      theirOnChange(!checked.value)
    }

    // 引用处理
    let internalSwitchRef = ref<HTMLButtonElement | null>(null)
    let switchRef = api === null ? internalSwitchRef : api.switchRef
    let type = useResolveButtonType(
      computed(() => ({ as: props.as, type: attrs.type })),
      switchRef
    )

    expose({ el: switchRef, $el: switchRef })

    // 事件处理
    function handleClick(event: MouseEvent) {
      event.preventDefault()
      toggle()
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === Keys.Space) {
        event.preventDefault()
        toggle()
      } else if (event.key === Keys.Enter) {
        attemptSubmit(event.currentTarget as HTMLElement)
      }
    }

    // 阻止Enter键的默认点击行为
    function handleKeyPress(event: KeyboardEvent) {
      event.preventDefault()
    }

    // 表单重置处理
    let form = computed(() => dom(switchRef)?.closest?.('form'))
    onMounted(() => {
      watch(
        [form],
        () => {
          if (!form.value) return
          if (props.defaultChecked === undefined) return

          function handle() {
            theirOnChange(props.defaultChecked)
          }

          form.value.addEventListener('reset', handle)
          return () => {
            form.value?.removeEventListener('reset', handle)
          }
        },
        { immediate: true }
      )
    })

    return () => {
      let { id, name, value, form, tabIndex, ...theirProps } = props
      
      // 渲染属性
      let slot = { checked: checked.value }
      
      // 组件属性
      let ourProps = {
        id,
        ref: switchRef,
        role: 'switch',
        type: type.value,
        tabIndex: tabIndex === -1 ? 0 : tabIndex,
        'aria-checked': checked.value,
        'aria-labelledby': api?.labelledby.value,
        'aria-describedby': api?.describedby.value,
        onClick: handleClick,
        onKeyup: handleKeyUp,
        onKeypress: handleKeyPress,
      }

      return h(Fragment, [
        // 表单集成支持
        name != null && checked.value != null
          ? h(
              Hidden,
              compact({
                features: HiddenFeatures.Hidden,
                as: 'input',
                type: 'checkbox',
                hidden: true,
                readOnly: true,
                checked: checked.value,
                form,
                disabled: theirProps.disabled,
                name,
                value,
              })
            )
          : null,
        // 渲染Switch
        render({
          ourProps,
          theirProps: { ...attrs, ...omit(theirProps, ['modelValue', 'defaultChecked']) },
          slot,
          attrs,
          slots,
          name: 'Switch',
        }),
      ])
    }
  },
})

// 导出组件
export let SwitchLabel = Label
export let SwitchDescription = Description
