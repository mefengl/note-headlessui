<template>
  <div class="flex h-full w-screen items-start justify-center bg-gray-50 p-12">
    <!-- Switch.Group 提供开关组上下文,管理标签关联 -->
    <SwitchGroup as="div" class="flex items-center space-x-4">
      <!-- Switch.Label 为开关提供可访问的标签 -->
      <SwitchLabel>Enable notifications</SwitchLabel>

      <!-- 
        Switch 组件本体
        使用 v-model 进行双向绑定
        使用渲染作用域插槽自定义外观
      -->
      <Switch
        as="button"
        v-model="state"
        :class="resolveSwitchClass({ checked: state })"
        v-slot="{ checked }"
      >
        <span
          class="inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 ease-in-out"
          :class="{ 'translate-x-5': checked, 'translate-x-0': !checked }"
        />
      </Switch>
    </SwitchGroup>
  </div>
</template>

<script>
import { ref } from 'vue'
import { SwitchGroup, Switch, SwitchLabel } from '@headlessui/vue'

// 工具函数:合并 class 名称
function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default {
  // 注册需要的组件
  components: { SwitchGroup, Switch, SwitchLabel },
  
  setup() {
    // 使用 ref 管理开关状态
    let state = ref(false)

    return {
      state,
      // 根据开关状态计算样式类
      resolveSwitchClass({ checked }) {
        return classNames(
          'focus:shadow-outline relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
          checked ? 'bg-indigo-600 hover:bg-indigo-800' : 'bg-gray-200 hover:bg-gray-400'
        )
      },
    }
  },
}
</script>
