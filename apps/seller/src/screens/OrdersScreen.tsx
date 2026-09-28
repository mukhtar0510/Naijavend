import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { Badge, Button, Card } from '../components/ui';
import { colors, spacing, typography } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { formatNaira } from '@idevtenancy/shared';
import type { Order } from '@idevtenancy/shared';

export function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: store } = await supabase.from('stores').select('id').maybeSingle();
    if (!store) return;
    const { data } = await supabase.from('orders').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(50);
    setOrders((data as Order[] | null) ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function transition(order: Order, next: 'fulfilled' | 'cancelled') {
    const { error } = await supabase.from('orders').update({ status: next }).eq('id', order.id).eq('status', order.status);
    if (error) Alert.alert('Not allowed', 'The system rejected this status change. Payment status comes from the payment provider.');
    await load();
  }

  if (loading) return null;

  return (
    <View style={{ flex: 1 }}>
      <Text style={typography.heading}>Orders</Text>
      <Text style={typography.small}>Payment status arrives from the payment provider — you fulfill or cancel.</Text>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={typography.small}>No orders yet.</Text>}
        renderItem={({ item }) => (
          <Card style={{ marginTop: spacing.s }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
              <Badge
                label={item.status}
                tone={item.status === 'paid' ? 'cyan' : item.status === 'fulfilled' ? 'success' : item.status === 'cancelled' ? 'danger' : 'amber'}
              />
              <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>{formatNaira(item.total_kobo)}</Text>
            </View>
            <Text style={[typography.small, { marginTop: spacing.xs }]}>
              {item.customer_name} · {new Date(item.created_at).toLocaleDateString()}
            </Text>
            {item.status === 'paid' && (
              <Button label="Mark fulfilled" onPress={() => transition(item, 'fulfilled')} style={{ marginTop: spacing.s }} />
            )}
            {(item.status === 'pending' || item.status === 'paid') && (
              <Button label="Cancel" variant="outline" onPress={() => transition(item, 'cancelled')} style={{ marginTop: spacing.s }} />
            )}
          </Card>
        )}
      />
    </View>
  );
}
