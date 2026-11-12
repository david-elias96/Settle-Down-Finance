import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { Fonts } from '@/constants/Colors';
import { Label, useTheme } from '@/components/ui';

/** The smiling house from the app icon, drawn large. */
export function HappyHome({ size = 180 }: { size?: number }) {
  const t = useTheme();
  return (
    <View style={[styles.home, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: t.hero, shadowColor: '#17221D' }]}
      accessible accessibilityRole="image" accessibilityLabel="The Settle Down house, smiling">
      <Svg width={size} height={size} viewBox="0 0 1024 1024">
        <G transform="translate(-18,-60)">
          <G fill="none" stroke="#F3F7EF" strokeWidth={52} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M232 800V540L420 372L608 540V800" /><Path d="M180 800H880" />
            <Path d="M374 684Q420 724 466 684" strokeWidth={26} />
            <Path d="M338 604Q370 634 402 604" strokeWidth={26} /><Path d="M438 604Q470 634 502 604" strokeWidth={26} />
          </G>
          <Circle cx={338} cy={662} r={18} fill="#F6C04E" /><Circle cx={502} cy={662} r={18} fill="#F6C04E" />
          <G transform="translate(36,0)">
            <Path d="M720 560V800" stroke="#F3F7EF" strokeWidth={52} strokeLinecap="round" />
            <G fill="#8FD19E">
              <Circle cx={720} cy={350} r={72} /><Circle cx={660} cy={418} r={72} /><Circle cx={782} cy={418} r={72} />
              <Circle cx={634} cy={500} r={62} /><Circle cx={806} cy={500} r={62} /><Circle cx={720} cy={486} r={88} />
            </G>
          </G>
        </G>
      </Svg>
    </View>
  );
}

/** A friendly full-screen dead end: the happy house, a headline, a line of help, and a way out. */
export function Oops({ title, children, detail, actions }: { title: string; children: string; detail?: string; actions: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 40 }]}>
      <HappyHome />
      <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>{title}</Text>
      <Label secondary style={styles.body}>{children}</Label>
      {detail ? <Label style={{ ...styles.detail, backgroundColor: t.tintSoft }}>{detail}</Label> : null}
      <View style={styles.actions}>{actions}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 18 },
  home: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
  title: { fontFamily: Fonts.display, fontSize: 32, lineHeight: 37, letterSpacing: -0.6, textAlign: 'center', marginTop: 8, maxWidth: 420 },
  body: { fontSize: 17, lineHeight: 24, textAlign: 'center', maxWidth: 360 },
  detail: { fontSize: 13, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, overflow: 'hidden', textAlign: 'center', maxWidth: 360 },
  actions: { alignSelf: 'stretch', maxWidth: 360, width: '100%', gap: 12, marginTop: 6 },
});
