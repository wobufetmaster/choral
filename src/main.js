import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import CharacterList from './components/CharacterList.vue'
import ChatView from './components/ChatView.vue'

const routes = [
  { path: '/', component: CharacterList },
  { path: '/chat/:id?', component: ChatView, name: 'chat' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
app.use(router)
app.mount('#app')
