import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Switch, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAthena } from '@/contexts/AthenaContext';
import Card from '@/components/ui/Card';
import { Colors, Spacing, Radius } from '@/constants/theme';
import {
  connectGoogleCalendar, disconnectGoogleCalendar, isGoogleCalendarConnected,
} from '@/lib/google-calendar';
import { getUser, signOut } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function SettingsScreen() {
  const { settings, updateSettings } = useAthena();
  const [form, setForm] = useState({ ...settings });
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    setGcalConnected(isGoogleCalendarConnected());
    if (isSupabaseConfigured) {
      getUser().then(u => { if (u) setUserEmail(u.email); });
    }
  }, []);

  async function handleGcalConnect() {
    const clientId = form.googleClientId.trim();
    if (!clientId) {
      Alert.alert('Missing Client ID', 'Enter your Google OAuth Client ID first.');
      return;
    }
    // Save settings first, then redirect to Google — page will navigate away
    await updateSettings({ ...settings, ...form });
    await connectGoogleCalendar(clientId); // triggers window.location redirect
  }

  function handleGcalDisconnect() {
    disconnectGoogleCalendar();
    setGcalConnected(false);
  }

  async function handleSave() {
    await updateSettings(form);
    Alert.alert('Saved', 'Settings updated.');
    router.back();
  }

  function update<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.save}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Account */}
        {isSupabaseConfigured && (
          <Section title="Account">
            <View style={styles.accountRow}>
              <View style={styles.accountInfo}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarLetter}>
                    {userEmail ? userEmail[0].toUpperCase() : 'A'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.accountEmail}>{userEmail || 'Signed in'}</Text>
                  <Text style={styles.accountSyncLabel}>Data synced to cloud</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.signOutBtn}
                onPress={async () => {
                  await signOut();
                  router.replace('/login');
                }}
              >
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </Section>
        )}

        {/* Profile */}
        <Section title="Profile">
          <Field label="Your name">
            <TextInput
              style={styles.input}
              value={form.userName}
              onChangeText={v => update('userName', v)}
              placeholder="First name"
              placeholderTextColor={Colors.textMuted}
            />
          </Field>
          <Field label="Currency">
            <TextInput
              style={styles.input}
              value={form.currency}
              onChangeText={v => update('currency', v.toUpperCase())}
              placeholder="USD"
              placeholderTextColor={Colors.textMuted}
              maxLength={3}
              autoCapitalize="characters"
            />
          </Field>
        </Section>

        {/* API Keys */}
        <Section title="API Keys">
          <Field label="Anthropic API Key (required)">
            <TextInput
              style={styles.input}
              value={form.anthropicApiKey}
              onChangeText={v => update('anthropicApiKey', v)}
              placeholder="sk-ant-..."
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
          <Field label="OpenAI API Key (for voice input)">
            <TextInput
              style={styles.input}
              value={form.openAiApiKey}
              onChangeText={v => update('openAiApiKey', v)}
              placeholder="sk-... (optional)"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
        </Section>

        {/* Voice */}
        <Section title="Voice">
          <Field label={`Speech speed: ${form.voice.speed.toFixed(1)}x`}>
            <View style={styles.sliderRow}>
              {[0.7, 0.85, 1.0, 1.15, 1.3].map(v => (
                <TouchableOpacity
                  key={v}
                  style={[styles.chip, form.voice.speed === v && styles.chipActive]}
                  onPress={() => update('voice', { ...form.voice, speed: v })}
                >
                  <Text style={[styles.chipText, form.voice.speed === v && styles.chipTextActive]}>
                    {v}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <Row
            label="Daily briefing"
            value={form.notifications.dailyBriefing}
            onChange={v => update('notifications', { ...form.notifications, dailyBriefing: v })}
          />
          <Row
            label="Task reminders"
            value={form.notifications.taskReminders}
            onChange={v => update('notifications', { ...form.notifications, taskReminders: v })}
          />
          <Row
            label="Habit reminders"
            value={form.notifications.habitReminders}
            onChange={v => update('notifications', { ...form.notifications, habitReminders: v })}
          />
        </Section>

        {/* Connections */}
        <Section title="Connections">
          <Field label="YouTube Data API v3 Key">
            <TextInput
              style={styles.input}
              value={form.youtubeApiKey ?? ''}
              onChangeText={v => update('youtubeApiKey', v)}
              placeholder="AIza..."
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
          <Text style={styles.fieldHint}>
            Enable "YouTube Data API v3" in Google Cloud Console → APIs, then create an API key (not OAuth). Free tier: 10,000 units/day.
          </Text>

          <Field label="Google OAuth Client ID">
            <TextInput
              style={styles.input}
              value={form.googleClientId}
              onChangeText={v => update('googleClientId', v)}
              placeholder="xxxx.apps.googleusercontent.com"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
          <Text style={styles.fieldHint}>
            In Google Cloud Console → Credentials → your OAuth Client → Authorized JavaScript origins, add exactly:{'\n'}
            {typeof window !== 'undefined' ? window.location.origin : 'https://athena-pied-one.vercel.app'}
          </Text>
          <View style={styles.connectRow}>
            <View style={styles.connectStatus}>
              <View style={[styles.connectDot, gcalConnected && styles.connectDotOn]} />
              <Text style={styles.connectLabel}>
                Google Calendar — {gcalConnected ? 'Connected' : 'Not connected'}
              </Text>
            </View>
            {gcalConnected ? (
              <TouchableOpacity style={styles.disconnectBtn} onPress={handleGcalDisconnect}>
                <Text style={styles.disconnectBtnText}>Disconnect</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.connectBtn, gcalLoading && styles.connectBtnDisabled]}
                onPress={handleGcalConnect}
                disabled={gcalLoading}
              >
                <Text style={styles.connectBtnText}>{gcalLoading ? 'Connecting...' : 'Connect'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Section>

        {/* Info */}
        <Card style={styles.info}>
          <Text style={styles.infoText}>
            Athena stores all data locally on your device. API keys are never sent anywhere except directly to Anthropic, OpenAI, and Google.
          </Text>
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card>{children}</Card>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.bgElevated, true: Colors.primary }}
        thumbColor={Colors.bg}
      />
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
  save: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  scroll: { padding: Spacing.lg, gap: Spacing.xl },
  section: { gap: Spacing.sm },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.xs,
  },
  field: { gap: Spacing.xs, paddingVertical: Spacing.sm },
  fieldLabel: { color: Colors.textSecondary, fontSize: 12 },
  input: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  rowLabel: { color: Colors.text, fontSize: 15 },
  sliderRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  chipText: { color: Colors.textSecondary, fontSize: 13 },
  chipTextActive: { color: Colors.primary },
  connectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  connectStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  connectDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.textMuted,
  },
  connectDotOn: { backgroundColor: Colors.success },
  connectLabel: { color: Colors.text, fontSize: 14 },
  connectBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  connectBtnDisabled: { opacity: 0.5 },
  connectBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  disconnectBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  disconnectBtnText: { color: Colors.textMuted, fontSize: 13 },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  accountInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1, borderColor: Colors.borderGlow,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { color: Colors.primary, fontSize: 18, fontWeight: '700' },
  accountEmail: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  accountSyncLabel: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  signOutBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  signOutText: { color: Colors.textMuted, fontSize: 13 },
  info: {
    marginTop: Spacing.md,
    borderColor: Colors.borderGlow,
  },
  infoText: { color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  fieldHint: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: Spacing.xs,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
});
