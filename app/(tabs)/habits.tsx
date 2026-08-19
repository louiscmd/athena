import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { getHabits, updateHabit, deleteHabit } from '@/lib/database';
import Card from '@/components/ui/Card';
import { Colors, Spacing, Radius } from '@/constants/theme';
import type { Habit } from '@/types';

export default function HabitsScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setHabits(await getHabits());
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggleToday(habit: Habit) {
    const done = habit.completedDates.includes(today);
    let newDates: string[];
    let newStreak = habit.streak;
    let newBest = habit.bestStreak;

    if (done) {
      newDates = habit.completedDates.filter(d => d !== today);
      newStreak = Math.max(0, habit.streak - 1);
    } else {
      newDates = [...habit.completedDates, today];
      // Calculate streak
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yd = yesterday.toISOString().slice(0, 10);
      newStreak = habit.completedDates.includes(yd) ? habit.streak + 1 : 1;
      newBest = Math.max(newStreak, habit.bestStreak);
    }

    await updateHabit(habit.id, { completedDates: newDates, streak: newStreak, bestStreak: newBest });
    load();
  }

  async function remove(id: string) {
    Alert.alert('Delete Habit', 'Remove this habit and its history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteHabit(id); load(); } },
    ]);
  }

  const doneToday = habits.filter(h => h.completedDates.includes(today)).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Habits</Text>
        <Text style={styles.count}>{doneToday}/{habits.length}</Text>
      </View>

      {/* Progress bar */}
      {habits.length > 0 && (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${habits.length ? (doneToday / habits.length) * 100 : 0}%` }]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {doneToday === habits.length ? '🎉 All done today!' : `${habits.length - doneToday} remaining today`}
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        {habits.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💪</Text>
            <Text style={styles.emptyText}>No habits yet</Text>
            <Text style={styles.emptyHint}>Tell Athena: "Add a daily habit: meditate for 10 minutes"</Text>
          </View>
        )}

        {habits.map(habit => {
          const done = habit.completedDates.includes(today);
          return (
            <Animated.View key={habit.id} entering={FadeIn}>
              <Card style={[styles.card, done && styles.cardDone]} glow={done}>
                <View style={[styles.iconWrap, { backgroundColor: habit.color + '22' }]}>
                  <Text style={styles.icon}>{habit.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.habitName}>{habit.name}</Text>
                  <View style={styles.meta}>
                    <Text style={styles.freq}>{habit.frequency}</Text>
                    <Text style={styles.streak}>🔥 {habit.streak} day streak</Text>
                    {habit.bestStreak > 0 && (
                      <Text style={styles.best}>best: {habit.bestStreak}</Text>
                    )}
                  </View>
                  {/* Last 7 days dots */}
                  <View style={styles.dots}>
                    {Array.from({ length: 7 }, (_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - (6 - i));
                      const ds = d.toISOString().slice(0, 10);
                      const isToday = ds === today;
                      const checked = habit.completedDates.includes(ds);
                      return (
                        <View
                          key={i}
                          style={[
                            styles.dot,
                            checked && { backgroundColor: habit.color },
                            isToday && styles.dotToday,
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.checkBtn, done && { backgroundColor: habit.color }]}
                    onPress={() => toggleToday(habit)}
                  >
                    <Text style={[styles.checkBtnText, done && { color: Colors.bg }]}>
                      {done ? '✓' : '○'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(habit.id)}>
                    <Text style={styles.del}>✕</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            </Animated.View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
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
  count: { color: Colors.primary, fontSize: 15, fontWeight: '600', minWidth: 60, textAlign: 'right' },
  progressWrap: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.xs },
  progressTrack: { height: 4, backgroundColor: Colors.bgElevated, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  progressLabel: { color: Colors.textMuted, fontSize: 12 },
  scroll: { padding: Spacing.lg, gap: Spacing.sm },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  cardDone: { borderColor: Colors.borderGlow },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 22 },
  habitName: { color: Colors.text, fontSize: 15, fontWeight: '500' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 3, flexWrap: 'wrap' },
  freq: { color: Colors.textMuted, fontSize: 11, textTransform: 'capitalize' },
  streak: { color: Colors.warning, fontSize: 11 },
  best: { color: Colors.textMuted, fontSize: 11 },
  dots: { flexDirection: 'row', gap: 4, marginTop: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border },
  dotToday: { borderColor: Colors.primary },
  actions: { alignItems: 'center', gap: Spacing.sm },
  checkBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  checkBtnText: { color: Colors.primary, fontSize: 16, fontWeight: '700' },
  del: { color: Colors.textMuted, fontSize: 14 },
  empty: { alignItems: 'center', gap: Spacing.sm, marginTop: 80 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: Colors.text, fontSize: 20, fontWeight: '600' },
  emptyHint: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: Spacing.xl },
});
