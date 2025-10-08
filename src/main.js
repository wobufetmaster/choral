import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import CharacterList from './components/CharacterList.vue'
import ChatView from './components/ChatView.vue'
import LorebookManager from './components/LorebookManager.vue'

const routes = [
  { path: '/', component: CharacterList },
  { path: '/chat/:id?', component: ChatView, name: 'chat' },
  { path: '/lorebooks', component: LorebookManager, name: 'lorebooks' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
app.use(router)
app.mount('#app')

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered:', registration)
      })
      .catch(error => {
        console.log('SW registration failed:', error)
      })
  })
}
