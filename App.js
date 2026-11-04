import PeerAccount from './PeerAccount';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Keyboard, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const moods = ['Having a hard day', 'Taking it day by day', 'Feeling hopeful'];

const journalKey = 'rebound.journal.v1';

const tabs = ['Today', 'Journal', 'Peer Support'];
const pageCopy = {
  Today: ['Recovery has its own pace.', 'Check in with yourself and choose one small goal.'],
  Journal: ['Your recovery journal', 'Reflect on your week and revisit the moments you pinned.'],
  'Peer Support': ['Find your people', 'Manage your profile and explore the peer matching preview.'],
};

export default function App() {
  const [tab, setTab] = useState('Today');
  const [showHistory, setShowHistory] = useState(false);
  const scroll = React.useRef(null);
  const [title, subtitle] = pageCopy[tab];

  function selectTab(next) {
    if (next === tab) return;
    Keyboard.dismiss();
    setTab(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  const [mood, setMood] = useState(null);

  const [note, setNote] = useState('');
  const [entries, setEntries] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let active = true;
    async function loadJournal() {
      try {
        const stored = await AsyncStorage.getItem(journalKey);
        const journal = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(journal)) throw new Error('Invalid journal');
        if (active) setEntries(journal);
      } catch {
        if (active) setStatus('Could not load your journal. Reopen REBOUND to try again.');
      }
    }
    loadJournal();
    return () => { active = false; };
  }, []);

  const canSave = Boolean(mood && entries && !saving);

  async function saveCheckIn() {
    if (!canSave) return;
    setSaving(true);
    setStatus('');
    const updated = [{ mood, note: note.trim(), date: new Date().toISOString() }, ...entries];
    try {
      await AsyncStorage.setItem(journalKey, JSON.stringify(updated));
      setEntries(updated);
      setMood(null);
      setNote('');
      setStatus('Check-in saved.');
    } catch {
      setStatus('Could not save your check-in. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView ref={scroll} style={styles.page}
        contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>REBOUND</Text>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.body}>{subtitle}</Text>
        {tab === 'Today' && <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>How are you feeling?</Text>
          {moods.map((option) => (
            <Pressable key={option} accessibilityRole="button"
              accessibilityState={{ selected: mood === option }}
              disabled={saving} onPress={() => setMood(option)}
              style={[styles.button, mood === option && styles.selected]}>
              <Text style={[styles.label, mood === option && styles.selectedLabel]}>{option}</Text>
            </Pressable>
          ))}
          <TextInput accessibilityLabel="Optional journal note" placeholder="What stood out today?"
            multiline maxLength={500} editable={!saving} value={note} onChangeText={setNote}
            style={[styles.button, styles.note]} />
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSave }}
            disabled={!canSave} onPress={saveCheckIn}
            style={[styles.button, canSave && styles.selected]}>
            <Text style={[styles.label, canSave && styles.selectedLabel]}>
              {saving ? 'Saving…' : 'Save check-in'}
            </Text>
          </Pressable>
          {status ? <Text accessibilityLiveRegion="polite" style={styles.body}>{status}</Text> : null}
        </View>}
        <RecoveryTools entries={entries} tab={tab} />
        {tab === 'Journal' && <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>Check-in history</Text>
          <Text style={styles.body}>Check-ins are stored on this device.</Text>
          {entries?.length === 0 && <Text style={styles.body}>Your saved check-ins will appear here.</Text>}
          <Action label={showHistory ? 'Hide full history' : 'Show full history'}
            onPress={() => setShowHistory(!showHistory)} />
          {showHistory && entries?.map((entry, index) => (
            <View key={entry.date + index} style={styles.button}>
              <Text style={styles.body}>{new Date(entry.date).toLocaleString()}</Text>
              <Text style={styles.label}>{entry.mood}</Text>
              {entry.note ? <Text style={styles.body}>{entry.note}</Text> : null}
            </View>
          ))}
        </View>}
        <View style={tab === 'Peer Support' ? undefined : styles.hidden}>
          <PeerAccount Action={Action} styles={styles} stages={stages} needs={needs} />
        </View>
      </ScrollView>
      <View style={styles.tabBar}>
        {tabs.map(item => (
          <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }}
            onPress={() => selectTab(item)} style={[styles.tab, tab === item && styles.selected]}>
            <Text style={[styles.tabLabel, tab === item && styles.selectedLabel]}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const goalIdeas = ['Text a teammate', 'Write a question for my next appointment', 'Make time for something I enjoy'];
const stages = ['First weeks away', 'Working through recovery', 'Returning to practice'];
const needs = ['Someone to listen', 'Shared experience', 'Encouragement'];
const samplePeers = [
  { name: 'Alex', stage: stages[0], needs: [needs[0], needs[2]] },
  { name: 'Jordan', stage: stages[1], needs: [needs[0], needs[1]] },
  { name: 'Sam', stage: stages[2], needs: [needs[1], needs[2]] },
];

function localDay(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map(part => String(part).padStart(2, '0')).join('-');
}

function Action({ label, onPress, selected, disabled }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled}
      accessibilityState={{ disabled: Boolean(disabled), selected }}
      onPress={onPress} style={[styles.button, selected && styles.selected]}>
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

function RecoveryTools({ entries, tab }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [stage, setStage] = useState(stages[0]);
  const [need, setNeed] = useState(needs[0]);
  const [optedIn, setOptedIn] = useState(false);
  const storageKey = 'rebound.recovery.v1';

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then(stored => {
      setData(stored ? JSON.parse(stored) : { goals: {}, pins: [], blocked: [], reported: [] });
    }).catch(() => setError('Could not load your recovery tools. Reopen the app to retry.'));
  }, []);

  async function update(changes) {
    if (busy) return;
    setBusy(true);
    setError('');
    const updated = { ...data, ...changes };
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      setData(updated);
    } catch {
      setError('Could not save your change. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <Text style={styles.body}>{error || 'Loading recovery tools…'}</Text>;

  const today = localDay();
  const tomorrow = localDay(1);
  const goal = data.goals[today];
  const nextGoal = data.goals[tomorrow];
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  const recentEntries = entries?.filter(entry => new Date(entry.date) >= weekStart) ?? [];
  const pinnedEntries = entries?.filter(entry => data.pins.includes(entry.date)) ?? [];
  const wins = Object.entries(data.goals).filter(([day, item]) =>
    day >= localDay(-6) && day <= today && item.done);
  const matches = samplePeers.filter(peer => peer.stage === stage && peer.needs.includes(need)
    && !data.blocked.includes(peer.name));

  function moveGoal() {
    const goals = { ...data.goals, [tomorrow]: goal };
    delete goals[today];
    update({ goals });
  }

  function recapEntry(entry, pinned) {
    return (
      <View key={entry.date} style={styles.card}>
        <Text style={styles.label}>{entry.mood}</Text>
        <Text style={styles.body}>{new Date(entry.date).toLocaleDateString()}</Text>
        {entry.note ? <Text style={styles.body}>{entry.note}</Text> : null}
        <Action label={pinned ? 'Unpin check-in' : 'Pin check-in'} disabled={busy}
          onPress={() => update({ pins: pinned
            ? data.pins.filter(date => date !== entry.date)
            : [...data.pins, entry.date] })} />
      </View>
    );
  }

  return (
    <>
      {error ? <Text accessibilityLiveRegion="polite" style={styles.body}>{error}</Text> : null}
      <View style={tab === 'Today' ? styles.card : styles.hidden}>
        <Text accessibilityRole="header" style={styles.heading}>Today's small goal</Text>
        {goal ? (
          <>
            <Text style={styles.label}>{goal.text}</Text>
            <Text style={styles.body}>{goal.done ? 'Completed' : 'In progress'}</Text>
            <Action label={goal.done ? 'Mark incomplete' : 'Mark done'} disabled={busy}
              onPress={() => update({ goals: { ...data.goals, [today]: { ...goal, done: !goal.done } } })} />
            {!goal.done && !nextGoal && <Action label="Move to tomorrow" disabled={busy} onPress={moveGoal} />}
          </>
        ) : (
          <>
            {goalIdeas.map(idea => <Action key={idea} label={idea} selected={draft === idea}
              disabled={busy} onPress={() => setDraft(idea)} />)}
            <TextInput accessibilityLabel="Your goal" placeholder="Or write your own"
              maxLength={120} value={draft} onChangeText={setDraft} editable={!busy} style={styles.button} />
            <Action label="Set today's goal" disabled={busy || !draft.trim()}
              onPress={() => update({ goals: { ...data.goals, [today]: { text: draft.trim(), done: false } } })} />
          </>
        )}
        {nextGoal ? <Text style={styles.body}>Tomorrow: {nextGoal.text}</Text> : null}
      </View>
      <View style={tab === 'Journal' ? styles.card : styles.hidden}>
        <Text accessibilityRole="header" style={styles.heading}>Your last 7 days</Text>
        <Text style={styles.body}>{recentEntries.length} check-ins · {wins.length} goals completed</Text>
        {wins.map(([day, item]) => <Text key={day} style={styles.label}>✓ {item.text}</Text>)}
        {recentEntries.map(entry => recapEntry(entry, data.pins.includes(entry.date)))}
        {pinnedEntries.length > 0 && (
          <>
            <Text accessibilityRole="header" style={styles.heading}>Pinned check-ins</Text>
            {pinnedEntries.map(entry => recapEntry(entry, true))}
          </>
        )}
      </View>
      <View style={tab === 'Peer Support' ? styles.card : styles.hidden}>
        <Text accessibilityRole="header" style={styles.heading}>Peer support preview</Text>
        <Text style={styles.body}>Explore how matching could work with fictional profiles. Messages and reports stay in this preview.</Text>
        <Action label={optedIn ? 'Leave preview' : 'Try matching'} onPress={() => setOptedIn(!optedIn)} />
        {optedIn && (
          <>
            <Text style={styles.label}>Where are you in recovery?</Text>
            {stages.map(item => <Action key={item} label={item} selected={stage === item}
              onPress={() => setStage(item)} />)}
            <Text style={styles.label}>What kind of support would help?</Text>
            {needs.map(item => <Action key={item} label={item} selected={need === item}
              onPress={() => setNeed(item)} />)}
            {matches.length === 0 && <Text style={styles.body}>No sample matches for this selection.</Text>}
            {matches.map(peer => (
              <PeerPreview key={peer.name} peer={peer} busy={busy}
                reported={data.reported.includes(peer.name)}
                onReport={() => update({ reported: [...data.reported, peer.name] })}
                onBlock={() => update({ blocked: [...data.blocked, peer.name] })} />
            ))}
            {data.blocked.map(name => <Action key={name} label={`Unblock ${name} (sample)`}
              disabled={busy} onPress={() => update({ blocked: data.blocked.filter(item => item !== name) })} />)}
          </>
        )}
      </View>
    </>
  );
}

function PeerPreview({ peer, busy, reported, onReport, onBlock }) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([]);

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{peer.name} · Sample profile</Text>
      {messages.map((message, index) => <Text key={index} style={styles.body}>You (preview): {message}</Text>)}
      <TextInput accessibilityLabel="Practice message" placeholder="Write a practice message"
        maxLength={300} value={draft} onChangeText={setDraft} style={styles.button} />
      <Action label="Add to practice chat" disabled={!draft.trim()} onPress={() => {
        setMessages([...messages, draft.trim()]);
        setDraft('');
      }} />
      <Action label={reported ? 'Sample report saved' : 'Report sample profile'}
        disabled={busy || reported} onPress={onReport} />
      <Action label="Block sample profile" disabled={busy} onPress={onBlock} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F2' },
  page: { flex: 1 },
  content: { padding: 20, gap: 16 },
  hidden: { display: 'none' },
  tabBar: { flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#BFCFC4' },
  tab: { flex: 1, minHeight: 48, justifyContent: 'center', padding: 8, borderRadius: 12 },
  tabLabel: { textAlign: 'center', color: '#285943', fontWeight: '700' },
  brand: { color: '#285943', fontSize: 15, fontWeight: '800', letterSpacing: 3 },
  title: { color: '#142D23', fontSize: 38, fontWeight: '800' },
  body: { color: '#42554B', fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, gap: 12 },
  heading: { color: '#142D23', fontSize: 22, fontWeight: '700' },
  button: { backgroundColor: '#EDF4EE', borderRadius: 12, padding: 14 },
  note: { minHeight: 80, color: '#142D23', fontSize: 16, textAlignVertical: 'top' },
  selected: { backgroundColor: '#285943' },
  label: { color: '#142D23', fontSize: 16, fontWeight: '600' },
  selectedLabel: { color: '#FFFFFF' },
});
