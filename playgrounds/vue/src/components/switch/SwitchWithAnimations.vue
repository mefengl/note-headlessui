<!-- 
  展示 Switch 组件的各种动画效果
  包括:
  1. 基础过渡动画
  2. 弹性动画
  3. 图标动画
  4. 手势动画
-->
<script setup lang="ts">
import { ref } from 'vue'
import { Switch, SwitchLabel } from '@headlessui/vue'
import { useMotion } from '@vueuse/motion'

const enabled = ref(false)
const switchThumb = ref(null)

const motionConfig = {
  initial: { x: 0, scale: 1 },
  enter: { 
    x: enabled.value ? 20 : 0,
    scale: enabled.value ? 1.1 : 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30
    }
  }
}

useMotion(switchThumb, motionConfig)

// 监听状态变化更新动画
watch(enabled, (newValue) => {
  motionConfig.enter.x = newValue ? 20 : 0
  motionConfig.enter.scale = newValue ? 1.1 : 1
})
</script>

<template>
  <div class="flex h-full w-screen items-start justify-center bg-gray-50 p-12">
    <div class="w-full max-w-md space-y-8">
      <!-- 基础动画开关 -->
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-gray-900">基础动画效果</h3>
        <div class="flex items-center space-x-4">
          <SwitchLabel class="text-sm text-gray-700">
            平滑过渡效果
          </SwitchLabel>
          <Switch
            v-model="enabled"
            :class="[
              'relative inline-flex h-6 w-11 cursor-pointer rounded-full',
              'transition-colors duration-200 ease-in-out',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              enabled ? 'bg-blue-600' : 'bg-gray-200'
            ]"
          >
            <span
              ref="switchThumb"
              class="inline-block h-5 w-5 transform rounded-full bg-white"
            />
          </Switch>
        </div>
      </div>

      <!-- 弹性动画开关 -->
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-gray-900">弹性动画效果</h3>
        <div class="flex items-center space-x-4">
          <SwitchLabel class="text-sm text-gray-700">
            弹性过渡效果
          </SwitchLabel>
          <Switch
            v-model="enabled"
            :class="[
              'relative inline-flex h-6 w-11 cursor-pointer rounded-full',
              'transition-colors duration-200 ease-in-out',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              enabled ? 'bg-blue-600' : 'bg-gray-200'
            ]"
          >
            <transition
              enter-active-class="transform transition ease-out duration-200"
              enter-from-class="translate-x-0 scale-95"
              enter-to-class="translate-x-5 scale-100"
              leave-active-class="transform transition ease-in duration-200"
              leave-from-class="translate-x-5 scale-100"
              leave-to-class="translate-x-0 scale-95"
            >
              <span
                class="inline-block h-5 w-5 transform rounded-full bg-white"
                :class="{ 'translate-x-5': enabled }"
              />
            </transition>
          </Switch>
        </div>
      </div>

      <!-- 图标动画开关 -->
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-gray-900">图标动画效果</h3>
        <div class="flex items-center space-x-4">
          <SwitchLabel class="text-sm text-gray-700">
            图标过渡效果
          </SwitchLabel>
          <Switch
            v-model="enabled"
            :class="[
              'relative inline-flex h-8 w-14 cursor-pointer rounded-full',
              'transition-colors duration-200 ease-in-out',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              enabled ? 'bg-blue-600' : 'bg-gray-200'
            ]"
          >
            <transition
              enter-active-class="transform transition ease-out duration-200"
              enter-from-class="translate-x-0 opacity-0"
              enter-to-class="translate-x-6 opacity-100"
              leave-active-class="transform transition ease-in duration-200"
              leave-from-class="translate-x-6 opacity-100"
              leave-to-class="translate-x-0 opacity-0"
            >
              <span
                class="relative inline-block h-7 w-7 transform rounded-full bg-white"
                :class="{ 'translate-x-6': enabled }"
              >
                <svg
                  class="absolute inset-0 h-full w-full p-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  :stroke="enabled ? '#2563eb' : '#9ca3af'"
                >
                  <transition
                    enter-active-class="transition-opacity duration-200 delay-100"
                    enter-from-class="opacity-0"
                    enter-to-class="opacity-100"
                    leave-active-class="transition-opacity duration-200"
                    leave-from-class="opacity-100"
                    leave-to-class="opacity-0"
                  >
                    <path
                      v-if="enabled"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                    <path
                      v-else
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </transition>
                </svg>
              </span>
            </transition>
          </Switch>
        </div>
      </div>
    </div>
  </div>
</template>