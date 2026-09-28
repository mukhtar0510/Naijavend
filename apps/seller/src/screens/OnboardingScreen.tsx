import React, { useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { Button, Card, Input } from '../components/ui';
import { colors, spacing, typography } from '../theme/tokens';
import { supabase } from '../lib/supabase';

interface AiPreview {
  name: string;
  description: string;
  category: string;
}

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessType, setBusinessType] = useState<'product' | 'service' | 'hybrid'>('product');
  const [preview, setPreview] = useState<AiPreview | null>(null);
  const [useAi, setUseAi] = useState({ name: true, description: true, category: true });
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getSession();
      const token = auth.session?.access_token;
      const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/ai/draft-store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessDescription }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not draft your store.');
      setPreview(body.draft);
      setStep(2);
    } catch (err) {
      Alert.alert('AI draft failed', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getSession();
      const token = auth.session?.access_token;
      const { data: user } = await supabase.auth.getUser();
      const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          businessDescription,
          businessType,
          name,
          slug,
          description,
          category,
          useAiName: useAi.name,
          useAiDescription: useAi.description,
          useAiCategory: useAi.category,
          ownerUserId: user.user?.id,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not create your store.');
      onDone();
    } catch (err) {
      Alert.alert('Publish failed', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView>
      <Text style={typography.heading}>Set up your store</Text>

      {step === 1 && (
        <Card style={{ marginTop: spacing.m }}>
          <Text style={typography.body}>Describe your business</Text>
          <Input
            multiline
            value={businessDescription}
            onChangeText={setBusinessDescription}
            placeholder="e.g. I braid hair and do makeup for events in Surulere, Lagos. I also sell wigs."
            style={{ minHeight: 100, marginTop: spacing.s, textAlignVertical: 'top' }}
          />
          <Text style={typography.small}>The AI drafts your store name, description, and category. You edit before publishing.</Text>
          <View style={{ flexDirection: 'row', gap: spacing.s, marginTop: spacing.m }}>
            {(['product', 'service', 'hybrid'] as const).map((t) => (
              <Button key={t} label={t} variant={businessType === t ? 'primary' : 'outline'} onPress={() => setBusinessType(t)} />
            ))}
          </View>
          <Button label="Generate my store draft" onPress={generate} busy={busy} style={{ marginTop: spacing.m }} />
        </Card>
      )}

      {step === 2 && preview && (
        <Card style={{ marginTop: spacing.m }}>
          <Text style={typography.body}>Review the AI draft — edit anything.</Text>
          {(
            [
              ['name', 'Store name', preview.name],
              ['description', 'Description', preview.description],
            ] as const
          ).map(([field, label, aiValue]) => (
            <View key={field} style={{ marginTop: spacing.m }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={typography.body}>{label}</Text>
                <Switch
                  value={useAi[field as 'name' | 'description']}
                  onValueChange={(v) => setUseAi((prev) => ({ ...prev, [field]: v }))}
                  trackColor={{ true: colors.blue }}
                />
              </View>
              <Input
                multiline={field === 'description'}
                value={field === 'name' ? name : description}
                onChangeText={field === 'name' ? setName : setDescription}
                placeholder={aiValue}
                editable={!useAi[field as 'name' | 'description']}
                style={{ marginTop: spacing.s, textAlignVertical: 'top' }}
              />
            </View>
          ))}

          <View style={{ marginTop: spacing.m }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={typography.body}>Category</Text>
              <Switch value={useAi.category} onValueChange={(v) => setUseAi((prev) => ({ ...prev, category: v }))} trackColor={{ true: colors.blue }} />
            </View>
            <Text style={typography.small}>{useAi.category ? `AI suggests: ${preview.category}` : `Selected: ${category}`}</Text>
          </View>

          <View style={{ marginTop: spacing.m }}>
            <Text style={typography.body}>Store link</Text>
            <Input value={slug} onChangeText={(v) => setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="adaeze-braids" style={{ marginTop: spacing.s }} />
          </View>

          <Button label="Create my store" onPress={publish} busy={busy} style={{ marginTop: spacing.l }} />
          <Button label="Back" variant="outline" onPress={() => setStep(1)} style={{ marginTop: spacing.s }} />
        </Card>
      )}
    </ScrollView>
  );
}
