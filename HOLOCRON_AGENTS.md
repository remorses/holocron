
To research fumadocs you can fetch https://fumadocs.dev/llms-full.txt

Optionally grep for what you need with curl https://fumadocs.dev/llms-full.txt | grep 'search term'

You can also search for files in the folder fumadocs to do the same thing

the fumadocs repo should be changed as little as possible. NEVER add new code there, unless it is a few lines to make things compile

instead if you want to reuse fumadocs code for complex integrations, copy paste it into docs-website folder instead so we do not depend too much on fumadocs.

when testing docs-website and need to curl a website do not simply use localhost:777. instead first find a host actually used. see docs-dev/holocron.jsonc for domains that can be used like holocron-ysx261dl.localhost
