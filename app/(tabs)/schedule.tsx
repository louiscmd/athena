import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Modal, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { getTasks, getEvents, updateTask, deleteTask } from '@/lib/database';
import { getGoogleCalendarEvents, isGoogleCalendarConnected } from '@/lib/google-calendar';
import type { GoogleCalendarEvent } from '@/lib/google-calendar';
import Card from '@/components/ui/Card';
import { Colors, Spacing, Radius } from '@/constants/theme';
import type { Task, CalendarEvent } from '@/types';

const DAY_MS = 86400000;

export default function ScheduleScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);

    const connected = isGoogleCalendarConnected();
    setGcalConnected(connected);

    const [allTasks, dayEvents, gEvents] = await Promise.all([
      getTasks(),
      getEvents(start.getTime(), end.getTime()),
      connected ? getGoogleCalendarEvents(start.getTime(), end.getTime()) : Promise.resolve([]),
    ]);

    const dayTasks = allTasks.filter(t => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate).toDateString() === selectedDate.toDateString();
    });

    setTasks(dayTasks);
    setEvents(dayEvents);
    setGoogleEvents(gEvents);
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { load(); }, [load]);

  async function toggleTask(task: Task) {
    await updateTask(task.id, { completed: !task.completed });
    load();
  }

  async function removeTask(id: string) {
    Alert.alert('Delete Task', 'Remove this task?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTask(id); load(); } },
    ]);
  }

  // Build week view
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 3 + i);
    return d;
  });

  const todayStr = new Date().toDateString();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Schedule</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Week strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekStrip} contentContainerStyle={styles.weekContent}>
        {week.map((d, i) => {
          const isSelected = d.toDateString() === selectedDate.toDateString();
          const isToday = d.toDateString() === todayStr;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.dayChip, isSelected && styles.dayChipSelected]}
              onPress={() => setSelectedDate(d)}
            >
              <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                {d.toLocaleDateString('en', { weekday: 'short' })}
              </Text>
              <Text style={[styles.dayNum, isSelected && styles.dayNumSelected, isToday && styles.dayNumToday]}>
                {d.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Date label */}
      <Text style={styles.dateLabel}>
        {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </Text>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Google Calendar events */}
        {googleEvents.length > 0 && (
          <Section title="Google Calendar">
            {googleEvents.map(ev => (
              <Animated.View key={ev.id} entering={FadeIn}>
                <Card style={styles.eventCard}>
                  <View style={[styles.eventDot, { backgroundColor: ev.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>{ev.title}</Text>
                    <Text style={styles.eventTime}>
                      {new Date(ev.startTime).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {new Date(ev.endTime).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {ev.location && <Text style={styles.eventLoc}>{ev.location}</Text>}
                    {ev.description && <Text style={styles.eventDesc} numberOfLines={1}>{ev.description}</Text>}
                  </View>
                  <View style={styles.gcalBadge}><Text style={styles.gcalBadgeText}>GCal</Text></View>
                </Card>
              </Animated.View>
            ))}
          </Section>
        )}

        {/* Local events */}
        {events.length > 0 && (
          <Section title="Events">
            {events.map(ev => (
              <Animated.View key={ev.id} entering={FadeIn}>
                <Card style={styles.eventCard}>
                  <View style={[styles.eventDot, { backgroundColor: ev.color ?? Colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>{ev.title}</Text>
                    <Text style={styles.eventTime}>
                      {new Date(ev.startTime).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {new Date(ev.endTime).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {ev.location && <Text style={styles.eventLoc}>{ev.location}</Text>}
                  </View>
                </Card>
              </Animated.View>
            ))}
          </Section>
        )}

        {/* Tasks */}
        {tasks.length > 0 && (
          <Section title="Tasks Due">
            {tasks.map(task => (
              <Animated.View key={task.id} entering={FadeIn}>
                <Card style={[styles.taskCard, task.completed && styles.taskDone]}>
                  <TouchableOpacity
                    style={[styles.checkbox, task.completed && styles.checkboxDone]}
                    onPress={() => toggleTask(task)}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, task.completed && styles.taskTitleDone]}>
                      {task.title}
                    </Text>
                    {task.dueTime && <Text style={styles.taskTime}>{task.dueTime}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => removeTask(task.id)}>
                    <Text style={styles.deleteBtn}>✕</Text>
                  </TouchableOpacity>
                </Card>
              </Animated.View>
            ))}
          </Section>
        )}

        {/* Google Calendar connect banner */}
        {!gcalConnected && (
          <TouchableOpacity style={styles.gcalBanner} onPress={() => router.push('/settings')}>
            <Text style={styles.gcalBannerText}>Connect Google Calendar in Settings to see your events here</Text>
          </TouchableOpacity>
        )}

        {events.length === 0 && tasks.length === 0 && googleEvents.length === 0 && !loading && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nothing scheduled for this day</Text>
            <Text style={styles.emptyHint}>Tell Athena: "Schedule a meeting for this day at 3 PM"</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ gap: Spacing.sm }}>{children}</View>
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
  weekStrip: { flexGrow: 0 },
  weekContent: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  dayChip: {
    alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Radius.md, gap: 4,
  },
  dayChipSelected: { backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primary },
  dayName: { color: Colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  dayNameSelected: { color: Colors.primary },
  dayNum: { color: Colors.textSecondary, fontSize: 18, fontWeight: '600' },
  dayNumSelected: { color: Colors.primary },
  dayNumToday: { color: Colors.primary },
  dateLabel: { color: Colors.textSecondary, fontSize: 13, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  scroll: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: 40 },
  section: { gap: Spacing.sm },
  sectionTitle: { color: Colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  eventCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  eventDot: { width: 4, height: '100%', borderRadius: 2, minHeight: 40 },
  eventTitle: { color: Colors.text, fontSize: 15, fontWeight: '500' },
  eventTime: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  eventLoc: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  taskCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  taskDone: { opacity: 0.5 },
  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.primary,
  },
  checkboxDone: { backgroundColor: Colors.primary },
  taskTitle: { color: Colors.text, fontSize: 15 },
  taskTitleDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  taskTime: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  deleteBtn: { color: Colors.textMuted, fontSize: 16, padding: 4 },
  eventDesc: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  gcalBadge: {
    backgroundColor: Colors.primaryDim,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  gcalBadgeText: { color: Colors.primary, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  gcalBanner: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  gcalBannerText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
  empty: { alignItems: 'center', gap: Spacing.sm, marginTop: 60 },
  emptyText: { color: Colors.textSecondary, fontSize: 16 },
  emptyHint: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
});
