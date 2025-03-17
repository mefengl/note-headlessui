<template>
  <div class="flex h-full w-screen items-start justify-center bg-white dark:bg-gray-900 p-12">
    <div class="w-full max-w-md space-y-8">
      <!-- 暗色模式切换 -->
      <div class="space-y-2">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">暗色模式</h3>
        <SwitchGroup>
          <div class="flex items-center space-x-4">
            <SwitchLabel class="text-gray-700 dark:text-gray-300">
              启用暗色模式
            </SwitchLabel>
            <Switch
              :model-value="isDark"
              @update:model-value="toggleDark"
              :class="[
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2',
                'focus:ring-blue-500 dark:focus:ring-blue-400',
                isDark ? 'bg-blue-600' : 'bg-gray-200'
              ]"
            >
              <span
                :class="[
                  'inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 ease-in-out',
                  isDark ? 'translate-x-5' : 'translate-x-0'
                ]"
              />
            </Switch>
          </div>
        </SwitchGroup>
      </div>

      <!-- 主题色选择 -->
      <div class="space-y-2">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">主题色</h3>
        <div class="flex space-x-4">
          <button
            v-for="c in Object.keys(colors)"
            :key="c"
            @click="color = c"
            :class="[
              'h-8 w-8 rounded-full border-2 transition-all',
              `bg-${c}-500`,
              color === c
                ? 'border-gray-900 dark:border-white scale-110'
                : 'border-transparent'
            ]"
          />
        </div>
      </div>

      <!-- 主题色应用示例 -->
      <div class="space-y-4">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">
          开关示例
        </h3>
        
        <!-- 基础开关 -->
        <SwitchGroup>
          <div class="flex items-center space-x-4">
            <SwitchLabel class="text-gray-700 dark:text-gray-300">
              基础开关
            </SwitchLabel>
            <Switch
              v-model="enabled"
              :class="[
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2',
                colors[color].ring,
                enabled ? colors[color].bg : 'bg-gray-200 dark:bg-gray-700'
              ]"
            >
              <span
                :class="[
                  'inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 ease-in-out',
                  enabled ? 'translate-x-5' : 'translate-x-0'
                ]"
              />
            </Switch>
          </div>
        </SwitchGroup>

        <!-- 大号开关 -->
        <SwitchGroup>
          <div class="flex items-center space-x-4">
            <SwitchLabel class="text-gray-700 dark:text-gray-300">
              大号开关
            </SwitchLabel>
            <Switch
              v-model="enabled"
              :class="[
                'relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2',
                colors[color].ring,
                enabled ? colors[color].bg : 'bg-gray-200 dark:bg-gray-700'
              ]"
            >
              <span
                :class="[
                  'inline-block h-7 w-7 transform rounded-full bg-white transition duration-200 ease-in-out',
                  enabled ? 'translate-x-6' : 'translate-x-0'  
                ]"
              />
            </Switch>
          </div>
        </SwitchGroup>

        <!-- 带图标开关 -->
        <SwitchGroup>
          <div class="flex items-center space-x-4">
            <SwitchLabel class="text-gray-700 dark:text-gray-300">
              带图标开关
            </SwitchLabel>
            <Switch
              v-model="enabled"
              :class="[
                'relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2',
                colors[color].ring,
                enabled ? colors[color].bg : 'bg-gray-200 dark:bg-gray-700'
              ]"
            >
              <span
                :class="[
                  'relative inline-block h-7 w-7 transform rounded-full bg-white transition duration-200 ease-in-out',
                  enabled ? 'translate-x-6' : 'translate-x-0'
                ]"
              >
                <!-- 开启状态图标 -->
                <svg
                  :class="[
                    'absolute inset-0 h-full w-full p-1 text-blue-600 transition-opacity',
                    enabled ? 'opacity-100' : 'opacity-0'
                  ]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <!-- 关闭状态图标 -->
                <svg
                  :class="[
                    'absolute inset-0 h-full w-full p-1 text-gray-400 transition-opacity',
                    enabled ? 'opacity-0' : 'opacity-100'
                  ]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </span>
            </Switch>
          </div>
        </SwitchGroup>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Switch, SwitchGroup, SwitchLabel } from '@headlessui/vue'
import { useDark, useToggle } from '@vueuse/core'

// 暗色模式状态
const isDark = useDark()
const toggleDark = useToggle(isDark)

// 开关状态
const enabled = ref(false)
const color = ref('blue')

// 主题色映射
const colors = {
  blue: {
    bg: 'bg-blue-600 dark:bg-blue-500',
    ring: 'focus:ring-blue-500 dark:focus:ring-blue-400'
  },
  green: {
    bg: 'bg-green-600 dark:bg-green-500',
    ring: 'focus:ring-green-500 dark:focus:ring-green-400'
  },
  purple: {
    bg: 'bg-purple-600 dark:bg-purple-500',
    ring: 'focus:ring-purple-500 dark:focus:ring-purple-400'
  }
}
</script>