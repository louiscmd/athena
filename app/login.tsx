import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { signIn, signUp, getUser } from '@/lib/auth';
import { syncFromCloud } from '@/lib/sync';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAthena } from '@/contexts/AthenaContext';

export default function LoginScreen() {
  const { loadSettings } = useAthena();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // If already logged in, sync and go straight to the app
  useEffect(() => {
    getUser().then(async user => {
      if (user) {
        await syncFromCloud();
        await loadSettings(); // refresh React state with cloud data
        router.replace('/');
      } else {
        setChecking(false);
      }
    });
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }]}>
        <Text style={styles.logo}>ATHENA</Text>
        <Text style={[styles.subtitle, { textAlign: 'center', marginTop: Spacing.lg }]}>
          Account system not configured yet.{'\n'}
          Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to Vercel env vars.
        </Text>
        <TouchableOpacity style={[styles.btn, { marginTop: Spacing.xl }]} onPress={() => router.replace('/')}>
          <Text style={styles.btnText}>Continue without account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (checking) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  async function handleSubmit() {
    setError('');
    setSuccess('');
    const e = email.trim().toLowerCase();
    const p = password.trim();

    if (!e || !p) { setError('Email and password are required.'); return; }
    if (tab === 'signup' && p !== confirmPassword.trim()) {
      setError('Passwords do not match.'); return;
    }
    if (p.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      if (tab === 'signup') {
        await signUp(e, p);
        setSuccess('Account created. Check your email to confirm, then sign in.');
        setTab('signin');
        setPassword('');
        setConfirmPassword('');
      } else {
        await signIn(e, p);
        // Pull cloud data → update localStorage → refresh React state
        await syncFromCloud();
        await loadSettings();
        router.replace('/');
      }
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View entering={FadeIn.duration(600)} style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoRing}>
            <Text style={styles.logoLetter}>A</Text>
          </View>
          <Text style={styles.logo}>ATHENA</Text>
          <Text style={styles.subtitle}>Your personal AI assistant</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'signin' && styles.tabActive]}
            onPress={() => { setTab('signin'); setError(''); setSuccess(''); }}
          >
            <Text style={[styles.tabText, tab === 'signin' && styles.tabTextActive]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'signup' && styles.tabActive]}
            onPress={() => { setTab('signup'); setError(''); setSuccess(''); }}
          >
            <Text style={[styles.tabText, tab === 'signup' && styles.tabTextActive]}>Create Account</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={v => { setEmail(v); setError(''); }}
            placeholder="Email"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={v => { setPassword(v); setError(''); }}
            placeholder="Password"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            textContentType={tab === 'signup' ? 'newPassword' : 'password'}
          />
          {tab === 'signup' && (
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={v => { setConfirmPassword(v); setError(''); }}
              placeholder="Confirm password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              textContentType="newPassword"
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.successText}>{success}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{tab === 'signin' ? 'Sign In' : 'Create Account'}</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.legal}>
          Your data is encrypted and stored securely.{'\n'}API keys never leave your device except to their respective services.
        </Text>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
  },
  inner: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },
  logoArea: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryDim,
  },
  logoLetter: {
    color: Colors.primary,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 2,
  },
  logo: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 6,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.md,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  form: {
    gap: Spacing.md,
  },
  input: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: 15,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
  },
  error: {
    color: '#e74c3c',
    fontSize: 13,
    textAlign: 'center',
  },
  successText: {
    color: Colors.success,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  legal: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
