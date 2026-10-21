import { router } from 'expo-router';
import { View } from 'react-native';
import { BackupStatus } from '../../components/BackupStatus';
import { Btn, Card, Divider, H, Row, Screen, T } from '../../components/ui';
import { REQUIREMENTS } from '../../lib/defaults';
import { fmtDate, fmtMin } from '../../lib/stats';
import { useStore } from '../../lib/store';

export default function Practice() {
  const sets = useStore((s) => s.sets);
  const campaigns = useStore((s) => s.campaigns);
  const runs = useStore((s) => s.runs);
  const activeRun = useStore((s) => s.activeRun);

  return (
    <Screen>
      <BackupStatus />
      {activeRun && activeRun.phase !== 'finished' && (
        <Card>
          <T weight="600">A run is in progress: {activeRun.title}</T>
          <Btn title="Go back to the timer" icon="timer" onPress={() => router.push('/run')} />
        </Card>
      )}

      <H>Full mock exam</H>
      <Card>
        {sets.map((s, i) => (
          <View key={s.id}>
            {i > 0 && <Divider />}
            <Row
              icon="list.number"
              title={s.name}
              subtitle={`Crown ${s.teeth.crownPrep.tooth} · MOD ${s.teeth.mod.tooth} · Endo ${s.teeth.endo.tooth}`}
              onPress={() => router.push({ pathname: '/plan', params: { setId: s.id } })}
            />
          </View>
        ))}
      </Card>

      <H>Custom campaigns</H>
      <Card>
        {campaigns.length === 0 && (
          <T muted size={14}>
            A campaign is your own list of projects, for example three endo access cavities in a row.
          </T>
        )}
        {campaigns.map((c, i) => (
          <View key={c.id}>
            {i > 0 && <Divider />}
            <Row
              icon="square.stack.3d.up"
              title={c.name}
              subtitle={`${c.items.length} projects`}
              onPress={() => router.push({ pathname: '/plan', params: { campaignId: c.id } })}
            />
          </View>
        ))}
        <Btn
          title="New campaign"
          kind="secondary"
          icon="plus"
          onPress={() => router.push('/settings/campaign/new')}
        />
      </Card>

      <H>One project</H>
      <Card>
        {REQUIREMENTS.map((r, i) => (
          <View key={r.id}>
            {i > 0 && <Divider />}
            <Row title={r.short} onPress={() => router.push({ pathname: '/plan', params: { reqId: r.id } })} />
          </View>
        ))}
      </Card>

      <Btn
        title="Log a project without the timer"
        kind="plain"
        icon="square.and.pencil"
        onPress={() => router.push('/attempt/new')}
      />

      {runs.length > 0 && <H>Recent runs</H>}
      {runs.length > 0 && (
        <Card>
          {[...runs]
            .reverse()
            .slice(0, 8)
            .map((r, i) => (
              <View key={r.id}>
                {i > 0 && <Divider />}
                <Row
                  title={r.title}
                  subtitle={`${fmtDate(r.startedAt)} · ${r.attemptIds.length} projects · ${fmtMin(r.activeSec)}`}
                  onPress={() => router.push(`/review/${r.id}`)}
                />
              </View>
            ))}
        </Card>
      )}
    </Screen>
  );
}

