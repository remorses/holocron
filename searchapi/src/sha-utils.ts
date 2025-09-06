/**
 * Utility functions for computing GitHub-compatible SHA hashes
 * GitHub uses the same algorithm as Git for blob SHA computation:
 * SHA1("blob " + content_length + "\0" + content)
 */

/**
 * Compute SHA-1 hash for a file content using GitHub's blob algorithm
 * @param content The file content as string
 * @returns Promise<string> The SHA-1 hash in hexadecimal format
 */
export async function computeGitBlobSHA(content: string): Promise<string> {
  // Convert content to bytes
  const contentBytes = new TextEncoder().encode(content)
  const contentLength = contentBytes.length

  // Create the Git blob format: "blob {length}\0{content}"
  const header = `blob ${contentLength}\0`
  const headerBytes = new TextEncoder().encode(header)

  // Combine header and content
  const combined = new Uint8Array(headerBytes.length + contentBytes.length)
  combined.set(headerBytes, 0)
  combined.set(contentBytes, headerBytes.length)

  // Compute SHA-1 hash
  const hashBuffer = await crypto.subtle.digest('SHA-1', combined)

  // Convert to hexadecimal string
  const hashArray = new Uint8Array(hashBuffer)
  return Array.from(hashArray)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Verify if a file content matches a given SHA
 * @param content The file content as string
 * @param expectedSHA The expected SHA hash
 * @returns Promise<boolean> True if SHA matches
 */
export async function verifySHA(
  content: string,
  expectedSHA: string,
): Promise<boolean> {
  const computedSHA = await computeGitBlobSHA(content)
  return computedSHA === expectedSHA
}
