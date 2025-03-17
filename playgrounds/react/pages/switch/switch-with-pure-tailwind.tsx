import { Switch } from '@headlessui/react'
import { useState } from 'react'
import { classNames } from '../../utils/class-names'

/**
 * Switch 组件示例
 * 展示了如何使用纯 Tailwind 样式来自定义 Switch 组件的外观
 */
export default function Home() {
  // 使用 useState 管理开关状态
  let [state, setState] = useState(false)

  return (
    <div className="flex h-full w-screen items-start justify-center bg-gray-50 p-12">
      {/* Switch.Group 用于将开关与标签关联 */}
      <Switch.Group as="div" className="flex items-center space-x-4">
        {/* Switch.Label 为开关提供可访问的标签 */}
        <Switch.Label>Enable notifications</Switch.Label>

        {/* Switch 组件本体 */}
        <Switch
          checked={state}
          onChange={setState}
          className={({ checked }) =>
            classNames(
              'focus:shadow-outline relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
              // 根据选中状态动态设置背景色
              checked ? 'bg-indigo-600 hover:bg-indigo-800' : 'bg-gray-200 hover:bg-gray-400'
            )
          }
        >
          {/* 使用渲染函数自定义开关滑块的外观 */}
          {({ checked }) => (
            <span
              className={classNames(
                'inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 ease-in-out',
                // 根据选中状态设置滑块位置
                checked ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          )}
        </Switch>
      </Switch.Group>
    </div>
  )
}
