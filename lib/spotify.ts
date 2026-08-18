// Native stub — Spotify is web-only for now.
export interface NowPlaying {
  isPlaying: boolean; trackName: string; artists: string; albumName: string;
  albumArt: string; progressMs: number; durationMs: number; trackId: string; deviceName: string;
}
export interface SpotifyTrack {
  id: string; uri: string; name: string; artists: string; albumArt: string; durationMs: number;
}
export interface SpotifyPlaylist {
  id: string; uri: string; name: string; description: string; art: string; trackCount: number;
}
export interface SpotifyDevice {
  id: string; name: string; type: string; isActive: boolean; volumePct: number;
}
export async function connectSpotify(_id: string): Promise<void> {}
export async function handleSpotifyCallback(): Promise<boolean> { return false; }
export function isSpotifyConnected(): boolean { return false; }
export function disconnectSpotify(): void {}
export async function getNowPlaying(): Promise<NowPlaying | null> { return null; }
export async function play(_ctx?: string, _uri?: string): Promise<boolean> { return false; }
export async function pause(): Promise<boolean> { return false; }
export async function next(): Promise<boolean> { return false; }
export async function previous(): Promise<boolean> { return false; }
export async function setVolume(_pct: number): Promise<boolean> { return false; }
export async function searchTracks(_q: string): Promise<SpotifyTrack[]> { return []; }
export async function searchPlaylists(_q: string): Promise<SpotifyPlaylist[]> { return []; }
export async function getMyPlaylists(): Promise<SpotifyPlaylist[]> { return []; }
export async function getDevices(): Promise<SpotifyDevice[]> { return []; }
