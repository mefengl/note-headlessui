# 代码阅读推荐顺序

## 核心概念与配置

- [package.json](/package.json)
- [scripts/build.sh](/scripts/build.sh)

## 通用工具与辅助函数

- [packages/@headlessui-react/src/utils/render.ts](/packages/@headlessui-react/src/utils/render.ts)
- [packages/@headlessui-vue/src/utils/render.ts](/packages/@headlessui-vue/src/utils/render.ts)
- [packages/@headlessui-react/src/utils/match.ts](/packages/@headlessui-react/src/utils/match.ts)
- [packages/@headlessui-vue/src/utils/match.ts](/packages/@headlessui-vue/src/utils/match.ts)
- [packages/@headlessui-react/src/utils/focus-management.ts](/packages/@headlessui-react/src/utils/focus-management.ts)
- [packages/@headlessui-vue/src/utils/focus-management.ts](/packages/@headlessui-vue/src/utils/focus-management.ts)

## 核心钩子函数 - React版本

- [packages/@headlessui-react/src/hooks/use-id.ts](/packages/@headlessui-react/src/hooks/use-id.ts)
- [packages/@headlessui-react/src/hooks/use-iso-morphic-effect.ts](/packages/@headlessui-react/src/hooks/use-iso-morphic-effect.ts)
- [packages/@headlessui-react/src/hooks/use-server-handoff-complete.ts](/packages/@headlessui-react/src/hooks/use-server-handoff-complete.ts)
- [packages/@headlessui-react/src/hooks/use-latest-value.ts](/packages/@headlessui-react/src/hooks/use-latest-value.ts)
- [packages/@headlessui-react/src/hooks/use-event.ts](/packages/@headlessui-react/src/hooks/use-event.ts)
- [packages/@headlessui-react/src/hooks/use-sync-refs.ts](/packages/@headlessui-react/src/hooks/use-sync-refs.ts)
- [packages/@headlessui-react/src/hooks/use-disposables.ts](/packages/@headlessui-react/src/hooks/use-disposables.ts)
- [packages/@headlessui-react/src/hooks/use-outside-click.ts](/packages/@headlessui-react/src/hooks/use-outside-click.ts)
- [packages/@headlessui-react/src/hooks/use-root-containers.tsx](/packages/@headlessui-react/src/hooks/use-root-containers.tsx)

## 核心钩子函数 - Vue版本

- [packages/@headlessui-vue/src/hooks/use-id.ts](/packages/@headlessui-vue/src/hooks/use-id.ts)
- [packages/@headlessui-vue/src/hooks/use-event-listener.ts](/packages/@headlessui-vue/src/hooks/use-event-listener.ts)
- [packages/@headlessui-vue/src/hooks/use-root-containers.ts](/packages/@headlessui-vue/src/hooks/use-root-containers.ts)
- [packages/@headlessui-vue/src/hooks/use-text-value.ts](/packages/@headlessui-vue/src/hooks/use-text-value.ts)

## 内部实现和共享组件

- [packages/@headlessui-react/src/internal/hidden.tsx](/packages/@headlessui-react/src/internal/hidden.tsx)
- [packages/@headlessui-vue/src/internal/hidden.ts](/packages/@headlessui-vue/src/internal/hidden.ts)
- [packages/@headlessui-react/src/internal/open-closed.tsx](/packages/@headlessui-react/src/internal/open-closed.tsx)
- [packages/@headlessui-vue/src/internal/open-closed.ts](/packages/@headlessui-vue/src/internal/open-closed.ts)
- [packages/@headlessui-react/src/internal/portal-force-root.tsx](/packages/@headlessui-react/src/internal/portal-force-root.tsx)
- [packages/@headlessui-vue/src/internal/portal-force-root.ts](/packages/@headlessui-vue/src/internal/portal-force-root.ts)
- [packages/@headlessui-react/src/internal/floating.tsx](/packages/@headlessui-react/src/internal/floating.tsx)

## 基础组件 - React版本

- [packages/@headlessui-react/src/components/portal/portal.tsx](/packages/@headlessui-react/src/components/portal/portal.tsx)
- [packages/@headlessui-react/src/components/focus-trap/focus-trap.tsx](/packages/@headlessui-react/src/components/focus-trap/focus-trap.tsx)
- [packages/@headlessui-react/src/components/transition/transition.tsx](/packages/@headlessui-react/src/components/transition/transition.tsx)

## 基础组件 - Vue版本

- [packages/@headlessui-vue/src/components/portal/portal.ts](/packages/@headlessui-vue/src/components/portal/portal.ts)
- [packages/@headlessui-vue/src/components/focus-trap/focus-trap.ts](/packages/@headlessui-vue/src/components/focus-trap/focus-trap.ts)
- [packages/@headlessui-vue/src/components/transitions/transition.ts](/packages/@headlessui-vue/src/components/transitions/transition.ts)

## 交互组件 - React版本

- [packages/@headlessui-react/src/components/menu/menu.tsx](/packages/@headlessui-react/src/components/menu/menu.tsx)
- [packages/@headlessui-react/src/components/listbox/listbox.tsx](/packages/@headlessui-react/src/components/listbox/listbox.tsx)
- [packages/@headlessui-react/src/components/combobox/combobox.tsx](/packages/@headlessui-react/src/components/combobox/combobox.tsx)
- [packages/@headlessui-react/src/components/switch/switch.tsx](/packages/@headlessui-react/src/components/switch/switch.tsx)
- [packages/@headlessui-react/src/components/tabs/tabs.tsx](/packages/@headlessui-react/src/components/tabs/tabs.tsx)
- [packages/@headlessui-react/src/components/dialog/dialog.tsx](/packages/@headlessui-react/src/components/dialog/dialog.tsx)

## 交互组件 - Vue版本

- [packages/@headlessui-vue/src/components/menu/menu.ts](/packages/@headlessui-vue/src/components/menu/menu.ts)
- [packages/@headlessui-vue/src/components/listbox/listbox.ts](/packages/@headlessui-vue/src/components/listbox/listbox.ts)
- [packages/@headlessui-vue/src/components/switch/switch.ts](/packages/@headlessui-vue/src/components/switch/switch.ts)
- [packages/@headlessui-vue/src/components/tabs/tabs.ts](/packages/@headlessui-vue/src/components/tabs/tabs.ts)
- [packages/@headlessui-vue/src/components/dialog/dialog.ts](/packages/@headlessui-vue/src/components/dialog/dialog.ts)

## 导出和入口

- [packages/@headlessui-react/src/index.ts](/packages/@headlessui-react/src/index.ts)
- [packages/@headlessui-vue/src/index.ts](/packages/@headlessui-vue/src/index.ts)

## 示例应用

- [playgrounds/react/pages/_app.tsx](/playgrounds/react/pages/_app.tsx)
- [playgrounds/vue/src/App.vue](/playgrounds/vue/src/App.vue)
- [playgrounds/vue/src/Layout.vue](/playgrounds/vue/src/Layout.vue)
- [playgrounds/react/components/button.tsx](/playgrounds/react/components/button.tsx)

<h3 align="center">
  Headless UI
</h3>

<p align="center">
  A set of completely unstyled, fully accessible UI components, designed to integrate
  beautifully with Tailwind CSS.
</p>

---

## Documentation

For full documentation, visit [headlessui.com](https://headlessui.com).

### Installing the latest version

You can install the latest version by using:

- `npm install @headlessui/react@latest`
- `npm install @headlessui/vue@latest`

### Installing the insiders version

You can install the insiders version (which points to whatever the latest commit on the `main` branch is) by using:

- `npm install @headlessui/react@insiders`
- `npm install @headlessui/vue@insiders`

**Note:** The insiders build doesn't follow semver and therefore doesn't guarantee that the APIs will be the same once they are released.

## Packages

| Name                                                                                                                 |                                                              Version                                                              |                                                              Downloads                                                               |
| :------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------------------------------------: |
| [`@headlessui/react`](https://github.com/tailwindlabs/headlessui/tree/main/packages/%40headlessui-react)             |       [![npm version](https://img.shields.io/npm/v/@headlessui/react.svg)](https://www.npmjs.com/package/@headlessui/react)       |       [![npm downloads](https://img.shields.io/npm/dt/@headlessui/react.svg)](https://www.npmjs.com/package/@headlessui/react)       |
| [`@headlessui/vue`](https://github.com/tailwindlabs/headlessui/tree/main/packages/%40headlessui-vue)                 |         [![npm version](https://img.shields.io/npm/v/@headlessui/vue.svg)](https://www.npmjs.com/package/@headlessui/vue)         |         [![npm downloads](https://img.shields.io/npm/dt/@headlessui/vue.svg)](https://www.npmjs.com/package/@headlessui/vue)         |
| [`@headlessui/tailwindcss`](https://github.com/tailwindlabs/headlessui/tree/main/packages/%40headlessui-tailwindcss) | [![npm version](https://img.shields.io/npm/v/@headlessui/tailwindcss.svg)](https://www.npmjs.com/package/@headlessui/tailwindcss) | [![npm downloads](https://img.shields.io/npm/dt/@headlessui/tailwindcss.svg)](https://www.npmjs.com/package/@headlessui/tailwindcss) |

## Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discuss Headless UI on GitHub](https://github.com/tailwindlabs/headlessui/discussions)

For casual chit-chat with others using the library:

[Join the Tailwind CSS Discord Server](https://discord.gg/7NF8GNe)

## Contributing

If you're interested in contributing to Headless UI, please read our [contributing docs](https://github.com/tailwindlabs/headlessui/blob/main/.github/CONTRIBUTING.md) **before submitting a pull request**.
