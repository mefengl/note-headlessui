/**
 * portal.ts - 传送门组件（Vue版本）
 * 
 * Portal组件允许将内容渲染到DOM树中的任何位置，常用于：
 * 1. 模态框、弹出层等需要突破父级层叠上下文的场景
 * 2. 确保渲染在页面顶层的场景
 * 3. 避免父级样式影响的场景
 * 
 * 特性：
 * - 支持嵌套使用
 * - 支持SSR
 * - 支持分组管理
 * - 自动管理DOM清理
 * 
 * 使用示例：
 * ```vue
 * <!-- 1. 基础用法 -->
 * <Portal>
 *   <div>这个内容会被渲染到body下的portal-root中</div>
 * </Portal>
 * 
 * <!-- 2. 指定目标容器 -->
 * <PortalGroup :target="targetElement">
 *   <Portal>
 *     <div>这个内容会被渲染到targetElement中</div>
 *   </Portal>
 * </PortalGroup>
 * ```
 */

import {
  Teleport,
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  inject,
  onMounted,
  onUnmounted,
  provide,
  reactive,
  ref,
  watch,
  watchEffect,
  type InjectionKey,
  type PropType,
  type Ref,
} from 'vue'
import { usePortalRoot } from '../../internal/portal-force-root'
import { dom } from '../../utils/dom'
import { getOwnerDocument } from '../../utils/owner'
import { render } from '../../utils/render'

// 用于类型推导
type ContextType<T> = T extends InjectionKey<infer V> ? V : never

/**
 * 获取或创建Portal的根容器
 * 如果已存在id为headlessui-portal-root的元素则返回该元素
 * 否则创建新的div并添加到body中
 */
function getPortalRoot(contextElement?: HTMLElement | null) {
  let ownerDocument = getOwnerDocument(contextElement)
  if (!ownerDocument) {
    if (contextElement === null) {
      return null
    }
    throw new Error(
      `[Headless UI]: Cannot find ownerDocument for contextElement: ${contextElement}`
    )
  }

  let existingRoot = ownerDocument.getElementById('headlessui-portal-root')
  if (existingRoot) return existingRoot

  let root = ownerDocument.createElement('div')
  root.setAttribute('id', 'headlessui-portal-root')
  return ownerDocument.body.appendChild(root)
}

/**
 * Portal组件
 * 将内容传送到指定的DOM节点中
 */
export let Portal = defineComponent({
  name: 'Portal',
  props: {
    as: { type: [Object, String], default: 'div' }, // 渲染的元素类型
  },
  setup(props, { slots, attrs }) {
    let element = ref<HTMLElement | null>(null)
    let ownerDocument = computed(() => getOwnerDocument(element))
    let forcePortalRoot = usePortalRoot()
    let groupContext = inject(PortalGroupContext, null)
    
    // 确定目标渲染容器
    let myTarget = ref(
      forcePortalRoot === true
        ? getPortalRoot(element.value)
        : groupContext == null
          ? getPortalRoot(element.value)
          : groupContext.resolveTarget()
    )

    // SSR相关，确保只在客户端渲染
    let ready = ref(false)
    onMounted(() => {
      ready.value = true
    })

    // 监听分组目标变化
    watchEffect(() => {
      if (forcePortalRoot) return
      if (groupContext == null) return
      myTarget.value = groupContext.resolveTarget()
    })

    // 处理嵌套Portal
    let parent = inject(PortalParentContext, null)
    let didRegister = false
    let instance = getCurrentInstance()
    
    // 注册到父Portal
    watch(element, () => {
      if (didRegister) return
      if (!parent) return
      let domElement = dom(element)
      if (!domElement) return
      onUnmounted(parent.register(domElement), instance)
      didRegister = true
    })

    // 清理工作：当Portal为空时移除容器
    onUnmounted(() => {
      let root = ownerDocument.value?.getElementById('headlessui-portal-root')
      if (!root) return
      if (myTarget.value !== root) return
      if (myTarget.value.children.length <= 0) {
        myTarget.value.parentElement?.removeChild(myTarget.value)
      }
    })

    return () => {
      if (!ready.value) return null
      if (myTarget.value === null) return null

      let ourProps = {
        ref: element,
        'data-headlessui-portal': '',
      }

      return h(
        Teleport,
        { to: myTarget.value },
        render({
          ourProps,
          theirProps: props,
          slot: {},
          attrs,
          slots,
          name: 'Portal',
        })
      )
    }
  },
})

/**
 * Portal父级上下文
 * 用于管理嵌套的Portal实例
 */
let PortalParentContext = Symbol('PortalParentContext') as InjectionKey<{
  register: (portal: HTMLElement) => () => void
  unregister: (portal: HTMLElement) => void
  portals: Ref<HTMLElement[]>
}>

/**
 * 嵌套Portal管理Hook
 * 返回[portals数组, PortalWrapper组件]
 */
export function useNestedPortals() {
  let parent = inject(PortalParentContext, null)
  let portals = ref<HTMLElement[]>([])

  // 注册Portal
  function register(portal: HTMLElement) {
    portals.value.push(portal)
    if (parent) parent.register(portal)
    return () => unregister(portal)
  }

  // 注销Portal
  function unregister(portal: HTMLElement) {
    let idx = portals.value.indexOf(portal)
    if (idx !== -1) portals.value.splice(idx, 1)
    if (parent) parent.unregister(portal)
  }

  let api = {
    register,
    unregister,
    portals,
  } as ContextType<typeof PortalParentContext>

  return [
    portals,
    defineComponent({
      name: 'PortalWrapper',
      setup(_, { slots }) {
        provide(PortalParentContext, api)
        return () => slots.default?.()
      },
    }),
  ] as const
}

/**
 * Portal分组上下文
 * 用于管理一组Portal的目标容器
 */
let PortalGroupContext = Symbol('PortalGroupContext') as InjectionKey<{
  resolveTarget(): HTMLElement | null
}>

/**
 * PortalGroup组件
 * 为一组Portal提供统一的目标容器
 */
export let PortalGroup = defineComponent({
  name: 'PortalGroup',
  props: {
    as: { type: [Object, String], default: 'template' },
    target: { type: Object as PropType<HTMLElement | null>, default: null },
  },
  setup(props, { attrs, slots }) {
    let api = reactive({
      resolveTarget() {
        return props.target
      },
    })

    provide(PortalGroupContext, api)

    return () => {
      let { target: _, ...theirProps } = props
      return render({
        theirProps,
        ourProps: {},
        slot: {},
        attrs,
        slots,
        name: 'PortalGroup',
      })
    }
  },
})
