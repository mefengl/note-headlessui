<template>
  <div class="flex h-full w-screen items-start justify-center bg-gray-50 p-12">
    <div class="w-full max-w-md space-y-8">
      <!-- 基础动画开关 -->
      <div class="space-y-2">
        <h3 class="text-lg font-medium">基础动画效果</h3>
        <SwitchGroup>
          <div class="flex items-center space-x-4">
            <SwitchLabel>启用通知</SwitchLabel>
            <Switch
              v-model="enabled"
              :class="[
                'relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                enabled ? 'bg-blue-600' : 'bg-gray-200'
              ]"
            >
              <motion-span
                layout
                class="inline-block h-7 w-7 rounded-full bg-white shadow-lg"
                :initial="{ x: 0 }"
                :animate="{ x: enabled ? 24 : 0 }"
                :transition="{
                  type: 'spring',
                  stiffness: 500,
                  damping: 30
                }"
              />
            </Switch>
          </div>
        </SwitchGroup>
      </div>

      <!-- 高级动画开关 -->
      <div class="space-y-2">
        <h3 class="text-lg font-medium">高级动画效果</h3>
        <SwitchGroup>
          <div class="flex items-center space-x-4">
            <SwitchLabel>启用通知</SwitchLabel>
            <Switch
              v-model="enabled"
              :class="[
                'group relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                enabled ? 'bg-blue-600' : 'bg-gray-200'
              ]"
            >
              <!-- 背景动画 -->
              <motion-div
                class="absolute inset-0 rounded-full"
                :animate="{
                  scale: enabled ? [1, 1.1, 1] : 1
                }"
                :transition="{ duration: 0.3 }"
              />

              <!-- 滑块动画 -->
              <motion-span
                layout
                class="inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition-all duration-300"
                :animate="{
                  x: enabled ? 24 : 0,
                  rotate: enabled ? 180 : 0
                }"
                :transition="{
                  type: 'spring',
                  stiffness: 500,
                  damping: 30
                }"
              >
                <!-- 图标动画 -->
                <motion-svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 m-1.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  :animate="{
                    opacity: enabled ? 1 : 0,
                    scale: enabled ? 1 : 0.5
                  }"
                  :transition="{ duration: 0.2 }"
                >
                  <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </motion-svg>
              </motion-span>
            </Switch>
          </div>
        </SwitchGroup>
      </div>

      <!-- 手势动画开关 -->
      <div class="space-y-2">
        <h3 class="text-lg font-medium">手势动画效果</h3>
        <SwitchGroup>
          <div class="flex items-center space-x-4">
            <SwitchLabel>启用通知</SwitchLabel>
            <motion-div
              :whileHover="{ scale: 1.05 }"
              :whileTap="{ scale: 0.95 }"
            >
              <Switch
                v-model="enabled"
                :class="[
                  'relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  enabled ? 'bg-blue-600' : 'bg-gray-200'
                ]"
              >
                <motion-span
                  layout
                  class="inline-block h-7 w-7 transform rounded-full bg-white shadow-lg"
                  :animate="{ x: enabled ? 24 : 0 }"
                  :transition="{
                    type: 'spring',
                    stiffness: 500,
                    damping: 30
                  }"
                  :whileHover="{ scale: 1.1 }"
                  :whileTap="{ scale: 0.9 }"
                />
              </Switch>
            </motion-div>
          </div>
        </SwitchGroup>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Switch, SwitchGroup, SwitchLabel } from '@headlessui/vue'
import { motion } from 'framer-motion'

// 创建 Framer Motion 组件
const MotionDiv = motion.div
const MotionSpan = motion.span
const MotionSvg = motion.svg

// 开关状态
const enabled = ref(false)
</script>