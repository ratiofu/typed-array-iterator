import { serve } from 'bun'
import index from './index.html'

const nonce = crypto.randomUUID()

const server = serve({
  routes: {
    // serve index HTML from a secret route
    [`/${nonce}`]: index,
    // for any request, serve HTML with correct headers
    '/*': (): Promise<Response> =>
      fetch(`${server.url}/${nonce}`).then((res) => {
        const { headers } = res
        headers.set('Cross-Origin-Opener-Policy', 'same-origin')
        headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
        // headers.set('Cross-Origin-Resource-Policy', 'unsafe-none');
        return res
      }),
  },
  development: process.env.NODE_ENV !== 'production' && {
    hmr: true,
    console: true,
  },
})

console.log(`🚀 Demo server running at ${server.url}`)
