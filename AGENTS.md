# package manager: pnpm with workspace

This project uses pnpm workspaces to manage dependencies. Important scripts are in the root package.json or various packages package.json

try to run commands inside the package folder that you are working on. for example you should never run `pnpm test` from the root

# typescript

Try to use object arguments for new typescript functions if the function would accept more than one argument, this way you can use the object as a sort of named argument feature, where order of arguments does not matter and it's easier to discover parameters.

do not add useless comments if the code is self descriptive. only add comments if requested or if this was a change that i asked for, meaning it is not obvious code and needs some inline documentation.

try to use early returns and breaks, try nesting code as little as possible, follow the go best practice of if statements: avoid else, nest as little as possible, use top level ifs. minimize nesting.

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

# react router v7

the website uses react-router v7.

React-router framework is the successor of Remix, it is basically the same framework and it uses loaders and actions as core features.

react-router follows all the conventions of remix but all imports must be updated to point to `react-router` instead of `@remix-run/react` or `@remix-run/node`.

## website routes

website routes use the flat routes filesystem routes, inside src/routes. these files encode the routing logic in the filename, using $id for params and dot . for slashes.

if 2 routes share the same prefix then the loader of both routes is run on a request and the route with the shorter routename is called a layout. a layout can also use <Outlet /> to render the child route inside it. for example /org/x/site will run loaders in `org.$orgid` and `org.$orgid.site`. if you want instead to create a route that is not a layout route, where the loader does not run for routes that share the prefix, append _index to the filename, for example `org.$orgid._index` in the example before.

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

const { userId } = useRouteLoaderData(
    'root',
) as Route.componentProps['loaderData']
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

The only case where you should not use href is for urls outside of current app or routes like `routes/$.tsx`, basically routes that match all paths.

> if you cannot use `href` simply because the route you would like to link to does not exist you should do the following: list all the files in the src/routes folder first, to see if it already exists but not with the name you would expect. If still you can't find one, create a simple placeholder react-router route with a simple Page component and a simple loader that does what you would expect. do not write too much code. you can improve on it in later messages.

## missing routes you would like to redirect to

never redirect or link to a route that does not exist, instead create a simple placeholder route with a simple loader and component instead. then redirect there using type safe path with `href`

if instead it's not clear where to redirect because an user resource is missing, check if an onboarding route exists for that resource or a generic onboarding route. redirect there instead

also keep in mind it's preferable to throw redirects in loaders instead of returning responses, so loader keeps type safety.

## typescript

Always try to use non relative imports, each package has a absolute import with the package name, for example paths inside website can be imported from website. Notice these paths also need to include the src directory.

This is preferable other aliases like @/ because i can easily move the code from one package to another without changing the import paths. This way you can even move a file and import paths do not change much.

## styling

always use tailwind for styling, prefer using simple styles using flex and gap. Margins should be avoided, instead use flexbox gaps, grid gaps, or separate spacing divs.

Use shadcn theme colors instead of tailwind default colors.

Try to keep styles as simple as possible, for breakpoint too.

## components

This project uses shadcn components placed in the website/src/components/ui folder. never add a new shadcn component yourself writing code, instead use the shadcn cli installed locally instead.

Try to reuse these available components when you can, for example for buttons, tooltips, scroll areas, etc.

## client side navigation is preferred

always try use use react-router `useNavigate` or `Link` instead of doing window.location.href update.

so that internal navigation are done client side and are faster. notice that navigate only accepts a relative path and not a full url, so if you have a full url you should do new URL(url).pathname. only use navigate if you know the url is relative to the app.

## calling the server from the client

for simple routes that only have one interaction in the page, for example a form page, you should use react-router forms and actions to interact with the server.

but when you do interactions from a component that can be rendered from multiple routes, or simply is not implemented inside a route page, you should use spiceflow client instead.

the website exposes an API via Spiceflow. here is spiceflow docs: https://getspiceflow.com/

> ALWAYS use the fetch tool to get the latest docs if you need to implement a new route in a Spiceflow API app server or need to add a new rpc call with a spiceflow api client!

Spiceflow has support for client side type safe rpc, use this client when you need to interact with the server from the client, for example for a settings save deep inside a component. here is example usage of it

> SUPER IMPORTANT! if you add a new route to a spiceflow app, use the spiceflow app state like `userId` to add authorization to the route. If there is no state then you can use functions like `getSession({request})` or similar.
> Make sure the current userId has access to the fetched or updated rows. This can be done by checking that the parent row or current row has a relation with the current userId. For example `prisma.site.findFirst({where: {users: {some: {userId }}}})`


## interacting with the database, prisma

this project uses prisma to interact with the database. if you need to add new queries always read the schema.prisma inside the db folder first so you understand the shape of the tables in the database.

never add new tables to the prisma schema, instead ask me to do so.

prisma upsert calls are preferable over updates, so that you also handle the case where the row is missing.

## prisma transactions for complex relations inserts

for very complex updates or inserts that involve more than 3 related tables, for example a Chat with ChatMessages and ChatMessagePath, you should use transaction instead of a super complex single query:

- start a transaction
- delete the parent table, the one with cascade deletes, so that the related tables are also deleted
- recreate all the tables again, reuse the old existing rows data when you don't have all the fields available
- make sure to create all the rows in the related tables. use for loops if necessary

## always make sure use has access to prisma tables

> IMPORTANT! always read the schema.prisma file before adding a new prisma query, to understand how to structure it

try to never write sql by hand, user prisma

if a query becomes too complex because fetching too deeply into related tables (more than 1 `include` nesting), use different queries instead, put them in a Promise.all

##

## concurrency

when doing prisma queries or other async operations try to parallelize them using Promise.all

this will speed up operations that can be done concurrently.

this is especially important in react-router loaders

## security

All loaders, actions and Spiceflow routes of the project should have authorization checks.

These checks should check that the current user, identified by userId, has access to the fetched and updated rows.

This simply mean to always include a check in prisma queries to make sure that the user has access to the updated or queries rows, for example:

```typescript
const resource = await prisma.resource.findFirst({
    where: { resourceId, parentResource: { users: { some: { userId } } } },
})
if (!resource) {
    throw new AppError(`cannot find resource`)
}
```

## errors

if you throw an error that is not unexpected you should use the `AppError` class, this way I can skip sending these errors to Sentry in the `notifyError` function

For example for cases where a resource is not found or user has no subscription.

you can even throw response errors, for example:

```typescript
if (!user.subscription) {
    throw new ResponseError(
        403,
        JSON.stringify({ message: `user has no subscription` }),
    )
}
```
