import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import React, { useEffect, useState } from 'react';
import { AppState, Switch, Text, TextInput, View } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const client = url && key ? createClient(url, key, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
}) : null;

export default function PeerAccount({ Action, styles, stages, needs }) {
  const [session, setSession] = useState(undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!client) return;
    const { data: { subscription } } = client.auth.onAuthStateChange((event, next) => {
      setSession(next);
    });
    function updateRefresh(state) {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    }
    updateRefresh(AppState.currentState);
    const appState = AppState.addEventListener('change', updateRefresh);
    return () => {
      subscription.unsubscribe();
      appState.remove();
      client.auth.stopAutoRefresh();
    };
  }, []);

  async function authenticate(signUp) {
    setBusy(true);
    setStatus('');
    try {
      const credentials = { email: email.trim(), password };
      const { data, error } = signUp
        ? await client.auth.signUp(credentials)
        : await client.auth.signInWithPassword(credentials);
      if (error) throw error;
      setPassword('');
      if (signUp && !data.session) setStatus('Confirm your email, then return here and sign in.');
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setStatus('');
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>Peer support account</Text>
      {!client ? <Text style={styles.body}>Add your Supabase project settings to enable sign-in.</Text>
        : session === undefined ? <Text style={styles.body}>Loading account…</Text>
        : session ? (
          <>
            <Profile key={session.user.id} userId={session.user.id}
              Action={Action} styles={styles} stages={stages} needs={needs} />
            <Action label="Sign out" disabled={busy} onPress={signOut} />
          </>
        ) : (
          <>
            <TextInput accessibilityLabel="Email" placeholder="Email" value={email}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
              onChangeText={setEmail} style={styles.button} />
            <TextInput accessibilityLabel="Password" placeholder="Password" value={password}
              secureTextEntry autoCapitalize="none" onChangeText={setPassword} style={styles.button} />
            <Action label="Sign in" disabled={busy || !email.trim() || !password}
              onPress={() => authenticate(false)} />
            <Action label="Create account" disabled={busy || !email.trim() || !password}
              onPress={() => authenticate(true)} />
          </>
        )}
      {status ? <Text accessibilityLiveRegion="polite" style={styles.body}>{status}</Text> : null}
    </View>
  );
}

function Profile({ userId, Action, styles, stages, needs }) {
  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error } = await client.from('peer_profiles')
          .select('display_name,recovery_stage,support_preference,discoverable')
          .eq('user_id', userId).maybeSingle();
        if (error) throw error;
        if (active) setProfile(data ?? {
          display_name: '', recovery_stage: stages[0], support_preference: needs[0], discoverable: false,
        });
      } catch (error) {
        if (active) setStatus(error.message);
      }
    }
    load();
    return () => { active = false; };
  }, [userId, stages, needs]);

  async function save() {
    setBusy(true);
    setStatus('');
    try {
      const { error } = await client.from('peer_profiles').upsert({
        ...profile, user_id: userId, display_name: profile.display_name.trim(),
      });
      if (error) throw error;
      setStatus('Profile saved.');
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return <Text style={styles.body}>{status || 'Loading profile…'}</Text>;

  return (
    <>
      <Text style={styles.body}>Save your preferences for future matching. Your profile is currently visible only to you.</Text>
      <TextInput accessibilityLabel="Display name" placeholder="Display name" value={profile.display_name}
        maxLength={40} editable={!busy} style={styles.button}
        onChangeText={display_name => setProfile({ ...profile, display_name })} />
      <Text style={styles.label}>Recovery stage</Text>
      {stages.map(stage => <Action key={stage} label={stage} disabled={busy}
        selected={profile.recovery_stage === stage}
        onPress={() => setProfile({ ...profile, recovery_stage: stage })} />)}
      <Text style={styles.label}>Preferred support</Text>
      {needs.map(need => <Action key={need} label={need} disabled={busy}
        selected={profile.support_preference === need}
        onPress={() => setProfile({ ...profile, support_preference: need })} />)}
      <Text style={styles.label}>Opt in to future matching</Text>
      <Switch accessibilityLabel="Opt in to future matching" value={profile.discoverable} disabled={busy}
        onValueChange={discoverable => setProfile({ ...profile, discoverable })} />
      <Action label="Save peer profile" disabled={busy || !profile.display_name.trim()} onPress={save} />
      {status ? <Text accessibilityLiveRegion="polite" style={styles.body}>{status}</Text> : null}
    </>
  );
}
