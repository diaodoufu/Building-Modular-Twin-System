import { defineStore } from 'pinia'
import { ref } from 'vue'
import { containerApi, type ContainerTreeNode, type ContainerRead } from '../api/containers'

// 临时硬编码org_id，后续从登录用户获取
const DEFAULT_ORG_ID = '4d63c66c-faac-4830-9d6f-3a8fea13b176'

export const useContainerStore = defineStore('container', () => {
  const tree = ref<ContainerTreeNode[]>([])
  const selectedContainer = ref<ContainerRead | null>(null)
  const selectedBuilding = ref<ContainerTreeNode | null>(null)
  const selectedFloor = ref<ContainerRead | null>(null)
  const loading = ref(false)
  const orgId = ref(DEFAULT_ORG_ID)

  async function fetchTree() {
    loading.value = true
    try {
      const { data } = await containerApi.tree(orgId.value)
      tree.value = data
    } finally {
      loading.value = false
    }
  }

  function selectBuilding(building: ContainerTreeNode | null) {
    selectedBuilding.value = building
    selectedFloor.value = null
  }

  function selectFloor(floor: ContainerRead | null) {
    selectedFloor.value = floor
  }

  function selectContainer(container: ContainerRead | null) {
    selectedContainer.value = container
  }

  return {
    tree, selectedContainer, selectedBuilding, selectedFloor, loading, orgId,
    fetchTree, selectBuilding, selectFloor, selectContainer,
  }
})
