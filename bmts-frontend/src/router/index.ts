import { createRouter, createWebHistory } from 'vue-router'
import Home from '../pages/Home.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../pages/Login.vue'),
      meta: { guest: true },
    },
    {
      path: '/',
      name: 'home',
      component: Home,
    },
    {
      path: '/building/:id',
      name: 'building',
      component: () => import('../pages/Building.vue'),
      props: true,
    },
    {
      path: '/campus',
      name: 'campus',
      component: () => import('../pages/Campus.vue'),
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../pages/Admin.vue'),
      meta: { requiresAdmin: true },
    },
    {
      path: '/review',
      name: 'review',
      component: () => import('../pages/Review.vue'),
      meta: { requiresAdmin: true },
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('../pages/Stats.vue'),
    },
    {
      path: '/schema',
      name: 'schema',
      component: () => import('../pages/SchemaDoc.vue'),
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()
  if (!to.meta.guest && !auth.token) {
    next('/login')
  } else if (to.meta.guest && auth.token) {
    next('/')
  } else if (to.meta.requiresAdmin && !auth.isAdmin) {
    next('/')
  } else {
    next()
  }
})

export default router
