- connect github repo should be able to create a repo, not only connect existing one.
- every function call upsertFiles internally in the DO should do so using batching instead of passing an infinite amount of files. also the files should not be completely loaded in memory but streamed instead. this is to prevent issues with large files and large number of files. the use of upsertFiles from the api route is fine because teh number of files is already lmited to 100



- add last fetched at column in eyecrest database. this way we will be able to delete unused databases and move them to r2 instead of keeping them in expensive sqlite storage. only do this when there will be actual need for it. because of cost.
- read more about durable objects maximum storage you can use. is eyecrest feasible?
- add replication to eyecrest. add support for adding replication regions. when writing columns i will create a durable object for each region and write to it. the worker will get the closes region for searches.
- when changing replicated regions i will need to add a way to write all existing data there. this should probably be part of more generic functinoality of inserting files. it will be reused for r2 rehydration
-




- done. disable submit in contesto if currently generating, enter now submits even if generating.
- done. disable old messages forms in renderForm. this way there is no risk of having conflicting names in inputs and clicking one does not focus on one before. it also prevents performance issues where there are many forms. also decrease opacity for these old forms and prevent any interaction with them via pointer-events: none.
-





- [x] support for deleting pages using null as value for filesInDraft
- [x] implement deletion of pages, test it
- [x] support for adding new pages during preview, use clientLoader and add the page to the tree. do this based on new pages added to `filesInDraft` that are not in the current loader tree.
- [ ] support changing and adding media files with fumabase cli
- [x] support deleting pages during preview
- [x] when syncing a page and getting the jsx using safe-mdx, when discovering an Image component, if its src is a relative path, save a row `PageMediaAsset` with a connection between a page and a media asset. so during render i can get the image size for the Image component.
-



```
+------------+.-----------+.
|`.          | `.         | `.
|  `+------------+------------+
|   |        |   |        |   |
|   |        |   |        |   |
|   |        |   |        |   |
|   |        |   |        |   |
+---|--------+.--|--------+.  |
|`. |[SERVER]| `.|[SP OS] | `.|
|  `+------------+------------+
|   |        |   |        |   |
|   |        |   |        |   |
|   |        |   |        |   |
|   |        |   |        |   |
+---|--------+.--|--------+.  |
|`. |[STORAGE] `.|[ROT]   | `.|
|  `+------------+------------+
|   |        |   |        |   |
|   |        |   |        |   |
|   |        |   |        |   |
|   |        |   |        |   |
+---|--------+.--|--------+.  |
|`. |[NETWORK] `.|[HOST OS] `.|
|  `+------------+------------+
|   |        |   |        |   |
|   |        |   |        |   |
|   |        |   |        |   |
|   |        |   |        |   |
+---|--------+.--|--------+.  |
 `. |[VIRT]    `.|[POWER]   `.|
   `+------------+------------+
```



```

Fig 1. Conventional Rack
+----------------+.
|`.              | `.
|  `+----------------+
|   |            |   |[SERVER]
|   |────────────────|
|---|-┌──────┐.--+.  |
|   |─┘      └───────|
|   |        |   +---+
|   |        |   |
|   |        |   |
+---|----+.--+.--|.
 `. |    | `.  `.| `.
   `+--------+---+---+
         |   |   |   |[NETWORK]
         |   |   |   |
    +----+.--|---?.  |
    |`.    `.|     `.|
    |  +-----+---+---+
    |  |     |   |[STORAGE]
    |  |     |   |
+---+--|-----+.--|.
|`.  `.|       `.| `.
|  `+--+---------+---+
|   |~> STATUS   |   |[VIRT]
|   |ERROR       |   |
|---|AB-8000-8W--+.  |
|   |  | `.        `.|
|   |  |   +---------+
|   |  |   |
|   |  |   |
+---|--+.  |
 `. |    `.|
   `+------+
```
