import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { useAthena } from '@/contexts/AthenaContext';
import AthenaSphere from '@/components/sphere/AthenaSphere';
import { Colors, Spacing, Radius } from '@/constants/theme';

type Step = 'welcome' | 'name' | 'apikey' | 'voice' | 'done';

export default function OnboardingScreen() {
  const { settings, updateSettings } = useAthena();
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [openAiKey, setOpenAiKey] = useState('');

  async function handleComplete() {
    await updateSettings({
      ...settings,
      userName: name.trim() || 'there',
      anthropicApiKey: apiKey.trim(),
      openAiApiKey: openAiKey.trim(),
    });
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Step: Welcome */}
        {step === 'welcome' && (
          <Animated.View entering={FadeIn.duration(600)} style={styles.step}>
            <View style={styles.sphereWrap}>
              <AthenaSphere mode="idle" size={180} />
            </View>
            <Text style={styles.title}>Meet Athena</Text>
            <Text style={styles.subtitle}>
              Your personal AI assistant — always listening, always ready. Think JARVIS, but yours.
            </Text>
            <Text style={styles.features}>
              — Voice-first interaction{'\n'}
              — Smart scheduling{'\n'}
              — Goal and habit tracking{'\n'}
              — Finance at a glance{'\n'}
              — Remembers everything you tell her
            </Text>
            <TouchableOpacity style={styles.btn} onPress={() => setStep('name')}>
              <Text style={styles.btnText}>Get started →</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Step: Name */}
        {step === 'name' && (
          <Animated.View entering={SlideInRight.duration(400)} style={styles.step}>
            <Text style={styles.stepNum}>1 / 3</Text>
            <Text style={styles.title}>What should Athena{'\n'}call you?</Text>
            <Text style={styles.subtitle}>She'll use your name in conversations.</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your first name"
              placeholderTextColor={Colors.textMuted}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => setStep('apikey')}
            />
            <TouchableOpacity style={styles.btn} onPress={() => setStep('apikey')}>
              <Text style={styles.btnText}>Continue →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('apikey')}>
              <Text style={styles.skip}>Skip for now</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Step: API Key */}
        {step === 'apikey' && (
          <Animated.View entering={SlideInRight.duration(400)} style={styles.step}>
            <Text style={styles.stepNum}>2 / 3</Text>
            <Text style={styles.title}>Connect Athena's brain</Text>
            <Text style={styles.subtitle}>
              Athena uses the Claude API to think and respond. Your key is stored locally — never shared.
            </Text>

            <Text style={styles.label}>Anthropic API Key *</Text>
            <TextInput
              style={styles.input}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="sk-ant-..."
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>
              Get yours at console.anthropic.com — required for Athena to function.
            </Text>

            <Text style={[styles.label, { marginTop: Spacing.lg }]}>OpenAI API Key (optional)</Text>
            <TextInput
              style={styles.input}
              value={openAiKey}
              onChangeText={setOpenAiKey}
              placeholder="sk-..."
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>
              Required for voice input (Whisper STT). Without it, use text input instead.
            </Text>

            <TouchableOpacity
              style={[styles.btn, !apiKey.trim() && styles.btnDisabled]}
              onPress={() => setStep('done')}
              disabled={!apiKey.trim()}
            >
              <Text style={styles.btnText}>Continue →</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <Animated.View entering={FadeIn.duration(600)} style={styles.step}>
            <View style={styles.sphereWrap}>
              <AthenaSphere mode="speaking" size={180} />
            </View>
            <Text style={styles.title}>
              {name ? `Welcome, ${name}.` : "You're all set."}
            </Text>
            <Text style={styles.subtitle}>
              Athena is ready. Hold the microphone button to speak, or tap the sphere to type.
            </Text>
            <Text style={styles.features}>
              💡 Try: "What's on my schedule today?"{'\n'}
              💡 Try: "Add a habit: meditate every morning"{'\n'}
              💡 Try: "I spent $30 on lunch"
            </Text>
            <TouchableOpacity style={styles.btn} onPress={handleComplete}>
              <Text style={styles.btnText}>Launch Athena ⚡</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  step: { alignItems: 'center', gap: Spacing.lg },
  sphereWrap: { marginVertical: Spacing.lg },
  stepNum: { color: Colors.textMuted, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: Colors.text, fontSize: 28, fontWeight: '700', textAlign: 'center', lineHeight: 36 },
  subtitle: { color: Colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  features: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 26,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'stretch',
  },
  label: { color: Colors.textSecondary, fontSize: 13, alignSelf: 'flex-start' },
  input: {
    alignSelf: 'stretch',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    color: Colors.text,
    fontSize: 15,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  hint: { color: Colors.textMuted, fontSize: 11, alignSelf: 'flex-start', lineHeight: 16 },
  btn: {
    alignSelf: 'stretch',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: Colors.bg, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  skip: { color: Colors.textMuted, fontSize: 13 },
});
