import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { Badge, Button, Card, Input } from '../components/ui';
import { colors, spacing, typography } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { formatNaira } from '@idevtenancy/shared';
import type { Listing } from '@idevtenancy/shared';

export function ListingsScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [type, setType] = useState<'product' | 'service'>('product');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: store } = await supabase.from('stores').select('id').maybeSingle();
    if (!store) return;
    const { data } = await supabase.from('listings').select('*').eq('store_id', store.id).order('created_at', { ascending: false });
    setListings((data as Listing[] | null) ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function addListing() {
    setBusy(true);
    try {
      const { data: store } = await supabase.from('stores').select('id').maybeSingle();
      if (!store) throw new Error('Create your store first.');
      const { error } = await supabase.from('listings').insert({
        store_id: store.id,
        type,
        title: title.trim(),
        description: description.trim(),
        price_kobo: Math.round((Number(price) || 0) * 100),
        is_bookable: type === 'service',
      });
      if (error) throw error;
      setTitle('');
      setPrice('');
      setDescription('');
      await load();
    } catch (err) {
      Alert.alert('Could not add listing', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Text style={typography.heading}>Listings</Text>
      {loading ? null : listings.length === 0 ? (
        <Text style={typography.small}>Nothing listed yet — add your first product or service below.</Text>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card style={{ marginTop: spacing.s }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
                <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>{item.title}</Text>
                <Badge label={item.type} tone="blue" />
              </View>
              <Text style={[typography.small, { marginTop: spacing.xs }]}>{formatNaira(item.price_kobo)}</Text>
            </Card>
          )}
          style={{ marginBottom: spacing.m }}
        />
      )}

      <Card elevated>
        <Text style={{ color: colors.text, fontWeight: '600', marginBottom: spacing.s }}>Add a listing</Text>
        <View style={{ flexDirection: 'row', gap: spacing.s, marginBottom: spacing.s }}>
          <Button label="Product" variant={type === 'product' ? 'primary' : 'outline'} onPress={() => setType('product')} />
          <Button label="Service" variant={type === 'service' ? 'primary' : 'outline'} onPress={() => setType('service')} />
        </View>
        <Input placeholder="Title" value={title} onChangeText={setTitle} style={{ marginBottom: spacing.s }} />
        <Input placeholder="Price (₦)" keyboardType="decimal-pad" value={price} onChangeText={setPrice} style={{ marginBottom: spacing.s }} />
        <Input placeholder="Description" multiline value={description} onChangeText={setDescription} style={{ marginBottom: spacing.s, minHeight: 64, textAlignVertical: 'top' }} />
        <Button label="Add listing" onPress={addListing} busy={busy} />
      </Card>
    </View>
  );
}
