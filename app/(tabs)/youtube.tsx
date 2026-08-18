import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useAthena } from '@/contexts/AthenaContext';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { searchYouTube, getTrendingMusic, getYouTubeEmbedUrl } from '@/lib/youtube';
import type { YTVideo } from '@/lib/youtube';

// ─── YouTube IFrame player (web-only helper) ─────────────────────────────────

function YouTubePlayer({ videoId }: { videoId: string }) {
  const containerRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !containerRef.current) return;

    // Clear previous player
    const el = containerRef.current as HTMLElement;
    el.innerHTML = '';

    const iframe = document.createElement('iframe');
    iframe.src = getYouTubeEmbedUrl(videoId);
    iframe.width = '100%';
    iframe.height = '210';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '12px';
    iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    el.appendChild(iframe);

    return () => { el.innerHTML = ''; };
  }, [videoId]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.playerPlaceholder}>
        <Text style={styles.placeholderText}>YouTube playback is web-only</Text>
      </View>
    );
  }

  return <View ref={containerRef} style={styles.playerContainer} />;
}

// ─── Result card ─────────────────────────────────────────────────────────────

function VideoCard({
  video, isPlaying, onPress,
}: { video: YTVideo; isPlaying: boolean; onPress: () => void }) {
  const thumbRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !thumbRef.current || !video.thumbnail) return;
    const el = thumbRef.current as HTMLElement;
    el.style.backgroundImage = `url(${video.thumbnail})`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
  }, [video.thumbnail]);

  return (
    <TouchableOpacity
      style={[styles.videoCard, isPlaying && styles.videoCardActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View ref={thumbRef} style={styles.thumb}>
        {isPlaying && (
          <View style={styles.playingBadge}>
            <Text style={styles.playingBadgeText}>▶</Text>
          </View>
        )}
      </View>
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
        <Text style={styles.videoChannel} numberOfLines={1}>{video.channelTitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function YouTubeScreen() {
  const { settings } = useAthena();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YTVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nowPlaying, setNowPlaying] = useState<YTVideo | null>(null);

  const apiKey = settings.youtubeApiKey?.trim() ?? '';
  const hasKey = apiKey.length > 0;

  // Load trending on mount if API key is set
  useEffect(() => {
    if (!hasKey) return;
    setLoading(true);
    getTrendingMusic(apiKey)
      .then(videos => { setResults(videos); setError(''); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [apiKey]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    if (!hasKey) { setError('Add a YouTube API key in Settings first.'); return; }
    setLoading(true);
    setError('');
    try {
      const videos = await searchYouTube(query.trim(), apiKey);
      setResults(videos);
      if (videos.length === 0) setError('No results found.');
    } catch (err: any) {
      setError(err.message ?? 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [query, apiKey, hasKey]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>YouTube Music</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* No API key banner */}
      {!hasKey && (
        <TouchableOpacity style={styles.banner} onPress={() => router.push('/settings')}>
          <Text style={styles.bannerText}>
            Add a YouTube API key in Settings to search music →
          </Text>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Now Playing */}
        {nowPlaying && (
          <View style={styles.nowPlayingSection}>
            <Text style={styles.sectionLabel}>NOW PLAYING</Text>
            <Text style={styles.nowPlayingTitle} numberOfLines={1}>{nowPlaying.title}</Text>
            <Text style={styles.nowPlayingChannel}>{nowPlaying.channelTitle}</Text>
            <YouTubePlayer videoId={nowPlaying.id} />
          </View>
        )}

        {/* Search bar */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search music, artist, playlist..."
            placeholderTextColor={Colors.textMuted}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.searchBtn, (!hasKey || loading) && styles.searchBtnDisabled]}
            onPress={handleSearch}
            disabled={!hasKey || loading}
          >
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* Error */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Loading */}
        {loading && <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />}

        {/* Results */}
        {!loading && results.length > 0 && (
          <View style={styles.results}>
            <Text style={styles.sectionLabel}>
              {query.trim() ? 'RESULTS' : 'TRENDING MUSIC'}
            </Text>
            {results.map(video => (
              <VideoCard
                key={video.id}
                video={video}
                isPlaying={nowPlaying?.id === video.id}
                onPress={() => setNowPlaying(video)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  back: { color: Colors.primary, fontSize: 15 },
  title: { color: Colors.text, fontSize: 17, fontWeight: '600' },
  banner: {
    backgroundColor: Colors.primaryDim,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },
  bannerText: { color: Colors.primary, fontSize: 13 },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },
  nowPlayingSection: {
    gap: Spacing.xs,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  nowPlayingTitle: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  nowPlayingChannel: { color: Colors.textSecondary, fontSize: 13, marginBottom: Spacing.sm },
  playerContainer: { width: '100%', height: 210, borderRadius: Radius.lg, overflow: 'hidden' },
  playerPlaceholder: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
  },
  placeholderText: { color: Colors.textMuted, fontSize: 13 },
  searchRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  searchBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  searchBtnDisabled: { opacity: 0.4 },
  searchBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  error: { color: Colors.danger ?? '#e74c3c', fontSize: 13, textAlign: 'center' },
  results: { gap: Spacing.sm },
  videoCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    overflow: 'hidden',
  },
  videoCardActive: {
    borderColor: Colors.borderGlow,
    backgroundColor: Colors.primaryDim,
  },
  thumb: {
    width: 100,
    height: 60,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playingBadge: {
    backgroundColor: 'rgba(204,21,0,0.85)',
    borderRadius: 20,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playingBadgeText: { color: '#fff', fontSize: 10 },
  videoInfo: { flex: 1, justifyContent: 'center', gap: 4 },
  videoTitle: { color: Colors.text, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  videoChannel: { color: Colors.textMuted, fontSize: 11 },
});
