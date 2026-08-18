// YouTube Data API v3 + IFrame Player helpers (web only)

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YTVideo {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchYouTube(query: string, apiKey: string): Promise<YTVideo[]> {
  if (!apiKey) throw new Error('No YouTube API key');

  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    videoCategoryId: '10', // Music
    maxResults: '12',
    key: apiKey,
  });

  const res = await fetch(`${YT_API_BASE}/search?${params}`);
  const data = await res.json();

  if (data.error) throw new Error(data.error.message);
  if (!data.items) return [];

  return data.items.map((item: any) => ({
    id: item.id.videoId,
    title: decodeHtmlEntities(item.snippet.title),
    channelTitle: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
  }));
}

// ─── Trending music ───────────────────────────────────────────────────────────

export async function getTrendingMusic(apiKey: string): Promise<YTVideo[]> {
  if (!apiKey) return [];

  const params = new URLSearchParams({
    part: 'snippet',
    chart: 'mostPopular',
    videoCategoryId: '10',
    maxResults: '12',
    regionCode: 'US',
    key: apiKey,
  });

  const res = await fetch(`${YT_API_BASE}/videos?${params}`);
  const data = await res.json();

  if (!data.items) return [];

  return data.items.map((item: any) => ({
    id: item.id,
    title: decodeHtmlEntities(item.snippet.title),
    channelTitle: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
  }));
}

// ─── Embed URL ────────────────────────────────────────────────────────────────

export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function decodeHtmlEntities(str: string): string {
  try {
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  } catch {
    return str;
  }
}
