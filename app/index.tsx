import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import Animated, {
  FadeIn, FadeOut, SlideInDown, SlideOutDown,
  useSharedValue, useAnimatedStyle, withTiming,
} from 'react-native-reanimated';
import AthenaSphere from '@/components/sphere/AthenaSphere';
import VoiceButton from '@/components/voice/VoiceButton';
import { useAthena } from '@/contexts/AthenaContext';
import { useVoiceInteraction } from '@/hooks/useVoice';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getUser } from '@/lib/auth';
import type { Message } from '@/types';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const { mode, messages, settings, initialized, amplitude } = useAthena();
  const { startListening, stopListening, processMessage, stopSpeaking } = useVoiceInteraction();
  const [textInput, setTextInput] = useState('');
  const [showText, setShowText] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Auth guard: redirect to login if Supabase is configured and user is not logged in
  useEffect(() => {
    if (!initialized) return;
    if (isSupabaseConfigured) {
      getUser().then(user => {
        if (!user) router.replace('/login');
        else if (!settings.anthropicApiKey) router.replace('/onboarding');
      });
    } else if (!settings.anthropicApiKey) {
      router.replace('/onboarding');
    }
  }, [initialized, settings.anthropicApiKey]);

  // Scroll to bottom when new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!textInput.trim()) return;
    const text = textInput.trim();
    setTextInput('');
    setShowText(false);
    await processMessage(text);
  }, [textInput, processMessage]);

  const handleSpherePress = useCallback(() => {
    if (mode === 'speaking') {
      stopSpeaking();
    } else if (mode === 'idle') {
      setShowText(prev => !prev);
    }
  }, [mode, stopSpeaking]);

  const lastMessage = messages[messages.length - 1];
  const athenaMessage = messages.filter(m => m.role === 'athena').slice(-1)[0];

  return (
    <View style={styles.container}>
      {/* Background gradient dots */}
      <View style={styles.bgDots} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {settings.userName ? `Hello, ${settings.userName}` : 'Hello'}
          </Text>
          <Text style={styles.subGreeting}>I'm Athena — how can I help?</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push('/settings')}
        >
          <Text style={styles.settingsIcon}>···</Text>
        </TouchableOpacity>
      </View>

      {/* Sphere */}
      <View style={styles.sphereArea}>
        <Pressable onPress={handleSpherePress}>
          <AthenaSphere mode={mode} amplitude={amplitude} size={280} />
        </Pressable>

        {/* Mode label */}
        <Animated.Text
          key={mode}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          style={[styles.modeLabel, mode !== 'idle' && styles.modeLabelActive]}
        >
          {mode === 'idle' ? '' :
            mode === 'listening' ? 'Listening...' :
            mode === 'thinking' ? 'Processing...' :
            'Speaking'}
        </Animated.Text>
      </View>

      {/* Last Athena message bubble */}
      {athenaMessage && (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={styles.messageBubble}
        >
          <Text style={styles.messageBubbleText} numberOfLines={3}>
            {athenaMessage.content}
          </Text>
        </Animated.View>
      )}

      {/* Bottom controls */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottomArea}
      >
        {/* Text input (toggle) */}
        {showText && (
          <Animated.View
            entering={SlideInDown.duration(300)}
            exiting={SlideOutDown.duration(200)}
            style={styles.textInputRow}
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
              multiline={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !textInput.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!textInput.trim()}
            >
              <Text style={styles.sendIcon}>→</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Voice button */}
        <View style={styles.voiceRow}>
          <VoiceButton
            mode={mode}
            onPressIn={startListening}
            onPressOut={stopListening}
            onPress={mode === 'speaking' ? stopSpeaking : undefined}
          />
        </View>

        {/* Nav bar */}
        <View style={styles.navBar}>
          <NavItem label="Brief" onPress={() => router.push('/(tabs)/daily-brief')} highlight />
          <NavItem label="Schedule" onPress={() => router.push('/(tabs)/schedule')} />
          <NavItem label="Tasks" onPress={() => router.push('/(tabs)/tasks')} />
          <NavItem label="Habits" onPress={() => router.push('/(tabs)/habits')} />
          <NavItem label="Finance" onPress={() => router.push('/(tabs)/finance')} />
          <NavItem label="Goals" onPress={() => router.push('/(tabs)/goals')} />
          <NavItem label="Notes" onPress={() => router.push('/(tabs)/notes')} />
          <NavItem label="Gmail" onPress={() => router.push('/(tabs)/gmail')} />
          <NavItem label="Music" onPress={() => router.push('/(tabs)/youtube')} />
          <NavItem label="Settings" onPress={() => router.push('/settings')} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function NavItem({ label, onPress, highlight }: { label: string; onPress: () => void; highlight?: boolean }) {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
      <Text style={[styles.navLabel, highlight && styles.navLabelHighlight]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  bgDots: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
    // Subtle grid pattern via background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
  },
  greeting: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  subGreeting: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 22,
  },
  sphereArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  modeLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  modeLabelActive: {
    color: Colors.primary,
  },
  messageBubble: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    padding: Spacing.md,
  },
  messageBubbleText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  bottomArea: {
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  textInputRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    color: Colors.bg,
    fontSize: 18,
    fontWeight: '700',
  },
  voiceRow: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.md,
    paddingBottom: 24,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  navLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  navLabelHighlight: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
