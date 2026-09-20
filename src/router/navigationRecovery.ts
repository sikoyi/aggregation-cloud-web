import { ElMessage, ElMessageBox } from 'element-plus'
import type { Router } from 'vue-router'

export function handleMenuNavigation(_index: string, _indexPath: string[], _item: unknown, result?: Promise<unknown>) {
  // Element Plus exposes router.push's rejection through select; router.onError presents it.
  void result?.catch(() => undefined)
}

export function isPageLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading (?:CSS )?chunk .+ failed/i.test(message)
}

export function installNavigationRecovery(router: Router) {
  let prompting = false
  router.onError((error) => {
    if (prompting) return
    if (!isPageLoadError(error)) {
      ElMessage.error('页面跳转失败，请稍后重试')
      return
    }
    prompting = true
    void ElMessageBox.confirm(
      '页面文件加载失败，可能是系统已更新或网络中断。重新加载会刷新当前页面，未保存的内容将丢失。',
      '页面加载失败',
      { confirmButtonText: '重新加载', cancelButtonText: '暂不刷新', type: 'warning', closeOnClickModal: false },
    ).then(() => window.location.reload()).catch(() => {
      // Keep the current page and its unsaved state when the operator cancels.
    }).finally(() => { prompting = false })
  })
}
