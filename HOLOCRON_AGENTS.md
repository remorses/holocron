
To research fumadocs you can fetch https://fumadocs.dev/llms-full.txt

Optionally grep for what you need with curl https://fumadocs.dev/llms-full.txt | grep 'search term'

You can also search for files in the folder fumadocs to do the same thing

the fumadocs repo should be changed as little as possible. NEVER add new code there, unless it is a few lines to make things compile

instead if you want to reuse fumadocs code for complex integrations, copy paste it into docs-website folder instead so we do not depend too much on fumadocs.

when testing docs-website and need to curl a website do not simply use localhost:777. instead first find a host actually used. see docs-dev/holocron.jsonc for domains that can be used like
http://holocron-ysx261dl.localhost:7777

## updating fumadocs with upstream

we currently keep fumadocs on branch fumabase. every once in a while we must download upastream changes and merge them into fumabase branch. 

to do this
- git fetch upstream
- try to merge
- pnpm i on root to install dependencies missing
- resolve conflicts. try to keep fumadocs with as little custom changes as possible
- try running pnpm build:pnpm inside fumadocs folder `pnpm --filter fumadocs-root build:pnpm `
- run pnpm typecheck in this repo root
- try to fix type errors. if there are duplicate packages in node modules that cause them, fix this first
