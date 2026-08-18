// Native stub — YouTube playback requires web
export interface YTVideo {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}
export async function searchYouTube(_query: string, _apiKey: string): Promise<YTVideo[]> { return []; }
export async function getTrendingMusic(_apiKey: string): Promise<YTVideo[]> { return []; }
export function getYouTubeEmbedUrl(_videoId: string): string { return ''; }
