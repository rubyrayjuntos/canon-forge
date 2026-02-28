/**
 * Triggers a browser download for a given URL with the specified filename.
 * Creates a temporary anchor element to initiate the download without navigation.
 */
export const downloadImage = (url: string, filename: string): void => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
