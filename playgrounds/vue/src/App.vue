<!--
  App.vue - Headless UI Vue Playground 入口组件
  
  这是Vue示例应用的根组件，提供以下功能：
  1. 布局模式切换：
     - full模式：使用完整布局（默认）
     - raw模式：仅显示路由组件，用于独立组件展示
  2. 开发工具集成：
     - KeyCaster：按键显示工具
     
  使用方式：
  普通访问：完整布局
  ```
  localhost:3000/
  ```
  
  原始模式：不带布局
  ```
  localhost:3000/?layout=raw
  ```
-->

<template>
  <!-- 原始模式：直接渲染路由组件 -->
  <router-view v-if="layout === 'raw'" />
  <!-- 完整模式：使用Layout包装 -->
  <Layout v-else>
    <router-view />
    <KeyCaster />
  </Layout>
</template>

<script>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import KeyCaster from './KeyCaster.vue'
import Layout from './Layout.vue'

export default {
  name: 'App',
  
  components: {
    Layout,    // 布局容器组件
    KeyCaster, // 按键显示组件
  },

  setup() {
    // 从路由获取布局模式
    let route = useRoute()
    let layout = computed(() => route.query['layout'] ?? 'full')

    return {
      layout,
    }
  },
}
</script>
