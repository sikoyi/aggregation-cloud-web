import { reactive } from 'vue'

export const deploymentState = reactive({
  maintenance: false,
  disconnected: false,
  recovered: false,
  revision: '',
})

export function markDeploymentMaintenance() {
  deploymentState.maintenance = true
  deploymentState.recovered = false
}

export function applyDeploymentStatus(status: { maintenance: boolean; revision: string }) {
  const changed = Boolean(deploymentState.revision && deploymentState.revision !== status.revision)
  if (!status.maintenance && (deploymentState.maintenance || changed)) {
    deploymentState.recovered = true
  }
  deploymentState.maintenance = status.maintenance
  deploymentState.disconnected = false
  deploymentState.revision = status.revision
  if (status.maintenance) deploymentState.recovered = false
}

export function deploymentBlocksWrites() {
  return deploymentState.maintenance || deploymentState.disconnected
}

export function deploymentWriteMessage() {
  return deploymentState.maintenance
    ? '系统正在更新，暂不支持新增、保存和下发；当前编辑内容仍保留在页面中，请等待恢复后重试'
    : '暂时无法确认服务状态，已暂停提交操作；当前编辑内容仍保留在页面中，请等待连接恢复'
}
