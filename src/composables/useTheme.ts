import { readonly, ref } from 'vue'

const STORAGE_KEY = 'aggregation-cloud:theme'
const isDark = ref(false)
let initialized = false

function applyTheme(dark: boolean) {
  isDark.value = dark
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function initializeTheme() {
  if (initialized) return
  initialized = true
  try {
    applyTheme(localStorage.getItem(STORAGE_KEY) === 'dark')
  } catch {
    applyTheme(document.documentElement.classList.contains('dark'))
  }
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) applyTheme(event.newValue === 'dark')
  })
}

export function useTheme() {
  return {
    isDark: readonly(isDark),
    toggleTheme() {
      applyTheme(!isDark.value)
      try {
        localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
      } catch {
        // Restricted storage must not prevent switching the current page.
      }
    },
  }
}
