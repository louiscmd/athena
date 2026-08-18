import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { getTasks, updateTask, deleteTask } from '@/lib/database';
import Card from '@/components/ui/Card';
import { Colors, Spacing, Radius } from '@/constants/theme';
import type { Task, TaskPriority } from '@/types';

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: Colors.success,
  medium: Colors.warning,
  high: Colors.error,
};

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);

  const load = useCallback(async () => {
    const all = await getTasks(true);
    setTasks(all);
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);

  async function toggle(task: Task) {
    await updateTask(task.id, { completed: !task.completed });
    load();
  }

  async function remove(id: string) {
    Alert.alert('Delete Task', 'Remove this task?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTask(id); load(); } },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Tasks</Text>
        <Text style={styles.count}>{active.length} left</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {active.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>All clear!</Text>
            <Text style={styles.emptyHint}>Tell Athena: "Add a task: review contracts by Friday"</Text>
          </View>
        )}

        {active.map(task => (
          <Animated.View key={task.id} entering={FadeIn} exiting={FadeOut} layout={Layout}>
            <TaskCard task={task} onToggle={toggle} onDelete={remove} />
          </Animated.View>
        ))}

        {completed.length > 0 && (
          <TouchableOpacity
            style={styles.completedToggle}
            onPress={() => setShowCompleted(p => !p)}
          >
            <Text style={styles.completedToggleText}>
              {showCompleted ? '▼' : '▶'} Completed ({completed.length})
            </Text>
          </TouchableOpacity>
        )}

        {showCompleted && completed.map(task => (
          <Animated.View key={task.id} entering={FadeIn} layout={Layout}>
            <TaskCard task={task} onToggle={toggle} onDelete={remove} />
          </Animated.View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function TaskCard({
  task, onToggle, onDelete,
}: {
  task: Task;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const color = PRIORITY_COLOR[task.priority];

  return (
    <Card style={[styles.card, task.completed && styles.cardDone]}>
      <View style={[styles.priorityBar, { backgroundColor: color }]} />
      <TouchableOpacity
        style={[styles.checkbox, task.completed && { backgroundColor: color, borderColor: color }]}
        onPress={() => onToggle(task)}
      >
        {task.completed && <Text style={styles.checkMark}>✓</Text>}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[styles.taskTitle, task.completed && styles.done]}>
          {task.title}
        </Text>
        <View style={styles.meta}>
          <Text style={[styles.badge, { borderColor: color, color }]}>
            {task.priority}
          </Text>
          <Text style={styles.category}>{task.category}</Text>
          {task.dueDate && (
            <Text style={styles.due}>
              📅 {new Date(task.dueDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              {task.dueTime ? ` ${task.dueTime}` : ''}
            </Text>
          )}
        </View>
        {task.description && (
          <Text style={styles.desc} numberOfLines={2}>{task.description}</Text>
        )}
      </View>
      <TouchableOpacity onPress={() => onDelete(task.id)}>
        <Text style={styles.del}>✕</Text>
      </TouchableOpacity>
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
  scroll: { padding: Spacing.lg, gap: Spacing.sm },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, overflow: 'hidden' },
  cardDone: { opacity: 0.55 },
  priorityBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkMark: { color: Colors.bg, fontSize: 13, fontWeight: '700' },
  taskTitle: { color: Colors.text, fontSize: 15, fontWeight: '500', lineHeight: 20 },
  done: { textDecorationLine: 'line-through', color: Colors.textMuted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4, flexWrap: 'wrap' },
  badge: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 1, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  category: { color: Colors.textMuted, fontSize: 11 },
  due: { color: Colors.textMuted, fontSize: 11 },
  desc: { color: Colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 17 },
  del: { color: Colors.textMuted, fontSize: 16, padding: 4 },
  completedToggle: { paddingVertical: Spacing.sm },
  completedToggleText: { color: Colors.textMuted, fontSize: 13 },
  empty: { alignItems: 'center', gap: Spacing.sm, marginTop: 80 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: Colors.text, fontSize: 20, fontWeight: '600' },
  emptyHint: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: Spacing.xl },
});
