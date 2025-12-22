/**
 * Downloads an image from a URL
 * @param url - The URL of the image to download
 * @param filename - The name to save the file as
 */
export function downloadImage(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}

/**
 * Copies text to clipboard
 * @param text - The text to copy
 * @returns Promise that resolves when copy is successful
 * @throws Error if clipboard API is unavailable or permission is denied
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (!navigator.clipboard) {
    throw new Error('Clipboard API not available');
  }
  await navigator.clipboard.writeText(text);
}
