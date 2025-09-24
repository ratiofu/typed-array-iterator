import { createRoot } from 'react-dom/client'
import { App } from './App'

function ensureDivWithId(id: string): HTMLDivElement {
  let element = document.getElementById(id) as HTMLDivElement | null
  if (!element) {
    element = document.createElement('div')
    element.id = id
    document.body.insertBefore(element, null)
  }
  return element
}

const element = ensureDivWithId('root')
const app = <App />

if (element) {
  if (import.meta.hot) {
    const root = (import.meta.hot.data.root ??= createRoot(element))
    root.render(app)
  } else {
    createRoot(element).render(app)
  }
} else {
  alert('Failed to render the app.')
}
