import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Button, Card, Input } from '../components/ui';
import { colors, spacing, typography } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import * as Location from './LocationShim';

export function StoreSettingsScreen() {
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: store } = await supabase.from('stores').select('address, latitude, longitude, whatsapp_number').maybeSingle();
    if (store) {
      setAddress((store.address as string) ?? '');
      setLat(store.latitude != null ? String(store.latitude) : '');
      setLng(store.longitude != null ? String(store.longitude) : '');
      setWhatsapp((store.whatsapp_number as string) ?? '');
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function useMyLocation() {
    try {
      const pos = await Location.getCurrentPositionAsync({});
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
    } catch {
      Alert.alert('Location unavailable', 'Grant location permission or enter coordinates manually.');
    }
  }

  async function save() {
    setBusy(true);
    try {
      const { data: store } = await supabase.from('stores').select('id').maybeSingle();
      if (!store) throw new Error('Create your store first.');
      const { error } = await supabase
        .from('stores')
        .update({
          address,
          latitude: lat === '' ? null : Number(lat),
          longitude: lng === '' ? null : Number(lng),
          whatsapp_number: whatsapp.trim(),
        })
        .eq('id', store.id);
      if (error) throw error;
      Alert.alert('Saved', 'Store settings updated.');
    } catch (err) {
      Alert.alert('Save failed', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <ScrollView>
      <Text style={typography.heading}>Store settings</Text>

      <Card style={{ marginTop: spacing.m }}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>Location</Text>
        <Input placeholder="Address" value={address} onChangeText={setAddress} style={{ marginTop: spacing.s }} />
        <View style={{ flexDirection: 'row', gap: spacing.s, marginTop: spacing.s }}>
          <Input placeholder="Latitude" value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
          <Input placeholder="Longitude" value={lng} onChangeText={setLng} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
        </View>
        <Button label="Use my current location" variant="outline" onPress={useMyLocation} style={{ marginTop: spacing.s }} />
      </Card>

      <Card style={{ marginTop: spacing.m }}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>WhatsApp</Text>
        <Input placeholder="+2348012345678" keyboardType="phone-pad" value={whatsapp} onChangeText={setWhatsapp} style={{ marginTop: spacing.s }} />
        <Text style={typography.small}>Customers get a "Chat on WhatsApp" button with a pre-filled message.</Text>
      </Card>

      <Button label="Save settings" onPress={save} busy={busy} style={{ marginTop: spacing.l }} />
    </ScrollView>
  );
}
