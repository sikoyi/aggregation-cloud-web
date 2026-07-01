import { createPinia } from 'pinia'
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import { ElMessage } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'

import App from './App.vue'
import { setUnauthorizedHandler } from './api/http'
import { router } from './router'
import { useAuthStore } from './stores/auth'
import './styles.css'

const pinia = createPinia()
const app = createApp(App)

app.use(pinia).use(router).use(ElementPlus, { locale: zhCn })

let sessionExpiredNotifiedAt = 0

setUnauthorizedHandler(() => {
  const auth = useAuthStore()
  const currentRoute = router.currentRoute.value
  const redirect = currentRoute.name === 'login' ? '/' : currentRoute.fullPath

  auth.clearSession()

  if (currentRoute.name !== 'login') {
    router.replace({ name: 'login', query: { redirect } })
  }

  const now = Date.now()
  if (now - sessionExpiredNotifiedAt > 1500) {
    sessionExpiredNotifiedAt = now
    ElMessage.warning('登录状态已过期，请重新登录')
  }
})

app.mount('#app')
