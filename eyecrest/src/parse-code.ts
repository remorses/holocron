import jsWasm from "./tree-sitter-javascript.wasm";
import markdownWasm from "./tree-sitter-markdown.wasm";
import coreWasm from "./tree-sitter-core.wasm";

/**
 * Parses code using tree-sitter for the given extension and content.
 * Currently supports JavaScript (.js) and Markdown (.md) files.
 * Returns parsed tree information including AST nodes and s-expression representation.
 */
export async function parseCode({ extension, contents }: { extension: string; contents: string }) {
  // Import tree-sitter
  const { Parser, Language } = await import("web-tree-sitter");

  // Initialize parser with locateFile to provide WASM module directly
  await Parser.init({

    locateFile(path: string) {
      if (path.endsWith('tree-sitter.wasm')) {
        // Return the imported core WASM module
        return coreWasm as any;
      }
      return path;
    }
  });

  const parser = new Parser();

  // Load language based on extension
  let language;
  if (extension === 'js' || extension === 'javascript') {
    language = await Language.load(jsWasm as any);
  } else if (extension === 'md' || extension === 'markdown') {
    language = await Language.load(markdownWasm as any);
  } else {
    throw new Error(`Unsupported file extension: ${extension}. Currently supported: 'js', 'md'`);
  }

  parser.setLanguage(language);

  // Parse the code
  const tree = parser.parse(contents);

  if (!tree) {
    throw new Error("Failed to parse source code");
  }

  // Get the root node
  const rootNode = tree.rootNode;

  // Helper function to convert tree to JSON
  function nodeToJson(node: any): any {
    const children: any[] = [];
    for (let i = 0; i < node.childCount; i++) {
      children.push(nodeToJson(node.child(i)));
    }

    return {
      type: node.type,
      startPosition: node.startPosition,
      endPosition: node.endPosition,
      text: node.text.length < 100 ? node.text : node.text.substring(0, 100) + "...",
      children: children.length > 0 ? children : undefined,
    };
  }

  return {
    success: true,
    message: `${extension} successfully parsed with tree-sitter!`,
    platform: "Cloudflare Workers with @dqbd/web-tree-sitter",
    sourceCode: contents,
    language: extension,
    parseTree: nodeToJson(rootNode),
    sExpression: rootNode.toString(),
    stats: {
      nodeCount: (rootNode as any).descendantCount || "unknown",
    }
  };
}
