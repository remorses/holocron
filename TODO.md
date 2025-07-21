- done. disable submit in contesto if currently generating, enter now submits even if generating.
- disable old messages forms in renderForm. this way there is no risk of having conflicting names in inputs and clicking one does not focus on one before. it also prevents performance issues where there are many forms. also decrease opacity for these old forms and prevent any interaction with them via pointer-events: none.
-





- [x] support for deleting pages using null as value for filesInDraft
- [x] implement deletion of pages, test it
- [x] support for adding new pages during preview, use clientLoader and add the page to the tree. do this based on new pages added to `filesInDraft` that are not in the current loader tree.
- [ ] support changing and adding media files with fumabase cli
- [x] support deleting pages during preview
- [x] when syncing a page and getting the jsx using safe-mdx, when discovering an Image component, if its src is a relative path, save a row `PageMediaAsset` with a connection between a page and a media asset. so during render i can get the image size for the Image component.
-
