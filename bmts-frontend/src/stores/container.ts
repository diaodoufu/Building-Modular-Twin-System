import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { containerApi, type ContainerTreeNode, type ContainerRead } from '../api/containers'
import { useAuthStore } from './auth'

export const useContainerStore = defineStore('container', () => {
  const tree = ref<ContainerTreeNode[]>([])
  const selectedContainer = ref<ContainerRead | null>(null)
  const selectedBuilding = ref<ContainerTreeNode | null>(null)
  const selectedFloor = ref<ContainerRead | null>(null)
  const loading = ref(false)

  const orgId = computed(() => {
    const auth = useAuthStore()
    return auth.currentOrgId || ''
  })

  async function fetchTree() {
    if (!orgId.value) return
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
