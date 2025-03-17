import { Switch } from '@headlessui/react'
import { useState } from 'react'
import { useTheme } from 'next-themes'
import { classNames } from '../../utils/class-names'

/**
 * Switch 组件主题示例
 * 展示如何:
 * 1. 支持亮色/暗色模式
 * 2. 自定义主题色
 * 3. 响应系统主题变化
 */
export default function ThemedSwitch() {
  const [enabled, setEnabled] = useState(false)
  const { theme, setTheme } = useTheme()
  const [color, setColor] = useState('blue')

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

  return (
    <div className="flex h-full w-screen items-start justify-center bg-white dark:bg-gray-900 p-12">
      <div className="w-full max-w-md space-y-8">
        {/* 暗色模式切换 */}
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            暗色模式
          </h3>
          <Switch.Group>
            <div className="flex items-center space-x-4">
              <Switch.Label className="text-gray-700 dark:text-gray-300">
                启用暗色模式
              </Switch.Label>
              <Switch
                checked={theme === 'dark'}
                onChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={classNames(
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2',
                  'focus:ring-blue-500 dark:focus:ring-blue-400',
                  theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200'
                )}
              >
                <span
                  className={classNames(
                    'inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 ease-in-out',
                    theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </Switch>
            </div>
          </Switch.Group>
        </div>

        {/* 主题色选择 */}
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            主题色
          </h3>
          <div className="flex space-x-4">
            {Object.keys(colors).map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={classNames(
                  'h-8 w-8 rounded-full border-2 transition-all',
                  `bg-${c}-500`,
                  color === c
                    ? 'border-gray-900 dark:border-white scale-110'
                    : 'border-transparent'
                )}
              />
            ))}
          </div>
        </div>

        {/* 主题色应用示例 */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            开关示例
          </h3>
          
          {/* 基础开关 */}
          <Switch.Group>
            <div className="flex items-center space-x-4">
              <Switch.Label className="text-gray-700 dark:text-gray-300">
                基础开关
              </Switch.Label>
              <Switch
                checked={enabled}
                onChange={setEnabled}
                className={classNames(
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2',
                  colors[color].ring,
                  enabled ? colors[color].bg : 'bg-gray-200 dark:bg-gray-700'
                )}
              >
                <span
                  className={classNames(
                    'inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 ease-in-out',
                    enabled ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </Switch>
            </div>
          </Switch.Group>

          {/* 大号开关 */}
          <Switch.Group>
            <div className="flex items-center space-x-4">
              <Switch.Label className="text-gray-700 dark:text-gray-300">
                大号开关
              </Switch.Label>
              <Switch
                checked={enabled}
                onChange={setEnabled}
                className={classNames(
                  'relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2',
                  colors[color].ring,
                  enabled ? colors[color].bg : 'bg-gray-200 dark:bg-gray-700'
                )}
              >
                <span
                  className={classNames(
                    'inline-block h-7 w-7 transform rounded-full bg-white transition duration-200 ease-in-out',
                    enabled ? 'translate-x-6' : 'translate-x-0'
                  )}
                />
              </Switch>
            </div>
          </Switch.Group>

          {/* 带图标开关 */}
          <Switch.Group>
            <div className="flex items-center space-x-4">
              <Switch.Label className="text-gray-700 dark:text-gray-300">
                带图标开关
              </Switch.Label>
              <Switch
                checked={enabled}
                onChange={setEnabled}
                className={classNames(
                  'relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2',
                  colors[color].ring,
                  enabled ? colors[color].bg : 'bg-gray-200 dark:bg-gray-700'
                )}
              >
                <span
                  className={classNames(
                    'relative inline-block h-7 w-7 transform rounded-full bg-white transition duration-200 ease-in-out',
                    enabled ? 'translate-x-6' : 'translate-x-0'
                  )}
                >
                  {/* 开启状态图标 */}
                  <svg
                    className={classNames(
                      'absolute inset-0 h-full w-full p-1 text-blue-600 transition-opacity',
                      enabled ? 'opacity-100' : 'opacity-0'
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {/* 关闭状态图标 */}
                  <svg
                    className={classNames(
                      'absolute inset-0 h-full w-full p-1 text-gray-400 transition-opacity',
                      enabled ? 'opacity-0' : 'opacity-100'
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </span>
              </Switch>
            </div>
          </Switch.Group>
        </div>
      </div>
    </div>
  )
}