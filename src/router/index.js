import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/', name: 'library', component: () => import('../views/LibraryView.vue') },
  { path: '/game/:id', name: 'game-detail', component: () => import('../views/GameDetailView.vue') },
  { path: '/my-games', name: 'my-games', component: () => import('../views/MyGamesView.vue'), meta: { requiresAuth: true } },
  { path: '/users', name: 'users', component: () => import('../views/UsersView.vue'), meta: { requiresAuth: true } },
  { path: '/u/:username', name: 'user-profile', component: () => import('../views/UserProfileView.vue'), meta: { requiresAuth: true } },
  { path: '/import/steam', name: 'steam-import', component: () => import('../views/SteamImportView.vue'), meta: { requiresAuth: true } },
  { path: '/account', name: 'account', component: () => import('../views/AccountView.vue'), meta: { requiresAuth: true } },
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { guestOnly: true } },
  { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue'), meta: { guestOnly: true } },
  { path: '/auth/steam-callback', name: 'steam-callback', component: () => import('../views/SteamCallbackView.vue') },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFoundView.vue') }
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthed) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && auth.isAuthed) {
    return { name: 'my-games' }
  }
  return true
})
