import { Switch } from '@headlessui/react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { classNames } from '../../utils/class-names'

/**
 * Switch 组件动画示例
 * 展示了如何:
 * 1. 使用 Framer Motion 添加流畅动画
 * 2. 自定义过渡效果
 * 3. 添加手势动画
 */
export default function AnimatedSwitch() {
  const [enabled, setEnabled] = useState(false)

  return (
    <div className="flex h-full w-screen items-start justify-center bg-gray-50 p-12">
      <div className="w-full max-w-md space-y-8">
        {/* 基础动画开关 */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-900">基础动画效果</h3>
          <Switch.Group>
            <div className="flex items-center space-x-4">
              <Switch.Label className="text-sm text-gray-700">
                平滑过渡效果
              </Switch.Label>
              <Switch
                checked={enabled}
                onChange={setEnabled}
                className={`
                  relative inline-flex h-6 w-11 cursor-pointer rounded-full
                  ${enabled ? 'bg-blue-600' : 'bg-gray-200'}
                  transition-colors duration-200 ease-in-out
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                `}
              >
                <motion.span
                  className="inline-block h-5 w-5 transform rounded-full bg-white"
                  layout
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30
                  }}
                  animate={{
                    x: enabled ? 20 : 0
                  }}
                />
              </Switch>
            </div>
          </Switch.Group>
        </div>

        {/* 弹性动画开关 */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-900">弹性动画效果</h3>
          <Switch.Group>
            <div className="flex items-center space-x-4">
              <Switch.Label className="text-sm text-gray-700">
                弹性过渡效果
              </Switch.Label>
              <Switch
                checked={enabled}
                onChange={setEnabled}
                className={`
                  relative inline-flex h-6 w-11 cursor-pointer rounded-full
                  ${enabled ? 'bg-blue-600' : 'bg-gray-200'}
                  transition-colors duration-200 ease-in-out
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                `}
              >
                <motion.span
                  className="inline-block h-5 w-5 transform rounded-full bg-white"
                  layout
                  transition={{
                    type: "spring",
                    stiffness: 700,
                    damping: 15
                  }}
                  animate={{
                    x: enabled ? 20 : 0,
                    scale: enabled ? 1.1 : 1
                  }}
                  whileTap={{ scale: 0.9 }}
                />
              </Switch>
            </div>
          </Switch.Group>
        </div>

        {/* 带图标动画开关 */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-900">图标动画效果</h3>
          <Switch.Group>
            <div className="flex items-center space-x-4">
              <Switch.Label className="text-sm text-gray-700">
                图标过渡效果
              </Switch.Label>
              <Switch
                checked={enabled}
                onChange={setEnabled}
                className={`
                  relative inline-flex h-8 w-14 cursor-pointer rounded-full
                  ${enabled ? 'bg-blue-600' : 'bg-gray-200'}
                  transition-colors duration-200 ease-in-out
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                `}
              >
                <motion.span
                  className="relative inline-block h-7 w-7 transform rounded-full bg-white"
                  layout
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30
                  }}
                  animate={{
                    x: enabled ? 24 : 0
                  }}
                >
                  <motion.svg
                    className="absolute inset-0 h-full w-full p-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke={enabled ? '#2563eb' : '#9ca3af'}
                    initial={false}
                    animate={{
                      pathLength: 1,
                      opacity: 1
                    }}
                  >
                    {enabled ? (
                      <motion.path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 0.2, delay: 0.1 }}
                      />
                    ) : (
                      <motion.path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 0.2, delay: 0.1 }}
                      />
                    )}
                  </motion.svg>
                </motion.span>
              </Switch>
            </div>
          </Switch.Group>
        </div>

        {/* 手势动画开关 */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-900">手势动画效果</h3>
          <Switch.Group>
            <div className="flex items-center space-x-4">
              <Switch.Label className="text-sm text-gray-700">
                拖拽切换效果
              </Switch.Label>
              <Switch
                checked={enabled}
                onChange={setEnabled}
                className={`
                  relative inline-flex h-8 w-14 cursor-pointer rounded-full
                  ${enabled ? 'bg-blue-600' : 'bg-gray-200'}
                  transition-colors duration-200 ease-in-out
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                `}
              >
                <motion.span
                  className="inline-block h-7 w-7 transform rounded-full bg-white shadow-lg"
                  drag="x"
                  dragConstraints={{
                    left: 0,
                    right: 24
                  }}
                  dragElastic={0.1}
                  dragMomentum={false}
                  onDragEnd={(_, info) => {
                    if (Math.abs(info.offset.x) > 10) {
                      setEnabled(!enabled)
                    }
                  }}
                  animate={{
                    x: enabled ? 24 : 0
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30
                  }}
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                />
              </Switch>
            </div>
          </Switch.Group>
        </div>
      </div>
    </div>
  )
}