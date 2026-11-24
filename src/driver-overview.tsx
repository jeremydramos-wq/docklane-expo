import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colour, font } from './brand';
import { irishTime } from './jobs';
import type { DriverJob } from './jobs';

function DriverIllustration() {
  return <View style={styles.drawing} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={styles.routeLine} /><View style={[styles.pin, styles.firstPin]} /><View style={[styles.pin, styles.lastPin]} />
    <View style={styles.cab}><View style={styles.window} /></View>
    <View style={styles.box}><View style={styles.boxStripe} /></View>
    <View style={styles.chassis} /><View style={[styles.wheel, styles.frontWheel]} /><View style={[styles.wheel, styles.rearWheel]} />
  </View>;
}

export function DriverOverview({ job, directions }: { job?: DriverJob; directions: (address: string) => void }) {
  return <View style={styles.stack}>
    <View style={styles.banner}>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>Driver overview</Text>
        <Text style={styles.body}>Your work for today.</Text>
      </View>
      <DriverIllustration />
    </View>
    {job && <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.subtitle}>Next collection</Text>
      <Text style={styles.body}>{job.pickup_area} → {job.delivery_area}</Text>
      <View style={styles.row}><Text style={styles.label}>Collection time</Text><Text style={styles.value}>{irishTime(job.pickup_from)} · Ireland</Text></View>
      <View style={styles.row}><Text style={styles.label}>Pickup</Text><Text style={styles.value}>{job.pickup_address || job.pickup_area}</Text></View>
      {job.pickup_address && <Pressable accessibilityRole="button" onPress={() => directions(job.pickup_address!)}
        style={({ pressed }) => [styles.directions, pressed && styles.pressed]}>
        <Text style={styles.actionText}>Open directions</Text>
      </Pressable>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  banner: { backgroundColor: colour.softBlue, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  copy: { flex: 1 },
  title: { fontFamily: font.extrabold, fontSize: 23, lineHeight: 29, color: colour.ink },
  subtitle: { fontFamily: font.bold, fontSize: 21, lineHeight: 27, color: colour.ink },
  body: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: colour.slate },
  card: { backgroundColor: colour.white, borderWidth: 1, borderColor: colour.line, borderRadius: 10, padding: 14, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colour.line },
  label: { flexShrink: 1, fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: colour.slate },
  value: { flex: 1, textAlign: 'right', fontFamily: font.semibold, fontSize: 14, lineHeight: 20, color: colour.ink },
  directions: { backgroundColor: colour.cobalt, minHeight: 46, borderRadius: 6, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },
  pressed: { opacity: 0.82 },
  actionText: { fontFamily: font.bold, color: colour.white, fontSize: 15 },
  drawing: { width: 112, height: 50 },
  routeLine: { position: 'absolute', left: 3, right: 3, bottom: 6, height: 9, borderBottomWidth: 2, borderLeftWidth: 2, borderRightWidth: 2, borderColor: colour.cobalt, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
  pin: { position: 'absolute', bottom: 13, width: 6, height: 6, backgroundColor: colour.cobalt, borderRadius: 3 },
  firstPin: { left: 1 }, lastPin: { right: 1 },
  cab: { position: 'absolute', left: 19, bottom: 14, width: 21, height: 19, borderTopLeftRadius: 9, borderRadius: 2, backgroundColor: colour.ink },
  window: { position: 'absolute', top: 3, left: 5, width: 12, height: 7, borderTopLeftRadius: 5, backgroundColor: colour.cloud },
  box: { position: 'absolute', left: 41, bottom: 15, width: 50, height: 26, backgroundColor: colour.white, borderWidth: 2, borderColor: colour.ink, borderRadius: 2 },
  boxStripe: { position: 'absolute', left: 4, right: 4, bottom: 3, height: 2, backgroundColor: colour.ink },
  chassis: { position: 'absolute', left: 17, bottom: 12, width: 76, height: 4, backgroundColor: colour.ink },
  wheel: { position: 'absolute', bottom: 8, width: 11, height: 11, borderRadius: 6, borderWidth: 3, borderColor: colour.ink, backgroundColor: colour.cloud },
  frontWheel: { left: 24 }, rearWheel: { left: 76 },
});
