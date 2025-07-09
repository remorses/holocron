- [x] support for deleting pages using null as value for filesInDraft
- [x] implement deletion of pages, test it
- [x] support for adding new pages during preview, use clientLoader and add the page to the tree. do this based on new pages added to `filesInDraft` that are not in the current loader tree.
- [ ] support changing and adding media files with fumabase cli
- [x] support deleting pages during preview
- [x] when syncing a page and getting the jsx using safe-mdx, when discovering an Image component, if its src is a relative path, save a row `PageMediaAsset` with a connection between a page and a media asset. so during render i can get the image size for the Image component.
-




⏺ Update Todos
  ⎿ ☐ Understand safe-mdx MdastToJsx visitor and how to capture component information
     ☐ Modify sync.ts to capture Image components with relative paths
     ☐ Store PageMediaAsset records in the existing transaction
     ☐ Test the implementation
