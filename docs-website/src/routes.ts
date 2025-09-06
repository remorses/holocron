import { route, type RouteConfig } from '@react-router/dev/routes'
import { flatRoutes } from '@react-router/fs-routes'

export default [
  ...(await flatRoutes({
    ignoredRouteFiles: ['**/*-client.tsx'],
  })),
] satisfies RouteConfig
