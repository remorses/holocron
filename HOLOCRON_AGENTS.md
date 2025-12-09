
To research fumadocs you can fetch https://fumadocs.dev/llms-full.txt

Optionally grep for what you need with curl https://fumadocs.dev/llms-full.txt | grep 'search term'

You can also search for files in the folder fumadocs to do the same thing

the fumadocs repo should be changed as little as possible. NEVER add new code there, unless it is a few lines to make things compile

instead if you want to reuse fumadocs code for complex integrations, copy paste it into docs-website folder instead so we do not depend too much on fumadocs.

when testing docs-website and need to curl a website do not simply use localhost:777. instead first find a host actually used. see docs-dev/holocron.jsonc for domains that can be used like
http://holocron-ysx261dl.localhost:7777

IMPORTANT! http://localhost:777 will show no content but 404! instead use the holocron.jsonc domain!

## updating fumadocs with upstream

we currently keep fumadocs on branch fumabase. every once in a while we must download upastream changes and merge them into fumabase branch. 

to see the current changes that were made to fumadocs read fumadocs/.changeset files. it will tell you changes made including breaking changes

you can also read the various packages folders CHANGELOG.md files. use these to understand what to change to fix tsc errors and such

to do this
- git fetch upstream
- try to merge
- pnpm i on root to install dependencies missing
- resolve conflicts. try to keep fumadocs with as little custom changes as possible

then there is the step of fixing type errors. sometimes the user will update the fumadocs submodule himself, in that case start from here:

- try running pnpm build:pnpm inside fumadocs folder: `pnpm --filter fumadocs-root build:pnpm` this will compile fuamdocs and type check it. 
- if there are type errors here you can try first running pnpm i from repo root (NEVER from fumadocs folder) and deduplicate some packages if needed
- run pnpm typecheck in this repo root t otypecheck code that depends on fumadocs
- try to fix type errors. if there are duplicate packages in node modules that cause them
- NEVER add code inside fumadocs packages. instead read the fumadocs changelogs and understand changes to make to fix tsc errors! this usually means updating code inside docs-website/src

## fumadocs examples

for which components to use for fumadocs take a look at the files

fumadocs/apps/docs/app/docs/[...slug]/page.tsx
fumadocs/packages/create-app/template/react-router/app/docs/page.tsx

...

also look at this file to see how to implement fumadocs vendored styles components, where code is in our folder instead of fumadocs
fumadocs/packages/ui/src/_registry/index.ts
