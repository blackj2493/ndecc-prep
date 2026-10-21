import { router } from 'expo-router';
import { View } from 'react-native';
import { Card, Divider, Empty, H, Row, Screen, T, useTheme } from '../../components/ui';
import { REQ_BY_ID, REQUIREMENTS } from '../../lib/defaults';
import { fmtDate, fmtMin, reqStats } from '../../lib/stats';
import { useStore } from '../../lib/store';

export default function Journal() {
  const c = useTheme();
  const attempts = useStore((s) => s.attempts);
  const settings = useStore((s) => s.settings);
  const recent = [...attempts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);

  return (
    <Screen>
      <H>By requirement</H>
      <Card>
        {REQUIREMENTS.map((r, i) => {
          const s = reqStats(attempts, r.id);
          const over = s.recentMedianSec != null && s.recentMedianSec > settings.targets[r.id] * 60;
          return (
            <View key={r.id}>
              {i > 0 && <Divider />}
              <Row
                title={r.short}
                subtitle={
                  s.count
                    ? `${s.count} attempts · top mistake: ${s.topTags[0]?.tag ?? 'none'}`
                    : 'No attempts yet'
                }
                right={
                  s.count ? (
                    <T weight="600" style={{ color: over ? c.bad : c.text }}>
                      {fmtMin(s.recentMedianSec)}
                    </T>
                  ) : undefined
                }
                onPress={() => router.push(`/requirement/${r.id}`)}
              />
            </View>
          );
        })}
      </Card>
      <T muted size={12}>
        The time on the right is the median of your last 5 attempts. Red = over your target.
      </T>

      <H>Latest entries</H>
      <Card>
        {recent.length === 0 && <Empty text="Your attempts appear here after your first run." />}
        {recent.map((a, i) => (
          <View key={a.id}>
            {i > 0 && <Divider />}
            <Row
              title={`${REQ_BY_ID[a.reqId].short} · ${a.tooth} ${a.surface}`}
              subtitle={[fmtDate(a.date), fmtMin(a.durationSec), a.tags.join(', '), a.notes].filter(Boolean).join(' · ')}
              onPress={() => router.push(`/attempt/${a.id}`)}
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
