/**
 * Format price as USD currency string
 * @param {number|string|null} price - The price value
 * @returns {string} Formatted price (e.g., "$9.99" or "Free")
 */
export function formatPrice(price) {
  if (price === null || price === undefined || price === '') {
    return 'Free';
  }
  const numeric = Number(price);
  if (Number.isNaN(numeric)) {
    return price;
  }
  return `$${numeric.toFixed(2)}`;
}

/**
 * Format file size in bytes to human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size (e.g., "2.5 GB")
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get file extension from filename
 * @param {string} filename - The filename
 * @returns {string} File extension (e.g., "zip", "exe")
 */
export function getFileExtension(filename) {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}
