import type { RouteConfig } from '@react-router/dev/routes'
import { flatRoutes } from '@react-router/fs-routes'

export default flatRoutes().then((fsRoutes) => {
  return [
    ...fsRoutes, //
  ] satisfies RouteConfig
})
