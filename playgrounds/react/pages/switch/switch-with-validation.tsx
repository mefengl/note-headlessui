import { Switch } from '@headlessui/react'
import { useState } from 'react'
import { classNames } from '../../utils/class-names'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

/**
 * 表单验证模式定义
 * 使用 Zod 定义表单字段和验证规则
 */
const formSchema = z.object({
  notifications: z.boolean().refine(val => val === true, {
    message: '必须同意接收通知'
  }),
  terms: z.boolean().refine(val => val === true, {
    message: '必须同意服务条款'
  })
})

type FormValues = z.infer<typeof formSchema>

/**
 * Switch 组件表单验证示例
 * 展示了如何:
 * 1. 集成表单验证库
 * 2. 处理验证错误
 * 3. 自定义错误样式
 */
export default function ValidationExample() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      notifications: false,
      terms: false
    }
  })

  // 监听字段值变化
  const notifications = watch('notifications')
  const terms = watch('terms')

  // 表单提交处理
  const onSubmit = (data: FormValues) => {
    console.log('Form submitted:', data)
  }

  return (
    <div className="flex h-full w-screen items-start justify-center bg-gray-50 p-12">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md space-y-6">
        <div className="space-y-4">
          {/* 通知设置开关 */}
          <div>
            <Switch.Group as="div" className="flex items-center justify-between">
              <div className="flex flex-col items-start">
                <Switch.Label className="text-sm font-medium text-gray-900">
                  启用通知
                </Switch.Label>
                {errors.notifications && (
                  <span className="mt-1 text-xs text-red-500">
                    {errors.notifications.message}
                  </span>
                )}
              </div>

              <Switch
                checked={notifications}
                onChange={val => setValue('notifications', val)}
                className={({ checked }) =>
                  classNames(
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                    checked ? 'bg-blue-600' : 'bg-gray-200',
                    errors.notifications ? 'border-red-500' : ''
                  )
                }
              >
                {({ checked }) => (
                  <span
                    className={classNames(
                      'inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 ease-in-out',
                      checked ? 'translate-x-5' : 'translate-x-0'
                    )}
                  />
                )}
              </Switch>
            </Switch.Group>
          </div>

          {/* 服务条款同意开关 */}
          <div>
            <Switch.Group as="div" className="flex items-center justify-between">
              <div className="flex flex-col items-start">
                <Switch.Label className="text-sm font-medium text-gray-900">
                  同意服务条款
                </Switch.Label>
                {errors.terms && (
                  <span className="mt-1 text-xs text-red-500">
                    {errors.terms.message}
                  </span>
                )}
              </div>

              <Switch
                checked={terms}
                onChange={val => setValue('terms', val)}
                className={({ checked }) =>
                  classNames(
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                    checked ? 'bg-blue-600' : 'bg-gray-200',
                    errors.terms ? 'border-red-500' : ''
                  )
                }
              >
                {({ checked }) => (
                  <span
                    className={classNames(
                      'inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 ease-in-out',
                      checked ? 'translate-x-5' : 'translate-x-0'
                    )}
                  />
                )}
              </Switch>
            </Switch.Group>
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          提交
        </button>
      </form>
    </div>
  )
}