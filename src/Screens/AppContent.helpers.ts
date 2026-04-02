export const formatLastSavedPath = (path: string) => {
  const normalized = path.replace('file://', '');
  const parts = normalized.split('/');
  const fileName = parts[parts.length - 1] ?? normalized;
  return fileName.length > 34 ? `${fileName.slice(0, 34)}...` : fileName;
};

export const toSafeFileName = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9-_]/g, '');

export const getGroupIdForPath = (path: string) => {
  const match = path.match(/scan-(\d+)-(\d+)\.(jpg|jpeg|png)$/i);
  return match ? `batch-${match[1]}` : `single-${path}`;
};
