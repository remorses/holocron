import type { RouteConfig } from '@react-router/dev/routes'
import { flatRoutes } from '@react-router/fs-routes'

export default flatRoutes().then((fsRoutes) => {
    return [
        ...fsRoutes, //
        {
            file: './city',
            path: '/city',
            searchParams: {
                searchParam1: true,
            },
        },
    ] satisfies RouteConfig
})
