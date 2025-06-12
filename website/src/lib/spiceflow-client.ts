import { createSpiceflowClient } from 'spiceflow/client'
import { SpiceflowApp } from './spiceflow'

export const apiClient = createSpiceflowClient<SpiceflowApp>('/', {
    onRequest() {
        return { credentials: 'include' }
    },
})

type x = SpiceflowApp['_routes']['api']['createUploadSignedUrl']['post']['body']
