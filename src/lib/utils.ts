export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terrabyte'] as const;
  const i = Math.max(0, Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1));

  const value = bytes / Math.pow(1024, i);
  return new Intl.NumberFormat('en-US', {
    style: 'unit',
    unit: i === 0 ? 'byte' : units[i].toLowerCase(),
    unitDisplay: 'narrow',
    maximumFractionDigits: 2,
  }).format(value);
}
