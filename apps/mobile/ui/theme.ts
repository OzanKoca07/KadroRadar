import {StyleSheet} from 'react-native';

export const colors = {
  primary: '#B42335', primarySoft: '#FBEFF0', canvas: '#F8F8F7', surface: '#FFFFFF',
  text: '#24262B', muted: '#626771', border: '#E5E6E8', success: '#236247',
  successSoft: '#EDF7F1', warning: '#805B19', warningSoft: '#FBF5E8',
  error: '#A52333', info: '#375C7C', infoSoft: '#EFF4F8', skeleton: '#E9E9E7',
} as const;
export const space = {xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32} as const;
export const radius = {sm: 10, md: 16, lg: 22, pill: 999} as const;
export const type = {title: 28, heading: 20, body: 15, label: 13, caption: 12} as const;
// Borders carry hierarchy; no stacked shadows or costly translucent layers.
export const ui = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.canvas},
  content: {padding: space.lg, paddingBottom: space.xxl, gap: space.lg},
  title: {fontSize: type.title, lineHeight: 35, fontWeight: '700', color: colors.text},
  heading: {fontSize: type.heading, lineHeight: 27, fontWeight: '700', color: colors.text},
  body: {fontSize: type.body, lineHeight: 23, color: colors.text},
  muted: {fontSize: type.label, lineHeight: 20, color: colors.muted},
  caption: {fontSize: type.caption, lineHeight: 18, color: colors.muted},
  label: {fontSize: type.label, lineHeight: 19, fontWeight: '600', color: colors.text},
  row: {flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap'},
  between: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md},
  card: {backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, borderWidth: 1, borderColor: colors.border, gap: space.md},
  input: {minHeight: 48, padding: space.md, borderWidth: 1, borderColor: '#C9CDD2', borderRadius: radius.sm, backgroundColor: colors.surface, color: colors.text, fontSize: type.body},
  divider: {height: 1, backgroundColor: colors.border},
  metric: {fontSize: 23, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums']},
});
