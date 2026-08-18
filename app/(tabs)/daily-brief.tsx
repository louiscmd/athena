import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { getTasks, getEvents, getHabits, getGoals, getFinanceEntries, getNotes, getSettings } from '@/lib/database';
import { generateDailyBrief } from '@/lib/ai';
import { speak, stopSpeaking, getIsSpeaking } from '@/lib/voice';
import { Colors, Spacing, Radius } from '@/constants/theme';
import type { DailyBriefData } from '@/lib/ai';

type BriefState = 'idle' | 'generating' | 'ready' | 'speaking';

function todayRange(): { start: number; end: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 86_400_000 - 1;
  return { start, end };
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekRange(): { start: number; end: number } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day).getTime();
  const end = start + 7 * 86_400_000 - 1;
  return { start, end };
}

export default function DailyBriefScreen() {
  const [briefState, setBriefState] = useState<BriefState>('idle');
  const [briefText, setBriefText] = useState('');
  const [briefData, setBriefData] = useState<DailyBriefData | null>(null);
  const [speakingNow, setSpeakingNow] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load today's data ────────────────────────────────────────────────────────

  const loadData = useCallback(async (): Promise<DailyBriefData | null> => {
    const settings = await getSettings();
    if (!settings.anthropicApiKey) return null;

    const { start, end } = todayRange();
    const week = weekRange();
    const today = todayKey();

    const [allTasks, todaysEvents, habits, goals, finance, notes] = await Promise.all([
      getTasks(true),
      getEvents(start, end),
      getHabits(),
      getGoals(),
      getFinanceEntries(200),
      getNotes(),
    ]);

    const todaysTasks = allTasks.filter(t => {
      if (!t.dueDate) return false;
      return t.dueDate >= start && t.dueDate <= end;
    });

    const habitsForBrief = habits.map(h => ({
      name: h.name,
      streak: h.streak,
      completedToday: (h.completedDates as string[]).includes(today),
    }));

    const activeGoals = goals
      .filter(g => g.status === 'active')
      .map(g => ({ title: g.title, progress: g.progress, timeframe: g.timeframe }));

    const weekFinance = finance.filter(e => e.date >= week.start && e.date <= week.end);
    const income = weekFinance.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const expenses = weekFinance.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

    return {
      userName: settings.userName,
      todaysEvents: todaysEvents.map(e => ({
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
      })),
      todaysTasks: todaysTasks.map(t => ({
        title: t.title,
        priority: t.priority,
        completed: t.completed,
      })),
      habits: habitsForBrief,
      activeGoals,
      financeThisWeek: { income, expenses, currency: settings.currency },
      recentNoteCount: notes.length,
    };
  }, []);

  useEffect(() => {
    loadData().then(data => {
      if (data) setBriefData(data);
    });
  }, [loadData]);

  // ── Generate brief via AI ────────────────────────────────────────────────────

  async function handleGenerate() {
    const settings = await getSettings();
    if (!settings.anthropicApiKey) return;

    setBriefState('generating');
    const data = await loadData();
    if (!data) { setBriefState('idle'); return; }

    setBriefData(data);
    const text = await generateDailyBrief(data, settings.anthropicApiKey);
    setBriefText(text);
    setBriefState('ready');
  }

  // ── Play / stop brief ────────────────────────────────────────────────────────

  function startPolling() {
    pollRef.current = setInterval(() => {
      if (!getIsSpeaking()) {
        setSpeakingNow(false);
        setBriefState('ready');
        clearInterval(pollRef.current!);
      }
    }, 500);
  }

  async function handlePlay() {
    if (!briefText) return;

    if (speakingNow) {
      await stopSpeaking();
      setSpeakingNow(false);
      setBriefState('ready');
      clearInterval(pollRef.current!);
      return;
    }

    const settings = await getSettings();
    setSpeakingNow(true);
    setBriefState('speaking');
    await speak(briefText, settings.voice);
    startPolling();
  }

  useEffect(() => () => {
    clearInterval(pollRef.current!);
    stopSpeaking();
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  function fmt(ms: number) {
    return new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  const d = briefData;
  const pendingTasks = d?.todaysTasks.filter(t => !t.completed) ?? [];
  const activeHabits = d?.habits ?? [];
  const weekNet = d ? d.financeThisWeek.income - d.financeThisWeek.expenses : 0;
  const netSign = weekNet >= 0 ? '+' : '';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Daily Brief</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Greeting */}
        <View style={styles.greetingRow}>
          <Text style={styles.greeting}>{greeting}{d?.userName ? `, ${d.userName}` : ''}.</Text>
          <Text style={styles.dateStr}>{dateStr}</Text>
        </View>

        {/* Generate / Play controls */}
        <View style={styles.controls}>
          {briefState === 'idle' && (
            <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate}>
              <Text style={styles.generateBtnText}>Generate Brief</Text>
            </TouchableOpacity>
          )}

          {briefState === 'generating' && (
            <View style={styles.generatingRow}>
              <ActivityIndicator color={Colors.primary} size="small" />
              <Text style={styles.generatingText}>Athena is preparing your brief...</Text>
            </View>
          )}

          {(briefState === 'ready' || briefState === 'speaking') && (
            <View style={styles.readyRow}>
              <TouchableOpacity
                style={[styles.playBtn, speakingNow && styles.playBtnActive]}
                onPress={handlePlay}
              >
                <Text style={styles.playBtnText}>
                  {speakingNow ? '■  Stop' : '▶  Play Brief'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.regenerateBtn} onPress={handleGenerate}>
                <Text style={styles.regenerateBtnText}>Regenerate</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Brief text preview */}
        {briefText !== '' && (
          <View style={styles.briefCard}>
            <Text style={styles.briefCardLabel}>Brief</Text>
            <Text style={styles.briefCardText}>{briefText}</Text>
          </View>
        )}

        {/* ── Today's Events ─────────────────────────────────────────────── */}
        <Section title="Today's Events" count={d?.todaysEvents.length ?? 0}>
          {d && d.todaysEvents.length > 0 ? (
            d.todaysEvents.map((e, i) => (
              <Row key={i} primary={e.title} secondary={`${fmt(e.startTime)} — ${fmt(e.endTime)}${e.location ? `  ·  ${e.location}` : ''}`} />
            ))
          ) : (
            <Text style={styles.emptyText}>No events scheduled today</Text>
          )}
        </Section>

        {/* ── Today's Tasks ──────────────────────────────────────────────── */}
        <Section title="Tasks Due Today" count={pendingTasks.length}>
          {pendingTasks.length > 0 ? (
            pendingTasks.map((t, i) => (
              <Row
                key={i}
                primary={t.title}
                secondary={t.priority.toUpperCase()}
                accent={t.priority === 'high' ? Colors.error : t.priority === 'medium' ? Colors.warning : Colors.textMuted}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>All clear — no tasks due today</Text>
          )}
        </Section>

        {/* ── Habits ─────────────────────────────────────────────────────── */}
        <Section title="Habits" count={activeHabits.length}>
          {activeHabits.length > 0 ? (
            activeHabits.map((h, i) => (
              <Row
                key={i}
                primary={h.name}
                secondary={h.streak > 0 ? `${h.streak} day streak` : 'Start today'}
                badge={h.completedToday ? 'done' : undefined}
                accent={h.completedToday ? Colors.success : Colors.textMuted}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>No habits tracked yet</Text>
          )}
        </Section>

        {/* ── Goals ──────────────────────────────────────────────────────── */}
        <Section title="Active Goals" count={d?.activeGoals.length ?? 0}>
          {d && d.activeGoals.length > 0 ? (
            d.activeGoals.map((g, i) => (
              <View key={i} style={styles.goalRow}>
                <View style={styles.goalTop}>
                  <Text style={styles.rowPrimary}>{g.title}</Text>
                  <Text style={styles.goalPct}>{g.progress}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${g.progress}%` as any }]} />
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No active goals</Text>
          )}
        </Section>

        {/* ── Finance ────────────────────────────────────────────────────── */}
        <Section title="Finance This Week">
          {d ? (
            <View style={styles.financeRow}>
              <FinanceStat label="Income" value={`+${d.financeThisWeek.income.toFixed(2)}`} color={Colors.success} />
              <FinanceStat label="Expenses" value={`-${d.financeThisWeek.expenses.toFixed(2)}`} color={Colors.error} />
              <FinanceStat
                label="Net"
                value={`${netSign}${weekNet.toFixed(2)}`}
                color={weekNet >= 0 ? Colors.success : Colors.error}
              />
            </View>
          ) : (
            <Text style={styles.emptyText}>No finance data this week</Text>
          )}
        </Section>

        {/* ── Notes ──────────────────────────────────────────────────────── */}
        <Section title="Notes">
          <Text style={styles.emptyText}>
            {d && d.recentNoteCount > 0
              ? `${d.recentNoteCount} notes in your library`
              : 'No notes yet'}
          </Text>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
        {count !== undefined && count > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{count}</Text>
          </View>
        )}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ primary, secondary, accent, badge }: {
  primary: string; secondary?: string; accent?: string; badge?: string;
}) {
  return (
    <View style={styles.rowWrap}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowPrimary}>{primary}</Text>
        {secondary && (
          <Text style={[styles.rowSecondary, accent ? { color: accent } : undefined]}>{secondary}</Text>
        )}
      </View>
      {badge && (
        <View style={styles.rowBadge}>
          <Text style={styles.rowBadgeText}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

function FinanceStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.financeStat}>
      <Text style={[styles.financeValue, { color }]}>{value}</Text>
      <Text style={styles.financeLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

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
  title: { color: Colors.text, fontSize: 17, fontWeight: '600', letterSpacing: 0.5 },
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },

  greetingRow: { marginBottom: Spacing.lg },
  greeting: { color: Colors.text, fontSize: 26, fontWeight: '700', letterSpacing: 0.3 },
  dateStr: { color: Colors.textSecondary, fontSize: 14, marginTop: 4 },

  controls: { marginBottom: Spacing.lg, gap: Spacing.sm },
  generateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
  generatingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 14 },
  generatingText: { color: Colors.textSecondary, fontSize: 14 },
  readyRow: { flexDirection: 'row', gap: Spacing.sm },
  playBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  playBtnActive: { backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.primary },
  playBtnText: { color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
  regenerateBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  regenerateBtnText: { color: Colors.textSecondary, fontSize: 14 },

  briefCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  briefCardLabel: {
    color: Colors.primary,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  briefCardText: { color: Colors.text, fontSize: 14, lineHeight: 22 },

  section: { marginBottom: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  countBadge: {
    backgroundColor: Colors.primaryDim,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countBadgeText: { color: Colors.primary, fontSize: 10, fontWeight: '700' },
  sectionBody: { gap: 6 },
  emptyText: { color: Colors.textMuted, fontSize: 13, paddingVertical: 4 },

  rowWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowLeft: { flex: 1 },
  rowPrimary: { color: Colors.text, fontSize: 14 },
  rowSecondary: { color: Colors.textMuted, fontSize: 12, marginTop: 1 },
  rowBadge: {
    backgroundColor: Colors.success + '22',
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  rowBadgeText: { color: Colors.success, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  goalRow: { paddingVertical: 6, gap: 5 },
  goalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalPct: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  progressBarBg: {
    height: 3,
    backgroundColor: Colors.bgElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },

  financeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.sm,
  },
  financeStat: { alignItems: 'center', gap: 3 },
  financeValue: { fontSize: 18, fontWeight: '700' },
  financeLabel: { color: Colors.textMuted, fontSize: 11, letterSpacing: 0.5 },
});
