/**
 * Tətbiqin mətn elementi. react-native `Text` əvəzinə bunu işlədin: brend şriftini qoyur və
 * `fontWeight`-i düzgün şrift faylına çevirir (bax theme.resolveFont).
 */
import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native'
import { resolveFont } from '../theme'

export function Text({ style, ...rest }: TextProps) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle
  const resolved = resolveFont(flat.fontFamily, flat.fontWeight, flat.fontStyle === 'italic')
  return <RNText {...rest} style={resolved ? [style, resolved] : style} />
}
