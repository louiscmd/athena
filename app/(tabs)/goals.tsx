import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { getGoals, updateGoal } from '@/lib/database';
import Card from '@/components/ui/Card';
import { Colors, Spacing, Radius } from '@/constants/theme';
import type { Goal } from '@/types';

export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);

  const load = useCallback(async () => {
    setGoals(await getGoals());
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const active = goals.filter(g => g.status === 'active');
  const completed = goals.filter(g => g.status === 'completed');

  async function adjustProgress(goal: Goal, delta: number) {
    const newProg = Math.max(0, Math.min(100, goal.progress + delta));
    const status = newProg >= 100 ? 'completed' : goal.status;
    await updateGoal(goal.id, { progress: newProg, status });
    if (newProg >= 100) {
      Alert.alert('🎉 Goal Complete!', `You've completed "${goal.title}"!`);
    }
    load();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Goals</Text>
        <Text style={styles.count}>{active.length} active</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {active.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyText}>Set your first goal</Text>
            <Text style={styles.emptyHint}>Tell Athena: "I want to launch my app by end of month"</Text>
          </View>
        )}

        {active.map(goal => (
          <Animated.View key={goal.id} entering={FadeIn}>
            <GoalCard goal={goal} onProgress={adjustProgress} />
          </Animated.View>
        ))}

        {completed.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completed 🏆</Text>
            {completed.map(goal => (
              <Animated.View key={goal.id} entering={FadeIn}>
                <GoalCard goal={goal} onProgress={adjustProgress} done />
              </Animated.View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function GoalCard({
  goal, onProgress, done = false,
}: {
  goal: Goal;
  onProgress: (g: Goal, delta: number) => void;
  done?: boolean;
}) {
  const daysLeft = goal.targetDate
    ? Math.ceil((goal.targetDate - Date.now()) / 86400000)
    : null;

  return (
    <Card style={[styles.card, done && styles.cardDone]} glow={!done && goal.progress > 70}>
      <View style={styles.cardTop}>
        <Text style={styles.goalIcon}>{goal.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.goalTitle}>{goal.title}</Text>
          <View style={styles.meta}>
            <Text style={styles.timeframe}>{goal.timeframe}</Text>
            {daysLeft !== null && (
              <Text style={[styles.daysLeft, daysLeft < 7 && { color: Colors.error }]}>
                {daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? 'Due today' : 'Overdue'}
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.percent}>{goal.progress}%</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.track}>
        <Animated.View
          style={[styles.fill, {
            width: `${goal.progress}%`,
            backgroundColor: done ? Colors.success : goal.progress > 70 ? Colors.primary : Colors.accent,
          }]}
        />
      </View>

      {/* Description */}
      {goal.description && (
        <Text style={styles.desc}>{goal.description}</Text>
      )}

      {/* Milestones */}
      {goal.milestones.length > 0 && (
        <View style={styles.milestones}>
          {goal.milestones.map(m => (
            <View key={m.id} style={styles.milestone}>
              <Text style={styles.mDot}>{m.completed ? '✓' : '○'}</Text>
              <Text style={[styles.mTitle, m.completed && styles.mDone]}>{m.title}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Controls */}
      {!done && (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.progressBtn} onPress={() => onProgress(goal, -10)}>
            <Text style={styles.progressBtnText}>−10%</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.progressBtn, styles.progressBtnPrimary]} onPress={() => onProgress(goal, 10)}>
            <Text style={[styles.progressBtnText, { color: Colors.bg }]}>+10%</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.progressBtn, { flex: 1 }]} onPress={() => onProgress(goal, 100 - goal.progress)}>
            <Text style={styles.progressBtnText}>Complete ✓</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
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
  count: { color: Colors.textMuted, fontSize: 13, minWidth: 60, textAlign: 'right' },
  scroll: { padding: Spacing.lg, gap: Spacing.md },
  section: { gap: Spacing.sm },
  sectionTitle: { color: Colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  card: { gap: Spacing.sm },
  cardDone: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  goalIcon: { fontSize: 28 },
  goalTitle: { color: Colors.text, fontSize: 16, fontWeight: '600', lineHeight: 22 },
  meta: { flexDirection: 'row', gap: Spacing.sm, marginTop: 2 },
  timeframe: { color: Colors.textMuted, fontSize: 11, textTransform: 'capitalize' },
  daysLeft: { color: Colors.textSecondary, fontSize: 11 },
  percent: { color: Colors.primary, fontSize: 20, fontWeight: '700' },
  track: { height: 6, backgroundColor: Colors.bgElevated, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  desc: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  milestones: { gap: 4 },
  milestone: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  mDot: { color: Colors.primary, fontSize: 13, width: 16 },
  mTitle: { color: Colors.textSecondary, fontSize: 13 },
  mDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  controls: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  progressBtn: {
    paddingVertical: 7, paddingHorizontal: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  progressBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  progressBtnText: { color: Colors.text, fontSize: 12, fontWeight: '500' },
  empty: { alignItems: 'center', gap: Spacing.sm, marginTop: 80 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: Colors.text, fontSize: 20, fontWeight: '600' },
  emptyHint: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: Spacing.xl },
});
