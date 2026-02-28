/**
 * Copies text to the system clipboard using the Clipboard API.
 * @returns true if copy succeeded, false if it failed (e.g. no permissions).
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};
