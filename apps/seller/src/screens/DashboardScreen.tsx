import React, { useCallback, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, Stars } from '../components/ui';
import { colors, spacing, typography } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/api';
import type { Store, StoreRatingStats } from '@idevtenancy/shared';
import type { Screen } from '../navigation/RootNavigator';

export function DashboardScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [store, setStore] = useState<(Store & { stats: StoreRatingStats | null }) | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('stores')
      .select('*, store_rating_stats(review_count, avg_stars, overall_rank, category_rank)')
      .maybeSingle();
    if (data) {
      const { store_rating_stats, ...s } = data as unknown as Store & { store_rating_stats: StoreRatingStats[] };
      setStore({ ...s, stats: store_rating_stats?.[0] ?? null });
    } else {
      setStore(null);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  if (loading) return null;

  if (!store) {
    return (
      <View>
        <Text style={typography.heading}>Welcome</Text>
        <Text style={typography.small}>You haven't created a store yet.</Text>
        <Button label="Set up my store" onPress={() => onNavigate('onboarding')} style={{ marginTop: spacing.m }} />
      </View>
    );
  }

  const storeUrl = `${API_BASE_URL}/s/${store.slug}`;

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.blue} />}>
      <Text style={typography.heading}>{store.name}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.s, flexWrap: 'wrap', marginTop: spacing.s }}>
        <Badge label={store.category} tone="blue" />
        {store.stats && store.stats.overall_rank && store.stats.review_count >= 1 ? (
          <Badge label={`#${store.stats.overall_rank} overall · #${store.stats.category_rank} in ${store.category}`} tone="warning" />
        ) : (
          <Badge label="Unranked — get reviews" />
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.s, marginTop: spacing.m, flexWrap: 'wrap' }}>
        <StatCard label="Pending orders" onPress={() => onNavigate('orders')} />
        <StatCard label="Bookings" onPress={() => onNavigate('bookings')} />
      </View>

      {store.stats && store.stats.review_count > 0 && (
        <Card style={{ marginTop: spacing.m }}>
          <Stars value={Number(store.stats.avg_stars)} />
          <Text style={typography.small}>
            {store.stats.review_count} review{store.stats.review_count === 1 ? '' : 's'} · rank #{store.stats.overall_rank} overall
          </Text>
        </Card>
      )}

      <Card elevated style={{ marginTop: spacing.m }}>
        <Text style={{ color: colors.text, fontWeight: '600', marginBottom: spacing.s }}>Your public store page</Text>
        <Text style={styles.mono}>{storeUrl}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.s, marginTop: spacing.m, flexWrap: 'wrap' }}>
          <Button
            label="View my store"
            onPress={async () => {
              // Shopify-style: the live website opens in the in-app browser session,
              // keeping the seller inside the app.
              await Linking.openURL(storeUrl);
            }}
          />
          <Button label="Share link" variant="outline" onPress={() => Linking.openURL(`whatsapp://send?text=${encodeURIComponent(`Check out my store: ${storeUrl}`)}`)} />
        </View>
      </Card>
    </ScrollView>
  );
}

function StatCard({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Card elevated style={{ flex: 1, minWidth: 140 }}>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>{label}</Text>
      <Text onPress={onPress} style={{ color: colors.blue, marginTop: spacing.xs, fontSize: 14, fontWeight: '600' }}>
        View →
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  mono: { color: colors.blue, fontFamily: undefined, fontSize: 14 },
});
