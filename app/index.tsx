import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import AthenaSphere from '@/components/sphere/AthenaSphere';
import { useAthena } from '@/contexts/AthenaContext';
import { useVoiceInteraction } from '@/hooks/useVoice';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getUser } from '@/lib/auth';

export default function HomeScreen() {
  const { mode, settings, initialized, amplitude } = useAthena();
  const { processMessage, stopSpeaking, transcript } = useVoiceInteraction();
  const [textInput, setTextInput]   = useState('');
  const [showText, setShowText]     = useState(false);

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!initialized) return;
    if (isSupabaseConfigured) {
      getUser().then(u => {
        if (!u) router.replace('/login');
        else if (!settings.anthropicApiKey) router.replace('/onboarding');
      });
    } else if (!settings.anthropicApiKey) {
      router.replace('/onboarding');
    }
  }, [initialized, settings.anthropicApiKey]);

  const handleSend = useCallback(async () => {
    if (!textInput.trim()) return;
    const text = textInput.trim();
    setTextInput('');
    setShowText(false);
    await processMessage(text);
  }, [textInput, processMessage]);

  const handleSpherePress = useCallback(() => {
    if (mode === 'speaking') stopSpeaking();
  }, [mode, stopSpeaking]);

  const modeLabel =
    mode === 'listening'  ? 'Listening...' :
    mode === 'thinking'   ? 'Processing...' :
    mode === 'speaking'   ? 'Speaking' : '';

  const wakeHint = mode === 'idle' && Platform.OS === 'web';

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {settings.userName ? `Hello, ${settings.userName}` : 'Hello'}
          </Text>
          <Text style={styles.subGreeting}>Say "Athena" to begin</Text>
        </View>
        <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/settings')}>
          <Text style={styles.menuIcon}>···</Text>
        </TouchableOpacity>
      </View>

      {/* Sphere */}
      <View style={styles.sphereArea}>
        <Pressable onPress={handleSpherePress}>
          <AthenaSphere mode={mode} amplitude={amplitude} size={310} />
        </Pressable>

        {/* Mode / transcript */}
        <View style={styles.statusArea}>
          {modeLabel ? (
            <Animated.Text
              key={mode}
              entering={FadeIn.duration(250)}
              exiting={FadeOut.duration(150)}
              style={styles.modeLabel}
            >
              {modeLabel}
            </Animated.Text>
          ) : null}

          {transcript && mode === 'listening' ? (
            <Animated.Text
              entering={FadeIn.duration(200)}
              style={styles.transcript}
              numberOfLines={2}
            >
              {transcript}
            </Animated.Text>
          ) : null}

          {wakeHint && !transcript ? (
            <Text style={styles.hint}>Say "Athena" to activate — tap sphere to stop</Text>
          ) : null}
        </View>
      </View>

      {/* Bottom controls */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottomArea}
      >
        {/* Text input (fallback) */}
        {showText && (
          <Animated.View
            entering={SlideInDown.duration(250)}
            exiting={SlideOutDown.duration(200)}
            style={styles.textRow}
          >
            <TextInput
              style={styles.textInput}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Type a message..."
              placeholderTextColor={Colors.textMuted}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.sendBtn, !textInput.trim() && styles.sendBtnOff]}
              onPress={handleSend}
              disabled={!textInput.trim()}
            >
              <Text style={styles.sendIcon}>→</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Keyboard toggle */}
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={styles.typeBtn}
            onPress={() => setShowText(v => !v)}
          >
            <Text style={styles.typeBtnText}>{showText ? '↓ Close' : '⌨ Type'}</Text>
          </TouchableOpacity>
        </View>

        {/* Nav bar */}
        <View style={styles.navBar}>
          <NavItem label="Brief"    onPress={() => router.push('/(tabs)/daily-brief')} active />
          <NavItem label="Schedule" onPress={() => router.push('/(tabs)/schedule')} />
          <NavItem label="Tasks"    onPress={() => router.push('/(tabs)/tasks')} />
          <NavItem label="Habits"   onPress={() => router.push('/(tabs)/habits')} />
          <NavItem label="Finance"  onPress={() => router.push('/(tabs)/finance')} />
          <NavItem label="Goals"    onPress={() => router.push('/(tabs)/goals')} />
          <NavItem label="Notes"    onPress={() => router.push('/(tabs)/notes')} />
          <NavItem label="Gmail"    onPress={() => router.push('/(tabs)/gmail')} />
          <NavItem label="Music"    onPress={() => router.push('/(tabs)/youtube')} />
          <NavItem label="Settings" onPress={() => router.push('/settings')} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function NavItem({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingTop: 58,
    paddingBottom: Spacing.sm,
  },
  greeting:    { color: Colors.text, fontSize: 22, fontWeight: '600', letterSpacing: 0.3 },
  subGreeting: { color: Colors.textMuted, fontSize: 12, marginTop: 2, letterSpacing: 0.4 },
  menuBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  menuIcon:    { color: Colors.textSecondary, fontSize: 22, letterSpacing: 2 },

  sphereArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  statusArea: { alignItems: 'center', minHeight: 52, gap: 6 },
  modeLabel: {
    color: Colors.primary,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  transcript: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    lineHeight: 20,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  bottomArea: { gap: 0, paddingBottom: Spacing.sm },
  textRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    paddingVertical: 12,
  },
  sendBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.35 },
  sendIcon:   { color: Colors.bg, fontSize: 17, fontWeight: '700' },

  typeRow: { alignItems: 'center', paddingVertical: 6 },
  typeBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6 },
  typeBtnText: { color: Colors.textMuted, fontSize: 12, letterSpacing: 0.5 },

  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.sm,
    paddingBottom: 22,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  navItem:       { alignItems: 'center', paddingVertical: 4 },
  navLabel:      { color: Colors.textMuted, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' },
  navLabelActive:{ color: Colors.primary, fontWeight: '700' },
});
