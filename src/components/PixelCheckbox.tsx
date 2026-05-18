import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { C } from '../constants/colors';

type Props = { checked: boolean; onPress: () => void };

export function PixelCheckbox({ checked, onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.box, checked && styles.checked]}
      activeOpacity={0.7}
    >
      {checked && <Text style={styles.check}>✓</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: C.borderHi,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { backgroundColor: C.success, borderColor: C.success },
  check:   { fontFamily: 'PressStart2P_400Regular', fontSize: 8, color: '#fff', lineHeight: 12 },
});
