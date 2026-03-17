/**
 * Downloads an image from a URL
 * @param url - The URL of the image to download (should be a data URL or same-origin URL)
 * @param filename - The name to save the file as
 */
export function downloadImage(url: string, filename: string): void {
  const isDataUrl = url.startsWith('data:');
  const isSameOrigin = url.startsWith(window.location.origin);

  const triggerDownload = (href: string) => {
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    link.click();
  };

  if (isDataUrl || isSameOrigin) {
    triggerDownload(url);
    return;
  }

  // Attempt cross-origin download by fetching a blob
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
      return res.blob();
    })
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      triggerDownload(objectUrl);
      URL.revokeObjectURL(objectUrl);
    })
    .catch((err) => {
      console.error('Download blocked: unable to fetch cross-origin image', err);
    });
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
