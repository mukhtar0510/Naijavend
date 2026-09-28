import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { Badge, Button, Card } from '../components/ui';
import { colors, spacing, typography } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import type { Booking } from '@idevtenancy/shared';

interface BookingRow extends Booking {
  listings?: { title: string } | null;
}

export function BookingsScreen() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: store } = await supabase.from('stores').select('id').maybeSingle();
    if (!store) return;
    const { data: listings } = await supabase.from('listings').select('id').eq('store_id', store.id);
    const ids = (listings ?? []).map((l) => l.id);
    if (ids.length === 0) {
      setBookings([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('bookings')
      .select('*, listings(title)')
      .in('listing_id', ids)
      .order('slot_start', { ascending: true })
      .limit(50);
    setBookings((data as BookingRow[] | null) ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function transition(booking: BookingRow, next: 'confirmed' | 'completed' | 'cancelled') {
    const { error } = await supabase.from('bookings').update({ status: next }).eq('id', booking.id).eq('status', booking.status);
    if (error) Alert.alert('Not allowed', (error as Error).message);
    await load();
  }

  if (loading) return null;

  return (
    <View style={{ flex: 1 }}>
      <Text style={typography.heading}>Bookings</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={typography.small}>No bookings yet.</Text>}
        renderItem={({ item }) => (
          <Card style={{ marginTop: spacing.s }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
              <Badge label={item.status} tone={item.status === 'confirmed' ? 'cyan' : item.status === 'completed' ? 'success' : item.status === 'cancelled' ? 'danger' : 'amber'} />
              <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>{item.listings?.title ?? 'Service'}</Text>
            </View>
            <Text style={[typography.small, { marginTop: spacing.xs }]}>
              {item.customer_name} · {new Date(item.slot_start).toLocaleString()}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.s, marginTop: spacing.s, flexWrap: 'wrap' }}>
              {item.status === 'pending' && <Button label="Confirm" onPress={() => transition(item, 'confirmed')} />}
              {item.status === 'confirmed' && <Button label="Complete" onPress={() => transition(item, 'completed')} />}
              {item.status === 'pending' && <Button label="Decline" variant="outline" onPress={() => transition(item, 'cancelled')} />}
            </View>
          </Card>
        )}
      />
    </View>
  );
}
