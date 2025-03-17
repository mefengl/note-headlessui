<template>
  <div class="flex h-full w-screen items-start justify-center bg-gray-50 p-12">
    <div class="w-full max-w-md space-y-8">
      <Form @submit="onSubmit" v-slot="{ errors }">
        <div class="space-y-6">
          <!-- 单个开关验证 -->
          <div class="space-y-2">
            <SwitchGroup>
              <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                  <SwitchLabel class="text-sm font-medium text-gray-900">
                    同意服务条款
                  </SwitchLabel>
                  <ErrorMessage name="terms" v-slot="{ message }">
                    <p class="text-sm text-red-600">{{ message }}</p>
                  </ErrorMessage>
                </div>
                <Field
                  name="terms"
                  type="checkbox"
                  v-slot="{ field }"
                  rules="required"
                >
                  <Switch
                    v-model="field.value"
                    :class="[
                      'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                      field.value ? 'bg-blue-600' : 'bg-gray-200',
                      errors.terms ? 'border-red-500' : ''
                    ]"
                    @update:model-value="field.handleChange"
                  >
                    <span
                      :class="[
                        'inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 ease-in-out',
                        field.value ? 'translate-x-5' : 'translate-x-0'
                      ]"
                    />
                  </Switch>
                </Field>
              </div>
            </SwitchGroup>
          </div>

          <!-- 开关组验证 -->
          <div class="space-y-2">
            <h3 class="text-sm font-medium text-gray-900">通知设置</h3>
            <ErrorMessage name="notifications" v-slot="{ message }">
              <p class="text-sm text-red-600">{{ message }}</p>
            </ErrorMessage>
            <Field
              name="notifications"
              type="checkbox"
              v-slot="{ field }"
              :rules="{ required: true, hasOne: true }"
              :validate-on-input="true"
            >
              <div class="space-y-4" v-model="field.value">
                <SwitchGroup v-for="option in notificationOptions" :key="option.id">
                  <div class="flex items-center justify-between">
                    <div class="space-y-0.5">
                      <SwitchLabel class="text-sm font-medium text-gray-900">
                        {{ option.label }}
                      </SwitchLabel>
                      <p class="text-sm text-gray-500">{{ option.description }}</p>
                    </div>
                    <Switch
                      v-model="field.value[option.id]"
                      :class="[
                        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                        field.value[option.id] ? 'bg-blue-600' : 'bg-gray-200',
                        errors.notifications ? 'border-red-500' : ''
                      ]"
                      @update:model-value="(value) => {
                        field.value[option.id] = value;
                        field.handleChange(field.value);
                      }"
                    >
                      <span
                        :class="[
                          'inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 ease-in-out',
                          field.value[option.id] ? 'translate-x-5' : 'translate-x-0'
                        ]"
                      />
                    </Switch>
                  </div>
                </SwitchGroup>
              </div>
            </Field>
          </div>

          <button
            type="submit"
            class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            保存设置
          </button>
        </div>
      </Form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Switch, SwitchGroup, SwitchLabel } from '@headlessui/vue'
import { Form, Field, ErrorMessage } from 'vee-validate'
import { defineRule } from 'vee-validate'

// 自定义验证规则：至少选中一个选项
defineRule('hasOne', (value) => {
  return Object.values(value).some(v => v) || '请至少选择一个通知选项'
})

// 通知选项配置
const notificationOptions = [
  {
    id: 'email',
    label: '邮件通知',
    description: '接收重要更新和通知的邮件'
  },
  {
    id: 'push',
    label: '推送通知',
    description: '接收实时推送通知'
  },
  {
    id: 'sms',
    label: '短信通知',
    description: '接收短信通知和提醒'
  }
]

// 表单提交处理
const onSubmit = (values) => {
  console.log('Form submitted:', values)
}
</script>