import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  getInboxMessages, getUnreadCount, getMessageBody,
  sendEmail, saveDraft, markAsRead, isGmailConnected,
} from '@/lib/gmail';
import { speak } from '@/lib/voice';
import { getSettings } from '@/lib/database';
import { Colors, Spacing, Radius } from '@/constants/theme';
import type { GmailMessage } from '@/lib/gmail';

type Tab = 'inbox' | 'unread';

export default function GmailScreen() {
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [selected, setSelected] = useState<GmailMessage | null>(null);
  const [body, setBody] = useState('');
  const [bodyLoading, setBodyLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sendingState, setSendingState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const load = useCallback(async () => {
    setLoading(true);
    const ok = isGmailConnected();
    setConnected(ok);
    if (!ok) { setLoading(false); return; }

    const query = activeTab === 'unread' ? 'in:inbox is:unread' : 'in:inbox';
    const [msgs, count] = await Promise.all([
      getInboxMessages(30, query),
      getUnreadCount(),
    ]);
    setMessages(msgs);
    setUnreadCount(count);
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  async function openMessage(msg: GmailMessage) {
    setSelected(msg);
    setBody('');
    setBodyLoading(true);
    const text = await getMessageBody(msg.id);
    setBody(text);
    setBodyLoading(false);
    if (msg.unread) {
      await markAsRead(msg.id);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, unread: false } : m));
    }
  }

  async function handleReadAloud() {
    if (!selected) return;
    const settings = await getSettings();
    const text = `Email from ${selected.fromName}. Subject: ${selected.subject}. ${body || selected.snippet}`;
    await speak(text, settings.voice);
  }

  async function handleSend() {
    if (!composeTo.trim() || !composeSubject.trim()) return;
    setSendingState('sending');
    const ok = await sendEmail(composeTo.trim(), composeSubject.trim(), composeBody.trim());
    setSendingState(ok ? 'sent' : 'error');
    if (ok) setTimeout(() => { setShowCompose(false); setSendingState('idle'); setComposeTo(''); setComposeSubject(''); setComposeBody(''); }, 1500);
  }

  async function handleDraft() {
    if (!composeTo.trim()) return;
    await saveDraft(composeTo.trim(), composeSubject.trim(), composeBody.trim());
    setShowCompose(false);
    setComposeTo(''); setComposeSubject(''); setComposeBody('');
  }

  function relativeDate(ms: number): string {
    const diff = Date.now() - ms;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(ms).toLocaleDateString('en', { month: 'short', day: 'numeric' });
  }

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!loading && !connected) {
    return (
      <View style={styles.container}>
        <Header onBack={() => router.back()} onCompose={() => setShowCompose(true)} />
        <View style={styles.centered}>
          <Text style={styles.notConnectedTitle}>Gmail not connected</Text>
          <Text style={styles.notConnectedSub}>
            Go to Settings, disconnect Google, then reconnect to grant Gmail access.
          </Text>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/settings')}>
            <Text style={styles.settingsBtnText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Thread view ────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelected(null)}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.readAloudBtn} onPress={handleReadAloud}>
            <Text style={styles.readAloudBtnText}>Read aloud</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.threadScroll}>
          <Text style={styles.threadSubject}>{selected.subject}</Text>
          <View style={styles.threadMeta}>
            <Text style={styles.threadFrom}>{selected.fromName}</Text>
            <Text style={styles.threadDate}>{relativeDate(selected.date)}</Text>
          </View>
          <Text style={styles.threadFromEmail}>{selected.from}</Text>
          <View style={styles.divider} />
          {bodyLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
          ) : (
            <Text style={styles.threadBody}>{body || selected.snippet}</Text>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Inbox view ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Header
        onBack={() => router.back()}
        onCompose={() => setShowCompose(true)}
        unreadCount={unreadCount}
      />

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['inbox', 'unread'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'inbox' ? 'Inbox' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {messages.length === 0 && (
            <Text style={styles.emptyText}>No messages</Text>
          )}
          {messages.map(msg => (
            <Animated.View key={msg.id} entering={FadeIn}>
              <TouchableOpacity
                style={[styles.messageRow, msg.unread && styles.messageRowUnread]}
                onPress={() => openMessage(msg)}
                activeOpacity={0.7}
              >
                {msg.unread && <View style={styles.unreadDot} />}
                <View style={styles.messageLeft}>
                  <View style={styles.messageTopRow}>
                    <Text style={[styles.messageFrom, msg.unread && styles.messageBold]} numberOfLines={1}>
                      {msg.fromName}
                    </Text>
                    <Text style={styles.messageDate}>{relativeDate(msg.date)}</Text>
                  </View>
                  <Text style={[styles.messageSubject, msg.unread && styles.messageBold]} numberOfLines={1}>
                    {msg.subject}
                  </Text>
                  <Text style={styles.messageSnippet} numberOfLines={1}>{msg.snippet}</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Compose modal */}
      <Modal visible={showCompose} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.composeSheet}>
            <View style={styles.composeHeader}>
              <TouchableOpacity onPress={() => setShowCompose(false)}>
                <Text style={styles.composeCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.composeTitle}>New Message</Text>
              <View style={styles.composeSendRow}>
                <TouchableOpacity onPress={handleDraft}>
                  <Text style={styles.composeDraftBtn}>Draft</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.composeSendBtn, sendingState !== 'idle' && styles.composeSendBtnDisabled]}
                  onPress={handleSend}
                  disabled={sendingState !== 'idle'}
                >
                  <Text style={styles.composeSendBtnText}>
                    {sendingState === 'sending' ? 'Sending...' : sendingState === 'sent' ? 'Sent' : sendingState === 'error' ? 'Error' : 'Send'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <TextInput style={styles.composeField} placeholder="To" placeholderTextColor={Colors.textMuted}
              value={composeTo} onChangeText={setComposeTo} keyboardType="email-address" autoCapitalize="none" />
            <View style={styles.composeDivider} />
            <TextInput style={styles.composeField} placeholder="Subject" placeholderTextColor={Colors.textMuted}
              value={composeSubject} onChangeText={setComposeSubject} />
            <View style={styles.composeDivider} />
            <TextInput style={[styles.composeField, styles.composeBodyField]} placeholder="Message"
              placeholderTextColor={Colors.textMuted} value={composeBody} onChangeText={setComposeBody}
              multiline textAlignVertical="top" />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Header({ onBack, onCompose, unreadCount }: {
  onBack: () => void; onCompose: () => void; unreadCount?: number;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={styles.title}>Gmail</Text>
        {unreadCount !== undefined && unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>
      <TouchableOpacity onPress={onCompose}>
        <Text style={styles.composeIcon}>+</Text>
      </TouchableOpacity>
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
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: Colors.text, fontSize: 17, fontWeight: '600' },
  unreadBadge: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 1,
  },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  composeIcon: { color: Colors.primary, fontSize: 26, fontWeight: '300' },
  readAloudBtn: {
    backgroundColor: Colors.primaryDim, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    borderWidth: 1, borderColor: Colors.primary,
  },
  readAloudBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { color: Colors.textMuted, fontSize: 13 },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },

  scroll: { paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },

  messageRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  messageRowUnread: { backgroundColor: Colors.bgSurface },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary, flexShrink: 0 },
  messageLeft: { flex: 1 },
  messageTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  messageFrom: { color: Colors.textSecondary, fontSize: 14, flex: 1 },
  messageBold: { color: Colors.text, fontWeight: '600' },
  messageDate: { color: Colors.textMuted, fontSize: 11 },
  messageSubject: { color: Colors.textSecondary, fontSize: 14, marginTop: 2 },
  messageSnippet: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  threadScroll: { padding: Spacing.lg, paddingBottom: 60 },
  threadSubject: { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: Spacing.md },
  threadMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  threadFrom: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  threadDate: { color: Colors.textMuted, fontSize: 12 },
  threadFromEmail: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },
  threadBody: { color: Colors.text, fontSize: 14, lineHeight: 22 },

  notConnectedTitle: { color: Colors.text, fontSize: 18, fontWeight: '600', marginBottom: Spacing.sm },
  notConnectedSub: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.lg },
  settingsBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl, paddingVertical: 12,
  },
  settingsBtnText: { color: '#fff', fontWeight: '600' },
  emptyText: { color: Colors.textMuted, textAlign: 'center', marginTop: 60, fontSize: 14 },

  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  composeSheet: {
    backgroundColor: Colors.bgSurface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: Colors.border,
    minHeight: 420,
  },
  composeHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  composeCancel: { color: Colors.textSecondary, fontSize: 15 },
  composeTitle: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  composeSendRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  composeDraftBtn: { color: Colors.textSecondary, fontSize: 14 },
  composeSendBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 7,
  },
  composeSendBtnDisabled: { opacity: 0.5 },
  composeSendBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  composeField: {
    color: Colors.text, fontSize: 14,
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
  },
  composeDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.lg },
  composeBodyField: { flex: 1, minHeight: 200, textAlignVertical: 'top' },
});
