This project uses pnpm workspaces to manage dependencies. Important scripts are in the root package.json or various packages package.json

Try to use object arguments for new typescript functions if the function would accept more than one argument, this way you can use the object as a sort of named argument feature, where order of arguments does not matter and it's easier to discover parameters.

try to use early returns and breaks, try nesting code as little as possible, follow the go best practice of if statements: avoid else, nest as little as possible, use top level ifs. minimize nesting.

do not add useless comments if the code is self descriptive. only add comments if requested.

# testing

Use vitest to run tests. Tests should be run from the current package directory and not root, try using the test script instead of vitest directly. Additional vitest flags can be added at the end, like --run to disable watch mode or -u to update snapshots.

To understand how the code you are writing works you should add inline snapshots in the test files with expect().toMatchInlineSnapshot(), then run the test with `pnpm test -u --run` or `pnpm vitest -u --run` to update the snapshot in the file, then read the file again to inspect the result. If the result is not expected, update the code and repeat until the snapshot matches your expectations. Never write the inline snapshots in test files yourself. Just leave them empty and run `pnpm test -u --run` to update them.

> Always call `pnpm vitest` or `pnpm test` with `--run` or they will hang forever waiting for changes!

Never test client React components. Only server code that runs on the server.

Most tests should be simple calls to functions with some expect calls, no mocks. Test files should be called same as the file where the tested function is being exported from.

Tests should strive to be as simple as possible, the best test is a simple `.toMatchInlineSnapshot()` call. These can be easily evaluated reading the test file after the run passing the -u option. You can clearly see from the inline snapshot if the function behaves as expected or not.

Try to use only describe and test in your tests. Do not use beforeAll, before, etc if not strictly required.

NEVER write tests for React components or React hooks. NEVER write tests for React components. You will be fired if you do.

Sometimes tests work directly on database data, using prisma. To run these tests you have to use the package.json script, which will call `doppler run -- vitest` or similar. Never run doppler cli yourself as you could delete or update production data. Tests generally use a staging database instead.

Never write tests yourself that call prisma or interact with database or emails. For these asks the user to write them for you.

# secrets

this project uses Doppler to manage secrets, with a single project with 3 envs: dev, preview and production. dev is the env already selected and implicing in doppler calls.

# website

the website uses react-router v7.

React-router framework is the successor of Remix, it is basically the same framework and it uses loaders and actions as core features.

react-router follows all the conventions of remix but all imports must be updated to point to `react-router` instead of `@remix-run/react` or `@remix-run/node`.

## route file exports

You can export the functions `loader` and `action` to handle loading data and submitting user data.

The default export (not always required for API routes) is the jsx component that renders the page visually.

Notice that the `json` utils was removed from `react-router`, instead there is a function `data` which is very similar and accepts a second argument to add headers and status like `json` does, but it supports more data types than json, like generators, async generators, dates, map, sets, etc.

## Route type safety

react-router exports a `Route` namespace with types like `Route.LoaderArgs`, `Route.ActionArgs` and `Route.ComponentProps`

these types can be used for the main route exports, they must be imported from `./+types/{route-basename}`

For example if the current file is `src/routes/home.tsx` you can import `import { Route } from './+types/home'`.

When using loader data in components it is preferable to use useRouteLoaderData instead of just useLoaderData, so that if the route data is not accessible a error is thrown instead of silently fail with the wrong data.

You can use the Route types even to type other components that rely on `useRouteLoaderData`. But to do this you cannot import from `+types`, only routes files can do that. Instead you should export the Route type from the route file and let the component file import from the route.

Here is an example to get the loader data type safely from a component:

> useRouteLoaderData return type is `Route.componentProps['loaderData']`

```ts
import type { Route } from 'website/src/routes/root'

const { userId } = useRouteLoaderData('root') as Route.componentProps['loaderData']
```

```ts
// this path should export Route first. make sure of that
import type { Route } from 'website/src/routes/org.$orgId'

const { userId } = useRouteLoaderData(
    'routes/org.$orgId',
) as Route.componentProps['loaderData']
```

You can do the same thing with action data, using `Route.componentProps['actionData']`

## links type safety

ALWAYS use the react-router href function to create links, it works as follow

```ts
import { href } from 'react-router'

const path = href('/org/:orgId', { orgId })
```

If you need to have an absolute url you can do `new URL(href('/some/path'), env.PUBLIC_URL)`

The only case where you should not use href is for urls outside of current app or routes like  `routes/$.tsx`, basically routes that match all paths.

## typescript

Always try to use non relative imports, each package has a absolute import with the package name, for example paths inside website can be imported from website. Notice these paths also need to include the src directory.

This is preferable other aliases like @/ because i can easily move the code from one package to another without changing the import paths. This way you can even move a file and import paths do not change much.

## styling

always use tailwind for styling, prefer using simple styles using flex and gap. Margins should be avoided, instead use flexbox gaps, grid gaps, or separate spacing divs.

Use shadcn theme colors instead of tailwind default colors.

Try to keep styles as simple as possible, for breakpoint too.
