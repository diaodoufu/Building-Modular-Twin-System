import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../pages/Home.vue'),
    },
    {
      path: '/building/:id',
      name: 'building',
      component: () => import('../pages/Building.vue'),
      props: true,
    },
  ],
})

export default router
