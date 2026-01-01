import { Text } from '@/ui/components/text';
import { View } from '@/ui/components/view';
import { useColor } from '@/ui/hooks/useColor';
import { SafeAreaView, ScrollView, Pressable, Linking } from 'react-native';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { Icon } from '@/ui/components/icon';
import React from 'react';

/**
 * Screen displaying research-backed information about affirmations
 * Includes science, practice methods, timelines, and tips
 */
export default function AffirmationScienceScreen() {
  const background = useColor('background');
  const text = useColor('text');
  const mutedText = useColor('textMuted');
  const border = useColor('border');
  const primary = useColor('primary');
  const card = useColor('card');

  const handleLinkPress = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: 32 }}>
      <Text variant="title" style={{ marginBottom: 16, color: text }}>
        {title}
      </Text>
      {children}
    </View>
  );

  const Subsection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: 24 }}>
      <Text variant="subtitle" style={{ marginBottom: 12, color: text }}>
        {title}
      </Text>
      {children}
    </View>
  );

  const ResearchLink = ({ url, label }: { url: string; label: string }) => (
    <Pressable onPress={() => handleLinkPress(url)}>
      <Text variant="link" style={{ color: primary, marginTop: 4 }}>
        {label}
      </Text>
    </Pressable>
  );

  const PracticeCard = ({
    title,
    duration,
    frequency,
    why,
    bestFor,
    techniques,
  }: {
    title: string;
    duration: string;
    frequency: string;
    why?: string;
    bestFor: string;
    techniques?: string[];
  }) => (
    <View
      style={{
        backgroundColor: card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <Text variant="subtitle" style={{ marginBottom: 8, color: text }}>
        {title}
      </Text>
      <View style={{ marginBottom: 8 }}>
        <Text variant="body" style={{ color: mutedText }}>
          <Text style={{ fontWeight: '600', color: text }}>Duration:</Text> {duration}
        </Text>
        <Text variant="body" style={{ color: mutedText, marginTop: 4 }}>
          <Text style={{ fontWeight: '600', color: text }}>Frequency:</Text> {frequency}
        </Text>
      </View>
      {why && (
        <Text variant="body" style={{ color: mutedText, marginBottom: 8, fontStyle: 'italic' }}>
          <Text style={{ fontWeight: '600', color: text }}>Why:</Text> {why}
        </Text>
      )}
      {techniques && techniques.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text variant="body" style={{ fontWeight: '600', color: text, marginBottom: 4 }}>
            Techniques:
          </Text>
          {techniques.map((technique, idx) => (
            <Text key={idx} variant="body" style={{ color: mutedText, marginLeft: 8 }}>
              • {technique}
            </Text>
          ))}
        </View>
      )}
      <Text variant="body" style={{ color: mutedText }}>
        <Text style={{ fontWeight: '600', color: text }}>Best for:</Text> {bestFor}
      </Text>
    </View>
  );

  const TimelineItem = ({ period, description }: { period: string; description: string }) => (
    <View
      style={{
        flexDirection: 'row',
        marginBottom: 16,
        paddingLeft: 16,
        borderLeftWidth: 2,
        borderLeftColor: primary,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="subtitle" style={{ marginBottom: 4, color: text }}>
          {period}
        </Text>
        <Text variant="body" style={{ color: mutedText }}>
          {description}
        </Text>
      </View>
    </View>
  );

  const TipCard = ({ title, description }: { title: string; description: string }) => (
    <View
      style={{
        backgroundColor: card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <Text variant="subtitle" style={{ marginBottom: 8, color: text }}>
        {title}
      </Text>
      <Text variant="body" style={{ color: mutedText }}>
        {description}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: border,
        }}
      >
        <Text variant="title" style={{ color: text }}>
          How Affirmations Work
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={X} size={24} color={text} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Science Section */}
        <Section title="The Science Behind Affirmations">
          <Subsection title="Brain Activation (vmPFC)">
            <Text variant="body" style={{ color: mutedText, marginBottom: 12, lineHeight: 22 }}>
              Self-affirmation activates brain systems associated with self-related processing and
              reward. Research shows that when people engage in self-affirmation, key regions of the
              brain's self-processing (medial prefrontal cortex + posterior cingulate cortex) and
              valuation (ventral striatum + ventral medial prefrontal cortex) systems show increased
              activity.
            </Text>
            <Text variant="caption" style={{ color: mutedText, marginBottom: 4 }}>
              Cascio, C. N., et al. (2016). "Self-affirmation activates brain systems associated
              with self-related processing and reward and is reinforced by future orientation."
            </Text>
            <ResearchLink
              url="https://pubmed.ncbi.nlm.nih.gov/26541373/"
              label="Link to Study (PubMed)"
            />
          </Subsection>

          <Subsection title="Habit Formation (66 Days)">
            <Text variant="body" style={{ color: mutedText, marginBottom: 12, lineHeight: 22 }}>
              The popular "21 days to form a habit" rule is a myth. Current research suggests a more
              realistic timeline:
            </Text>
            <View style={{ marginBottom: 12 }}>
              <Text variant="body" style={{ color: mutedText, marginBottom: 8, lineHeight: 22 }}>
                <Text style={{ fontWeight: '600', color: text }}>21–30 Days:</Text> The habit of
                saying affirmations becomes automatic, but you may not fully believe them yet. This
                is often where people quit because they feel "fake." Keep going.
              </Text>
              <Text variant="body" style={{ color: mutedText, marginBottom: 8, lineHeight: 22 }}>
                <Text style={{ fontWeight: '600', color: text }}>66 Days:</Text> On average, this
                is the time required for a new behavior to become automatic (neuroplasticity taking
                hold).
              </Text>
              <Text variant="body" style={{ color: mutedText, lineHeight: 22 }}>
                <Text style={{ fontWeight: '600', color: text }}>90+ Days:</Text> Deep
                subconscious reprogramming where the affirmation becomes your default reaction to
                stress.
              </Text>
            </View>
            <Text variant="caption" style={{ color: mutedText, marginBottom: 4 }}>
              Lally, P., et al. (2009). "How are habits formed: Modelling habit formation in the
              real world."
            </Text>
            <ResearchLink
              url="https://onlinelibrary.wiley.com/doi/abs/10.1002/ejsp.674"
              label="Link to Study (Wiley Online Library)"
            />
          </Subsection>

          <Subsection title="Stress & Performance">
            <Text variant="body" style={{ color: mutedText, marginBottom: 12, lineHeight: 22 }}>
              Self-affirmation has been shown to improve problem-solving under stress. When facing
              challenging situations, affirmations can help maintain cognitive resources and improve
              performance.
            </Text>
            <Text variant="caption" style={{ color: mutedText, marginBottom: 4 }}>
              Creswell, J. D., et al. (2013). "Self-Affirmation Improves Problem-Solving under
              Stress."
            </Text>
            <ResearchLink
              url="https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0062593"
              label="Link to Study (PLOS ONE)"
            />
          </Subsection>
        </Section>

        {/* Practice Timeframes */}
        <Section title="Practice Timeframes">
          <Text variant="body" style={{ color: mutedText, marginBottom: 16, lineHeight: 22 }}>
            Most effective practices fall into one of three timeframes depending on your goal.
          </Text>

          <PracticeCard
            title="The 'Sweet Spot' (Most Recommended)"
            duration="5 minutes per session"
            frequency="Twice a day (Morning and Evening)"
            why="Five minutes is long enough to enter a focused, meditative state but short enough to maintain daily without burnout."
            bestFor="General mindset shifts and daily maintenance."
          />

          <PracticeCard
            title="The 'Deep Dive' (For Stubborn Beliefs)"
            duration="10–15 minutes"
            frequency="As needed"
            bestFor="Deeply ingrained habits or high-stress periods."
            techniques={[
              'Looping: Listening to an audio recording of your affirmations on repeat while commuting or doing chores.',
              'Writing: Writing the affirmation out by hand 20–30 times (often called the 33x3 or 55x5 method).',
            ]}
          />

          <PracticeCard
            title="The 'Micro-Dose' (For Busy Days)"
            duration="30–60 seconds"
            frequency="5+ times a day"
            bestFor="Keeping your nervous system regulated throughout the day."
            techniques={[
              'Habit Stacking: Repeat your affirmation 3 times mentally whenever you do a specific small action (e.g., every time you open a door, drink water, or check your phone).',
            ]}
          />
        </Section>

        {/* Results Timeline */}
        <Section title="How Long Until You See Results?">
          <TimelineItem
            period="Immediate"
            description="You may feel a temporary mood boost or sense of relief (the 'placebo effect')."
          />
          <TimelineItem
            period="21–30 Days"
            description="The habit of saying them becomes automatic, but you may not fully believe them yet. This is often where people quit because they feel 'fake.' Keep going."
          />
          <TimelineItem
            period="66 Days"
            description="On average, this is the time required for a new behavior to become automatic (neuroplasticity taking hold)."
          />
          <TimelineItem
            period="90+ Days"
            description="Deep subconscious reprogramming where the affirmation becomes your default reaction to stress."
          />
        </Section>

        {/* Critical Tips */}
        <Section title="Critical Tips for Effectiveness">
          <TipCard
            title="The 'Sleep Window'"
            description="The most effective time to repeat affirmations is the last 5 minutes before you fall asleep and the first 5 minutes after waking. Your brain is in a 'theta' state (dreamy, relaxed), making the subconscious mind most receptive to new instructions."
          />

          <TipCard
            title="Feeling > Repetition"
            description="Repeating a sentence 100 times robotically is less effective than repeating it 5 times while genuinely trying to feel the emotion of the words. The emotional connection activates the brain's reward and valuation systems more effectively."
          />

          <TipCard
            title="Mirror Work"
            description="Staring into your own eyes in a mirror while repeating affirmations can be intense but speeds up the process by creating an emotional breakthrough. This technique creates a powerful connection between the affirmation and your self-concept."
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
