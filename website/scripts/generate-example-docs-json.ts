import * as fs from 'fs';
import { dirname, join, relative } from 'path';
import { glob } from 'tinyglobby';
import { fileURLToPath } from 'url';

interface DocFile {
  content: string;
  filePath: string;
  encoding?: 'utf-8' | 'base64';
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
        // For media files, read as base64
        const buffer = fs.readFileSync(filePath);
        const base64Content = buffer.toString('base64');
        return {
          content:base64Content,
          filePath: relativePath,
          encoding: 'base64' as const
        };
      } else {
        // For text files, read contents normally
        const contents = fs.readFileSync(filePath, 'utf-8');
        return {
          content:contents,
          filePath: relativePath
        };
      }
    });

    // Sort by relative path for consistent output
    docFiles.sort((a, b) => a.filePath.localeCompare(b.filePath));

    const jsonOutput = JSON.stringify(docFiles, null, 2);

    fs.writeFileSync(outputPath, jsonOutput, 'utf-8');

    console.log('Generated example-docs.json with', docFiles.length, 'files');
    console.log('Output written to:', outputPath);

    // Print summary of files processed
    console.log('\nProcessed files:');
    docFiles.forEach(file => {
      const sizeInfo = file.encoding === 'base64'
        ? `base64: ${file.content.length} chars`
        : `${file.content.length} chars`;
      console.log(`  - ${file.filePath} (${sizeInfo})`);
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
