/**
 * Spiceflow entry for the ChatWidget standalone example.
 *
 * Renders a single page with the chat widget pointing at holocron.so,
 * plus a control panel exercising useChatWidget().
 */

import { Spiceflow } from 'spiceflow'
import { Head } from 'spiceflow/react'
import { ChatDemo } from './chat-demo.tsx'

export const app = new Spiceflow()
  .layout('/*', async ({ children }) => {
    return (
      <html lang='en'>
        <Head>
          <Head.Meta charSet='UTF-8' />
          <Head.Meta
            name='viewport'
            content='width=device-width, initial-scale=1'
          />
          <Head.Title>Chat Widget Example</Head.Title>
        </Head>
        <body
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            margin: 0,
            padding: '2rem',
            maxWidth: 720,
            marginInline: 'auto',
            lineHeight: 1.6,
            color: '#1a1a1a',
          }}
        >
          {children}
        </body>
      </html>
    )
  })
  .page('/', async () => {
    return <ChatDemo />
  })
