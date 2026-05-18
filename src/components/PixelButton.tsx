import React, { useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ViewStyle } from 'react-native';
import { C } from '../constants/colors';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'primary' | 'small' | 'danger';
  style?: ViewStyle;
  disabled?: boolean;
};

export function PixelButton({ label, onPress, variant = 'default', style, disabled }: Props) {
  const [pressed, setPressed] = useState(false);

  const isPrimary = variant === 'primary';
  const isSmall   = variant === 'small';
  const isDanger  = variant === 'danger';

  return (
    <View style={[styles.shadow, pressed && styles.shadowPressed, style]}>
      <TouchableOpacity
        activeOpacity={1}
        disabled={disabled}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={onPress}
        style={[
          styles.btn,
          isSmall  && styles.btnSmall,
          isPrimary && styles.btnPrimary,
          isDanger  && styles.btnDanger,
          disabled  && styles.btnDisabled,
          pressed   && styles.btnPressed,
        ]}
      >
        <Text style={[styles.label, isSmall && styles.labelSmall, isPrimary && styles.labelPrimary]}>
          {label}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: C.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  shadowPressed: {
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  btn: {
    borderWidth: 2,
    borderColor: C.borderHi,
    backgroundColor: C.panel2,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  btnSmall:   { paddingVertical: 4, paddingHorizontal: 7 },
  btnPrimary: { backgroundColor: C.accent, borderColor: C.accent },
  btnDanger:  { borderColor: C.danger },
  btnDisabled:{ opacity: 0.5 },
  btnPressed: { transform: [{ translateX: 3 }, { translateY: 3 }] },
  label: {
    fontFamily: 'PressStart2P_400Regular',
    fontSize: 7,
    color: C.text,
    includeFontPadding: false,
  },
  labelSmall:   { fontSize: 6 },
  labelPrimary: { color: '#fff' },
});
