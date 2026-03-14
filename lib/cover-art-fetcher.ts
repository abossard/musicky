import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const USER_AGENT = 'Musicky/1.0 (music-management-app)';
const MUSICBRAINZ_BASE = 'https://musicbrainz.org/ws/2/release/';
const CAA_BASE = 'https://coverartarchive.org/release';
const CACHE_DIR = path.resolve('.artwork-cache', 'internet');
const MIN_REQUEST_INTERVAL = 1100; // ms between MusicBrainz requests

let lastRequestTime = 0;

function getCacheKey(artist: string, album: string): string {
  return crypto
    .createHash('md5')
    .update(`${artist}-${album}`.toLowerCase())
    .digest('hex');
}

async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function readFromCache(
  key: string,
): Promise<{ mime: string; buffer: Buffer } | null> {
  try {
    const filePath = path.join(CACHE_DIR, `${key}.jpg`);
    const buffer = await fs.readFile(filePath);
    return { mime: 'image/jpeg', buffer };
  } catch {
    return null;
  }
}

async function writeToCache(key: string, buffer: Buffer): Promise<void> {
  try {
    await ensureCacheDir();
    await fs.writeFile(path.join(CACHE_DIR, `${key}.jpg`), buffer);
  } catch (error) {
    console.warn('[CoverArtFetcher] Failed to write cache:', error);
  }
}

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - elapsed),
    );
  }
  lastRequestTime = Date.now();
  return fetch(url, { headers: { 'User-Agent': USER_AGENT } });
}

async function searchMusicBrainz(
  artist: string,
  album: string,
): Promise<string | null> {
  const query = `artist:${artist}+AND+release:${album}`;
  const url = `${MUSICBRAINZ_BASE}?query=${encodeURI(query)}&fmt=json&limit=1`;

  const response = await rateLimitedFetch(url);
  if (!response.ok) return null;

  const data = (await response.json()) as {
    releases?: { id: string }[];
  };
  if (!data.releases || data.releases.length === 0) return null;

  return data.releases[0].id;
}

async function fetchCoverImage(
  mbid: string,
): Promise<{ mime: string; buffer: Buffer } | null> {
  const url = `${CAA_BASE}/${mbid}/front-250`;
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow',
  });
  if (!response.ok) return null;

  const arrayBuffer = await response.arrayBuffer();
  return { mime: 'image/jpeg', buffer: Buffer.from(arrayBuffer) };
}

export async function fetchInternetCoverArt(
  artist?: string,
  album?: string,
): Promise<{ mime: string; buffer: Buffer } | null> {
  if (!artist?.trim() || !album?.trim()) return null;

  const cacheKey = getCacheKey(artist, album);

  try {
    const cached = await readFromCache(cacheKey);
    if (cached) return cached;
  } catch {
    // Cache miss, proceed to network
  }

  try {
    const mbid = await searchMusicBrainz(artist, album);
    if (!mbid) return null;

    const result = await fetchCoverImage(mbid);
    if (!result) return null;

    await writeToCache(cacheKey, result.buffer);
    return result;
  } catch {
    return null;
  }
}

export default fetchInternetCoverArt;
