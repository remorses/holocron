import * as fs from 'fs';
import { dirname, join, relative } from 'path';
import { glob } from 'tinyglobby';
import { fileURLToPath } from 'url';

interface DocFile {
  contents: string;
  relativePath: string;
  downloadUrl?: string;
}

async function generateExampleDocsJson() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const exampleDocsDir = join(__dirname, 'example-docs-site');
  const outputPath = join(__dirname, 'example-docs.json');

  try {
    console.log('Reading markdown files from:', exampleDocsDir);

    // Find all .md, .mdx, and media files recursively
    const files = await glob('**/*.{md,mdx,jpg,jpeg,png,gif,bmp,webp,svg,ico,tif,tiff,avif,mp4,mov,avi,wmv,flv,webm,mkv,m4v,3gp,ogg,ogv}', {
      cwd: exampleDocsDir,
      absolute: true
    });

    console.log(`Found ${files.length} files (markdown and media)`);

    // Read contents and create DocFile objects
    const docFiles: DocFile[] = files.map(filePath => {
      const relativePath = relative(exampleDocsDir, filePath);
      const isMediaFile = /\.(jpg|jpeg|png|gif|bmp|webp|svg|ico|tif|tiff|avif|mp4|mov|avi|wmv|flv|webm|mkv|m4v|3gp|ogg|ogv)$/i.test(relativePath);

      if (isMediaFile) {
        // For media files, use empty contents and add downloadUrl
        const baseUrl = 'https://raw.githubusercontent.com';
        const repo = 'remorses/fumabase';
        const branch = 'main';
        const docsPath = 'website/scripts/example-docs-site';
        const downloadUrl = `${baseUrl}/${repo}/${branch}/${docsPath}/${relativePath}`;
        return {
          contents: '',
          relativePath,
          downloadUrl
        };
      } else {
        // For text files, read contents normally
        const contents = fs.readFileSync(filePath, 'utf-8');
        return {
          contents,
          relativePath
        };
      }
    });

    // Sort by relative path for consistent output
    docFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    const jsonOutput = JSON.stringify(docFiles, null, 2);

    fs.writeFileSync(outputPath, jsonOutput, 'utf-8');

    console.log('Generated example-docs.json with', docFiles.length, 'files');
    console.log('Output written to:', outputPath);

    // Print summary of files processed
    console.log('\nProcessed files:');
    docFiles.forEach(file => {
      console.log(`  - ${file.relativePath} (${file.contents.length} chars)`);
    });

  } catch (error) {
    console.error('Error generating example docs JSON:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateExampleDocsJson().catch(console.error);
}

export { generateExampleDocsJson };
