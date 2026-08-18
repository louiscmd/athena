import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  getNowPlaying, play, pause, next, previous,
  searchTracks, searchPlaylists, getMyPlaylists,
  isSpotifyConnected, getDevices,
} from '@/lib/spotify';
import { Colors, Spacing, Radius } from '@/constants/theme';
import type { NowPlaying, SpotifyTrack, SpotifyPlaylist, SpotifyDevice } from '@/lib/spotify';

type View2 = 'home' | 'search' | 'playlists';

export default function SpotifyScreen() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTracks2, setSearchTracks2] = useState<SpotifyTrack[]>([]);
  const [searchPlaylists2, setSearchPlaylists2] = useState<SpotifyPlaylist[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeView, setActiveView] = useState<View2>('home');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadNowPlaying = useCallback(async () => {
    const np = await getNowPlaying();
    setNowPlaying(np);
  }, []);

  const init = useCallback(async () => {
    const ok = isSpotifyConnected();
    setConnected(ok);
    setLoading(false);
    if (!ok) return;
    const [_, devs, lists] = await Promise.all([
      loadNowPlaying(),
      getDevices(),
      getMyPlaylists(20),
    ]);
    setDevices(devs);
    setPlaylists(lists);
    // Poll now playing every 5s
    pollRef.current = setInterval(loadNowPlaying, 5000);
  }, [loadNowPlaying]);

  useEffect(() => {
    init();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [init]);

  async function handlePlayPause() {
    if (!nowPlaying) return;
    if (nowPlaying.isPlaying) await pause();
    else await play();
    setTimeout(loadNowPlaying, 500);
  }

  async function handleNext() {
    await next();
    setTimeout(loadNowPlaying, 800);
  }

  async function handlePrev() {
    await previous();
    setTimeout(loadNowPlaying, 800);
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const [tracks, lists] = await Promise.all([
      searchTracks(searchQuery, 8),
      searchPlaylists(searchQuery, 6),
    ]);
    setSearchTracks2(tracks);
    setSearchPlaylists2(lists);
    setSearching(false);
  }

  async function handlePlayTrack(uri: string) {
    await play(undefined, uri);
    setTimeout(loadNowPlaying, 800);
  }

  async function handlePlayPlaylist(uri: string) {
    await play(uri);
    setTimeout(loadNowPlaying, 800);
  }

  function fmtTime(ms: number): string {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!loading && !connected) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Spotify</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.notConnectedTitle}>Spotify not connected</Text>
          <Text style={styles.notConnectedSub}>
            Add your Spotify Client ID in Settings, then tap Connect.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/settings')}>
            <Text style={styles.primaryBtnText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const hasNoDevice = connected && !loading && devices.length === 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Spotify</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : (
        <>
          {/* Now Playing */}
          {nowPlaying ? (
            <Animated.View entering={FadeIn} style={styles.nowPlayingCard}>
              {nowPlaying.albumArt ? (
                <Image source={{ uri: nowPlaying.albumArt }} style={styles.albumArt} />
              ) : (
                <View style={[styles.albumArt, styles.albumArtPlaceholder]} />
              )}
              <View style={styles.trackInfo}>
                <Text style={styles.trackName} numberOfLines={1}>{nowPlaying.trackName}</Text>
                <Text style={styles.trackArtist} numberOfLines={1}>{nowPlaying.artists}</Text>
                <Text style={styles.trackAlbum} numberOfLines={1}>{nowPlaying.albumName}</Text>
              </View>

              {/* Progress bar */}
              <View style={styles.progressRow}>
                <Text style={styles.progressTime}>{fmtTime(nowPlaying.progressMs)}</Text>
                <View style={styles.progressBg}>
                  <View style={[
                    styles.progressFill,
                    { width: `${Math.min(100, (nowPlaying.progressMs / nowPlaying.durationMs) * 100)}%` as any }
                  ]} />
                </View>
                <Text style={styles.progressTime}>{fmtTime(nowPlaying.durationMs)}</Text>
              </View>

              {/* Controls */}
              <View style={styles.controls}>
                <TouchableOpacity style={styles.controlBtn} onPress={handlePrev}>
                  <Text style={styles.controlIcon}>|◀</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.playBtn} onPress={handlePlayPause}>
                  <Text style={styles.playBtnIcon}>{nowPlaying.isPlaying ? '■' : '▶'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.controlBtn} onPress={handleNext}>
                  <Text style={styles.controlIcon}>▶|</Text>
                </TouchableOpacity>
              </View>

              {nowPlaying.deviceName && (
                <Text style={styles.deviceName}>Playing on {nowPlaying.deviceName}</Text>
              )}
            </Animated.View>
          ) : (
            <View style={styles.noPlayingCard}>
              <Text style={styles.noPlayingText}>Nothing playing</Text>
              <Text style={styles.noPlayingHint}>
                {hasNoDevice
                  ? 'Open Spotify on any device first, then come back here to control it'
                  : 'Search for a track or playlist below'}
              </Text>
            </View>
          )}

          {/* Tab switcher */}
          <View style={styles.tabRow}>
            {(['home', 'search', 'playlists'] as View2[]).map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.tabBtn, activeView === v && styles.tabBtnActive]}
                onPress={() => setActiveView(v)}
              >
                <Text style={[styles.tabBtnText, activeView === v && styles.tabBtnTextActive]}>
                  {v === 'home' ? 'Devices' : v === 'search' ? 'Search' : 'Playlists'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.scroll}>

            {/* Devices */}
            {activeView === 'home' && (
              <>
                {devices.length === 0 ? (
                  <Text style={styles.emptyText}>No active Spotify devices found. Open Spotify on your phone or computer.</Text>
                ) : (
                  devices.map(d => (
                    <View key={d.id} style={[styles.deviceRow, d.isActive && styles.deviceRowActive]}>
                      <View>
                        <Text style={styles.deviceRowName}>{d.name}</Text>
                        <Text style={styles.deviceRowType}>{d.type}{d.isActive ? ' · Active' : ''}</Text>
                      </View>
                      {d.isActive && <View style={styles.activeDot} />}
                    </View>
                  ))
                )}
              </>
            )}

            {/* Search */}
            {activeView === 'search' && (
              <>
                <View style={styles.searchRow}>
                  <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search tracks, playlists..."
                    placeholderTextColor={Colors.textMuted}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                  />
                  <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
                    <Text style={styles.searchBtnText}>Go</Text>
                  </TouchableOpacity>
                </View>

                {searching && <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />}

                {searchTracks2.length > 0 && (
                  <>
                    <Text style={styles.resultSection}>Tracks</Text>
                    {searchTracks2.map(t => (
                      <TouchableOpacity key={t.id} style={styles.resultRow} onPress={() => handlePlayTrack(t.uri)}>
                        {t.albumArt ? (
                          <Image source={{ uri: t.albumArt }} style={styles.resultArt} />
                        ) : (
                          <View style={[styles.resultArt, styles.albumArtPlaceholder]} />
                        )}
                        <View style={styles.resultInfo}>
                          <Text style={styles.resultName} numberOfLines={1}>{t.name}</Text>
                          <Text style={styles.resultSub} numberOfLines={1}>{t.artists}</Text>
                        </View>
                        <Text style={styles.playArrow}>▶</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {searchPlaylists2.length > 0 && (
                  <>
                    <Text style={styles.resultSection}>Playlists</Text>
                    {searchPlaylists2.map(p => (
                      <TouchableOpacity key={p.id} style={styles.resultRow} onPress={() => handlePlayPlaylist(p.uri)}>
                        {p.art ? (
                          <Image source={{ uri: p.art }} style={styles.resultArt} />
                        ) : (
                          <View style={[styles.resultArt, styles.albumArtPlaceholder]} />
                        )}
                        <View style={styles.resultInfo}>
                          <Text style={styles.resultName} numberOfLines={1}>{p.name}</Text>
                          <Text style={styles.resultSub}>{p.trackCount} tracks</Text>
                        </View>
                        <Text style={styles.playArrow}>▶</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </>
            )}

            {/* Playlists */}
            {activeView === 'playlists' && (
              playlists.length === 0
                ? <Text style={styles.emptyText}>No playlists found</Text>
                : playlists.map(p => (
                  <TouchableOpacity key={p.id} style={styles.resultRow} onPress={() => handlePlayPlaylist(p.uri)}>
                    {p.art ? (
                      <Image source={{ uri: p.art }} style={styles.resultArt} />
                    ) : (
                      <View style={[styles.resultArt, styles.albumArtPlaceholder]} />
                    )}
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultName} numberOfLines={1}>{p.name}</Text>
                      <Text style={styles.resultSub}>{p.trackCount} tracks</Text>
                    </View>
                    <Text style={styles.playArrow}>▶</Text>
                  </TouchableOpacity>
                ))
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 60, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  back: { color: Colors.primary, fontSize: 15 },
  title: { color: Colors.text, fontSize: 17, fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },

  nowPlayingCard: {
    margin: Spacing.lg,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  albumArt: { width: '100%', height: 180, borderRadius: Radius.lg },
  albumArtPlaceholder: { backgroundColor: Colors.bgElevated },
  trackInfo: { gap: 3 },
  trackName: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  trackArtist: { color: Colors.textSecondary, fontSize: 14 },
  trackAlbum: { color: Colors.textMuted, fontSize: 12 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressTime: { color: Colors.textMuted, fontSize: 11, width: 36 },
  progressBg: { flex: 1, height: 3, backgroundColor: Colors.bgElevated, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: Colors.primary, borderRadius: 2 },

  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.xl },
  controlBtn: { padding: Spacing.sm },
  controlIcon: { color: Colors.textSecondary, fontSize: 18 },
  playBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  playBtnIcon: { color: '#fff', fontSize: 20 },
  deviceName: { color: Colors.textMuted, fontSize: 11, textAlign: 'center' },

  noPlayingCard: {
    margin: Spacing.lg,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  noPlayingText: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600' },
  noPlayingHint: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 18 },

  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabBtnText: { color: Colors.textMuted, fontSize: 13 },
  tabBtnTextActive: { color: Colors.primary, fontWeight: '600' },

  scroll: { padding: Spacing.lg, gap: Spacing.sm },

  deviceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  deviceRowActive: { borderColor: Colors.primary },
  deviceRowName: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  deviceRowType: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },

  searchRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  searchInput: {
    flex: 1, backgroundColor: Colors.bgElevated, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, fontSize: 14,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  searchBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  resultSection: {
    color: Colors.textMuted, fontSize: 10, fontWeight: '700',
    letterSpacing: 2, textTransform: 'uppercase',
    marginTop: Spacing.md, marginBottom: Spacing.sm,
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  resultArt: { width: 48, height: 48, borderRadius: Radius.sm },
  resultInfo: { flex: 1 },
  resultName: { color: Colors.text, fontSize: 14 },
  resultSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  playArrow: { color: Colors.primary, fontSize: 14 },

  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 20, lineHeight: 20 },
  notConnectedTitle: { color: Colors.text, fontSize: 18, fontWeight: '600', marginBottom: Spacing.sm },
  notConnectedSub: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.lg },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl, paddingVertical: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
});
