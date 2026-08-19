import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { getNotes, updateNote, deleteNote, createNote } from '@/lib/database';
import Card from '@/components/ui/Card';
import { Colors, Spacing, Radius } from '@/constants/theme';
import type { Note } from '@/types';

export default function NotesScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Note | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const load = useCallback(async () => {
    setNotes(await getNotes());
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = search
    ? notes.filter(n =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.content.toLowerCase().includes(search.toLowerCase()),
      )
    : notes;

  const pinned = filtered.filter(n => n.pinned);
  const regular = filtered.filter(n => !n.pinned);

  async function togglePin(note: Note) {
    await updateNote(note.id, { pinned: !note.pinned });
    load();
  }

  async function remove(id: string) {
    Alert.alert('Delete Note', 'Remove this note?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteNote(id); load(); } },
    ]);
  }

  async function saveNew() {
    if (!newTitle.trim()) return;
    await createNote({ title: newTitle.trim(), content: newContent.trim(), tags: [], pinned: false });
    setNewTitle('');
    setNewContent('');
    setShowNew(false);
    load();
  }

  async function saveEdit(note: Note) {
    await updateNote(note.id, { title: note.title, content: note.content });
    setEditing(null);
    load();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notes</Text>
        <TouchableOpacity onPress={() => setShowNew(true)}>
          <Text style={styles.addBtn}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="🔍 Search notes..."
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {notes.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyText}>No notes yet</Text>
            <Text style={styles.emptyHint}>Tell Athena: "Note: call dentist next week" or tap + New</Text>
          </View>
        )}

        {pinned.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📌 Pinned</Text>
            {pinned.map(note => (
              <Animated.View key={note.id} entering={FadeIn}>
                <NoteCard note={note} onEdit={setEditing} onPin={togglePin} onDelete={remove} />
              </Animated.View>
            ))}
          </View>
        )}

        {regular.map(note => (
          <Animated.View key={note.id} entering={FadeIn}>
            <NoteCard note={note} onEdit={setEditing} onPin={togglePin} onDelete={remove} />
          </Animated.View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* New note modal */}
      <Modal visible={showNew} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowNew(false); setNewTitle(''); setNewContent(''); }}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Note</Text>
            <TouchableOpacity onPress={saveNew} disabled={!newTitle.trim()}>
              <Text style={[styles.modalSave, !newTitle.trim() && { opacity: 0.4 }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.noteTitleInput}
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="Title"
            placeholderTextColor={Colors.textMuted}
            autoFocus
            returnKeyType="next"
          />
          <TextInput
            style={styles.noteBodyInput}
            value={newContent}
            onChangeText={setNewContent}
            placeholder="Write something..."
            placeholderTextColor={Colors.textMuted}
            multiline
            textAlignVertical="top"
          />
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit note modal */}
      {editing && (
        <Modal visible animationType="slide" presentationStyle="pageSheet">
          <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditing(null)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Note</Text>
              <TouchableOpacity onPress={() => saveEdit(editing)}>
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.noteTitleInput}
              value={editing.title}
              onChangeText={t => setEditing(prev => prev ? { ...prev, title: t } : null)}
              placeholder="Title"
              placeholderTextColor={Colors.textMuted}
            />
            <TextInput
              style={styles.noteBodyInput}
              value={editing.content}
              onChangeText={c => setEditing(prev => prev ? { ...prev, content: c } : null)}
              placeholder="Write something..."
              placeholderTextColor={Colors.textMuted}
              multiline
              textAlignVertical="top"
              autoFocus
            />
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

function NoteCard({
  note, onEdit, onPin, onDelete,
}: {
  note: Note;
  onEdit: (n: Note) => void;
  onPin: (n: Note) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <TouchableOpacity onPress={() => onEdit(note)} activeOpacity={0.85}>
      <Card style={styles.noteCard} glow={note.pinned}>
        <View style={styles.noteTop}>
          <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
          <View style={styles.noteActions}>
            <TouchableOpacity onPress={() => onPin(note)}>
              <Text style={[styles.pinIcon, note.pinned && { color: Colors.primary }]}>📌</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(note.id)}>
              <Text style={styles.del}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
        {note.content ? (
          <Text style={styles.notePreview} numberOfLines={3}>{note.content}</Text>
        ) : null}
        <Text style={styles.noteDate}>
          {new Date(note.updatedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      </Card>
    </TouchableOpacity>
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
  addBtn: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  searchWrap: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  search: {
    backgroundColor: Colors.bgElevated, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, fontSize: 14,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  scroll: { padding: Spacing.lg, gap: Spacing.sm },
  section: { gap: Spacing.sm, marginBottom: Spacing.md },
  sectionTitle: { color: Colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  noteCard: { gap: Spacing.xs },
  noteTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  noteTitle: { color: Colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  noteActions: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  pinIcon: { fontSize: 14, color: Colors.textMuted },
  del: { color: Colors.textMuted, fontSize: 14 },
  notePreview: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  noteDate: { color: Colors.textMuted, fontSize: 11 },
  empty: { alignItems: 'center', gap: Spacing.sm, marginTop: 80 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: Colors.text, fontSize: 20, fontWeight: '600' },
  emptyHint: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: Spacing.xl },
  modal: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 60, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalCancel: { color: Colors.textSecondary, fontSize: 15 },
  modalTitle: { color: Colors.text, fontSize: 17, fontWeight: '600' },
  modalSave: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  noteTitleInput: {
    color: Colors.text, fontSize: 22, fontWeight: '600',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  noteBodyInput: {
    flex: 1, color: Colors.text, fontSize: 15, lineHeight: 24,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
});
