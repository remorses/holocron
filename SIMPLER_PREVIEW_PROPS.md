

currently we are handling live preview changes from iframe post messages or websocket messages via zustand state. see docs-state.tsx and useDocsJson() hook

instead i think it would be just better if we used clientLoader for it. this way the components are simplified. they would just read the route data instead of having to do custom logic to check the zustand state for some things

instead the clientLoader would inject fields from the state into the page props. then we would revalidate the page when a websocket message or iframe message comes. this would be debounced to 100ms to make sure we remain performant. and wrapped in react transition to make sure an update can be interrupted and repeated if render lasts more than 100ms

but first. think of what even is the use case of live data props:
- when a new file is added in filesInDraft, we should show this new file in the left tree and source
- when holocron.jsonc changes in filesInDraft we should show the ui updates and also change the tree in cases where tabs changes
- when loader returns 404 now we are calling revalidate() so that we try to get the new file from the chat database data. we currently do this in error boundary. with this new arch we would basically just call serverLoader() in some cases, usually when we need to run code that only runs in the server.


right now we have to call revalidate() when we need to rerun the server loader.
- when a page is deleted
- when a new page is added: because otherwise the error boundary would run, and we cannot render our page component for that case


could we skip these things? we could but then we would need code that parses markdown in the client. which is large and expensive.
