import React, { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Card, Stars } from '../components/ui';
import { colors, spacing, typography } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import type { StoreRating, StoreRatingStats } from '@idevtenancy/shared';

export function RatingsScreen() {
  const [ratings, setRatings] = useState<Pick<StoreRating, 'stars' | 'comment' | 'created_at'>[]>([]);
  const [stats, setStats] = useState<StoreRatingStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: store } = await supabase.from('stores').select('id, store_rating_stats(review_count, avg_stars, overall_rank, category_rank)').maybeSingle();
    if (!store) return;
    const statsRow = ((store as unknown as { store_rating_stats: StoreRatingStats[] }).store_rating_stats ?? [])[0] ?? null;
    setStats(statsRow);
    const { data } = await supabase
      .from('store_ratings')
      .select('stars, comment, created_at')
      .eq('store_id', (store as unknown as { id: string }).id)
      .order('created_at', { ascending: false })
      .limit(50);
    setRatings((data as Pick<StoreRating, 'stars' | 'comment' | 'created_at'>[] | null) ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  if (loading) return null;

  return (
    <View style={{ flex: 1 }}>
      <Text style={typography.heading}>Ratings</Text>
      {stats && stats.review_count > 0 && (
        <Card elevated style={{ marginTop: spacing.s }}>
          <Stars value={Number(stats.avg_stars)} />
          <Text style={typography.small}>
            {stats.review_count} review{stats.review_count === 1 ? '' : 's'} · #{stats.overall_rank} overall · #{stats.category_rank} in your category
          </Text>
        </Card>
      )}
      <FlatList
        data={ratings}
        keyExtractor={(item, i) => String(i)}
        ListEmptyComponent={<Text style={typography.small}>No reviews yet — ask customers after each sale.</Text>}
        renderItem={({ item }) => (
          <Card style={{ marginTop: spacing.s }}>
            <Stars value={item.stars} />
            {item.comment ? <Text style={{ color: colors.text, marginTop: spacing.xs }}>{item.comment}</Text> : null}
            <Text style={typography.small}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </Card>
        )}
      />
    </View>
  );
}
