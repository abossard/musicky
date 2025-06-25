export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatDuration(seconds?: number): string {
  if (typeof seconds !== 'number' || !isFinite(seconds) || isNaN(seconds)) {
    return '—';
  }
  return formatTime(seconds);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

export function formatTrack(track?: { no: number | null; of: number | null }): string {
  if (!track || (!track.no && !track.of)) return '—';
  if (!track.no) return '—';
  if (!track.of) return track.no.toString();
  return `${track.no}/${track.of}`;
}

export function formatGenre(genre?: string[]): string {
  if (!genre || genre.length === 0) return '—';
  return genre.join(', ');
}