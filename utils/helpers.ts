/**
 * Downloads an image from a URL
 * @param url - The URL of the image to download (should be a data URL or same-origin URL)
 * @param filename - The name to save the file as
 */
export function downloadImage(url: string, filename: string): void {
  // Only allow data URLs or same-origin URLs for security
  if (!url.startsWith('data:') && !url.startsWith(window.location.origin)) {
    console.error('Download blocked: URL must be a data URL or same-origin URL');
    return;
  }
  
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
