/**
 * Switch 开关组件模块
 * 
 * 这是一个完全无样式的开关组件，主要用于实现类似iOS风格的开关按钮。
 * 组件特点：
 * 1. 完全无样式 - 所有外观都由用户自定义
 * 2. 完整的键盘支持 - Space切换状态，Enter触发表单提交
 * 3. 支持表单集成 - 可以在表单中使用并正确提交数据
 * 4. 完整的WAI-ARIA无障碍支持
 * 5. 支持Group模式 - 可以和Label、Description组合使用
 * 
 * 使用示例:
 * ```vue
 * <Switch v-model="enabled" as="button" class="...">
 *   <span>WiFi</span>
 *   <span :class="enabled ? 'translate-x-6' : 'translate-x-0'"/>
 * </Switch>
 * 
 * <!-- 或者使用Group模式 -->
 * <SwitchGroup>
 *   <SwitchLabel>WiFi</SwitchLabel>
 *   <Switch v-model="enabled"/>
 *   <SwitchDescription>启用无线网络连接</SwitchDescription>
 * </SwitchGroup>
 * ```
 */

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
 * 用于在 Switch.Group 中共享状态，实现组件间的协调
 */
type StateDefinition = {
  /** 开关按钮DOM引用，用于控制焦点和触发点击等操作 */
  switchRef: Ref<HTMLButtonElement | null>
  /** WAI-ARIA属性：声明标签ID，用于无障碍识别组件标签 */
  labelledby: Ref<string | undefined>
  /** WAI-ARIA属性：声明描述ID，用于无障碍识别组件描述文本 */
  describedby: Ref<string | undefined>
}

/**
 * Switch Group上下文
 * 使用Vue的inject/provide机制在组件层级间共享状态
 */
let GroupContext = Symbol('GroupContext') as InjectionKey<StateDefinition>

/**
 * Switch Group组件
 * 
 * 用途：
 * 1. 将Switch、Label、Description组合在一起
 * 2. 处理Label的点击事件，自动触发Switch
 * 3. 管理无障碍相关的ARIA属性关联
 * 
 * 原理：
 * 1. 创建共享状态对象
 * 2. 通过provide提供给子组件
 * 3. 处理Label的点击事件代理
 */
export let SwitchGroup = defineComponent({
  name: 'SwitchGroup',
  props: {
    as: { type: [Object, String], default: 'template' }
  },
  setup(props, { slots, attrs }) {
    let switchRef = ref<StateDefinition['switchRef']['value']>(null)
    
    // 设置Label关联，处理点击事件
    let labelledby = useLabels({
      name: 'SwitchLabel',
      props: {
        htmlFor: computed(() => switchRef.value?.id),
        onClick(event: MouseEvent & { currentTarget: HTMLElement }) {
          if (!switchRef.value) return
          // 当点击的是LABEL标签时阻止默认行为(避免触发两次)
          if (event.currentTarget.tagName === 'LABEL') {
            event.preventDefault()
          }
          switchRef.value.click()
          switchRef.value.focus({ preventScroll: true })
        },
      },
    })

    // 设置Description关联
    let describedby = useDescriptions({ name: 'SwitchDescription' })

    // 提供状态给子组件
    let api = { switchRef, labelledby, describedby }
    provide(GroupContext, api)

    return () =>
      render({ theirProps: props, ourProps: {}, slot: {}, slots, attrs, name: 'SwitchGroup' })
  }
})

/**
 * Switch开关组件
 * 
 * 核心功能：
 * 1. 状态管理：支持v-model双向绑定
 * 2. 表单集成：
 *    - 支持form属性关联表单
 *    - 自动生成隐藏的checkbox实现表单提交
 *    - 支持表单reset事件
 * 3. 键盘操作：
 *    - Space：切换开关状态
 *    - Enter：触发表单提交
 * 4. 无障碍支持：
 *    - role="switch"语义化角色
 *    - aria-checked状态提示
 *    - aria-labelledby标签关联
 *    - aria-describedby描述关联
 * 
 * 实现原理：
 * 1. 使用button元素实现可聚焦和键盘操作
 * 2. 在Group模式下共享状态实现组件协作
 * 3. 监听form的reset事件实现表单重置
 * 4. 使用Hidden组件生成隐藏的checkbox实现表单提交
 */
export let Switch = defineComponent({
  name: 'Switch',
  
  emits: { 'update:modelValue': (_value: boolean) => true },
  
  props: {
    as: { type: [Object, String], default: 'button' },
    modelValue: { type: Boolean, default: undefined },
    defaultChecked: { type: Boolean, optional: true },
    form: { type: String, optional: true },
    name: { type: String, optional: true },
    value: { type: String, optional: true },
    id: { type: String, default: () => `headlessui-switch-${useId()}` },
    disabled: { type: Boolean, default: false },
    tabIndex: { type: Number, default: 0 },
  },

  setup(props, { emit, attrs, slots, expose }) {
    // 获取Group上下文(如果在Group中使用)
    let api = inject(GroupContext, null)

    // 状态管理 - 支持受控和非受控模式
    let [checked, theirOnChange] = useControllable(
      computed(() => props.modelValue),
      (value: boolean) => emit('update:modelValue', value),
      computed(() => props.defaultChecked)
    )

    // 切换状态
    function toggle() {
      theirOnChange(!checked.value)
    }

    // 引用处理 - 在Group模式下共享ref
    let internalSwitchRef = ref<HTMLButtonElement | null>(null)
    let switchRef = api === null ? internalSwitchRef : api.switchRef
    
    // 按钮类型处理
    let type = useResolveButtonType(
      computed(() => ({ as: props.as, type: attrs.type })),
      switchRef
    )

    // 暴露组件引用
    expose({ el: switchRef, $el: switchRef })

    // 事件处理函数
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
      
      let slot = { checked: checked.value }
      
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
        // 隐藏的checkbox用于表单提交
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

        // 渲染Switch组件
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

/**
 * 导出辅助组件
 * SwitchLabel - 用于渲染开关标签
 * SwitchDescription - 用于渲染开关描述文本
 */
export let SwitchLabel = Label
export let SwitchDescription = Description
