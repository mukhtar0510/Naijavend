import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/tokens';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ListingsScreen } from '../screens/ListingsScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { BookingsScreen } from '../screens/BookingsScreen';
import { RatingsScreen } from '../screens/RatingsScreen';
import { StoreSettingsScreen } from '../screens/StoreSettingsScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { signOut } from '../store/useSessionStore';

export type Screen =
  | 'dashboard'
  | 'onboarding'
  | 'listings'
  | 'orders'
  | 'bookings'
  | 'ratings'
  | 'settings';

const TABS: Array<{ key: Screen; label: string }> = [
  { key: 'dashboard', label: 'Home' },
  { key: 'listings', label: 'Listings' },
  { key: 'orders', label: 'Orders' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'ratings', label: 'Ratings' },
  { key: 'settings', label: 'Settings' },
];

export function RootNavigator({ initialScreen }: { initialScreen: Screen }) {
  const [screen, setScreen] = useState<Screen>(initialScreen);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {screen === 'dashboard' && <DashboardScreen onNavigate={setScreen} />}
        {screen === 'onboarding' && <OnboardingScreen onDone={() => setScreen('dashboard')} />}
        {screen === 'listings' && <ListingsScreen />}
        {screen === 'orders' && <OrdersScreen />}
        {screen === 'bookings' && <BookingsScreen />}
        {screen === 'ratings' && <RatingsScreen />}
        {screen === 'settings' && <StoreSettingsScreen />}
      </ScrollView>

      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {TABS.map((tab) => (
            <Pressable key={tab.key} onPress={() => setScreen(tab.key)} style={[styles.tab, screen === tab.key && styles.tabActive]}>
              <Text style={[styles.tabLabel, screen === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={signOut} style={styles.tab}>
            <Text style={[styles.tabLabel, { color: colors.danger }]}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  body: { flex: 1 },
  bodyContent: { padding: spacing.m, paddingBottom: spacing.xl },
  tabBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.blackSurface,
  },
  tabBarContent: { paddingHorizontal: spacing.s, paddingVertical: spacing.s, gap: spacing.s },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.blackElevated,
  },
  tabActive: { backgroundColor: colors.blue },
  tabLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  tabLabelActive: { color: colors.black },
});
