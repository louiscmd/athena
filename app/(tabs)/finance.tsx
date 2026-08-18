import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { getFinanceEntries, deleteFinanceEntry } from '@/lib/database';
import { useAthena } from '@/contexts/AthenaContext';
import Card from '@/components/ui/Card';
import { Colors, Spacing, Radius } from '@/constants/theme';
import type { FinanceEntry, FinanceCategory } from '@/types';

const CAT_ICON: Record<FinanceCategory, string> = {
  food: '🍽', transport: '🚗', housing: '🏠', entertainment: '🎬',
  health: '💊', shopping: '🛍', work: '💼', savings: '💰', other: '📦',
};

export default function FinanceScreen() {
  const { settings } = useAthena();
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  const load = useCallback(async () => {
    setEntries(await getFinanceEntries(100));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? entries : entries.filter(e => e.type === filter);

  // Summary for this month
  const now = new Date();
  const monthEntries = entries.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const income = monthEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const expense = monthEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const balance = income - expense;

  async function remove(id: string) {
    Alert.alert('Delete Entry', 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteFinanceEntry(id); load(); } },
    ]);
  }

  const fmt = (n: number) => `${settings.currency} ${Math.abs(n).toFixed(2)}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Finance</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Summary card */}
        <Card glow style={styles.summaryCard}>
          <Text style={styles.summaryMonth}>
            {now.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
          </Text>
          <Text style={[styles.balance, { color: balance >= 0 ? Colors.success : Colors.error }]}>
            {balance >= 0 ? '+' : '-'}{fmt(balance)}
          </Text>
          <Text style={styles.balanceLabel}>net balance</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>↑ Income</Text>
              <Text style={[styles.summaryAmount, { color: Colors.success }]}>{fmt(income)}</Text>
            </View>
            <View style={[styles.divider]} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>↓ Expenses</Text>
              <Text style={[styles.summaryAmount, { color: Colors.error }]}>{fmt(expense)}</Text>
            </View>
          </View>
        </Card>

        {/* Filter */}
        <View style={styles.filterRow}>
          {(['all', 'income', 'expense'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={styles.emptyText}>No entries yet</Text>
            <Text style={styles.emptyHint}>Tell Athena: "I spent $45 on groceries" or "I earned $2000 salary"</Text>
          </View>
        )}

        {filtered.map(entry => (
          <Animated.View key={entry.id} entering={FadeIn}>
            <Card style={styles.entry}>
              <Text style={styles.catIcon}>{CAT_ICON[entry.category]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryDesc}>{entry.description}</Text>
                <View style={styles.entryMeta}>
                  <Text style={styles.entryDate}>
                    {new Date(entry.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={styles.entryCat}>{entry.category}</Text>
                </View>
              </View>
              <View style={styles.entryRight}>
                <Text style={[styles.entryAmount, { color: entry.type === 'income' ? Colors.success : Colors.error }]}>
                  {entry.type === 'income' ? '+' : '-'}{fmt(entry.amount)}
                </Text>
                <TouchableOpacity onPress={() => remove(entry.id)}>
                  <Text style={styles.del}>✕</Text>
                </TouchableOpacity>
              </View>
            </Card>
          </Animated.View>
        ))}

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
  scroll: { padding: Spacing.lg, gap: Spacing.md },
  summaryCard: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.xs },
  summaryMonth: { color: Colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  balance: { fontSize: 38, fontWeight: '700', letterSpacing: -1 },
  balanceLabel: { color: Colors.textMuted, fontSize: 12 },
  summaryRow: { flexDirection: 'row', marginTop: Spacing.md, width: '100%' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryLabel: { color: Colors.textMuted, fontSize: 12 },
  summaryAmount: { fontSize: 16, fontWeight: '600' },
  divider: { width: 1, backgroundColor: Colors.border },
  filterRow: { flexDirection: 'row', gap: Spacing.sm },
  filterChip: {
    flex: 1, paddingVertical: 8, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  filterChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  filterText: { color: Colors.textMuted, fontSize: 13 },
  filterTextActive: { color: Colors.primary, fontWeight: '600' },
  entry: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  catIcon: { fontSize: 24, width: 36, textAlign: 'center' },
  entryDesc: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  entryMeta: { flexDirection: 'row', gap: Spacing.sm, marginTop: 2 },
  entryDate: { color: Colors.textMuted, fontSize: 11 },
  entryCat: { color: Colors.textMuted, fontSize: 11 },
  entryRight: { alignItems: 'flex-end', gap: 4 },
  entryAmount: { fontSize: 14, fontWeight: '600' },
  del: { color: Colors.textMuted, fontSize: 14 },
  empty: { alignItems: 'center', gap: Spacing.sm, marginTop: 60 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: Colors.text, fontSize: 18, fontWeight: '600' },
  emptyHint: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: Spacing.xl },
});
