import React from 'react';
import { TextInput, Text, View, StyleSheet, KeyboardTypeOptions } from 'react-native';
import { C } from '../constants/colors';

type Props = {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  keyboardType?: KeyboardTypeOptions;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
};

export function PixelInput({ label, value, onChangeText, placeholder, maxLength, keyboardType, autoFocus, onSubmitEditing }: Props) {
  return (
    <View style={styles.field}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textFaint}
        maxLength={maxLength}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmitEditing}
        autoCapitalize="none"
        autoCorrect={false}
        selectionColor={C.accent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: {
    fontFamily: 'PressStart2P_400Regular',
    fontSize: 7,
    color: C.textDim,
    letterSpacing: 2,
    marginBottom: 6,
  },
  input: {
    fontFamily: 'PressStart2P_400Regular',
    fontSize: 8,
    backgroundColor: C.surface,
    borderWidth: 2,
    borderColor: C.border,
    color: C.text,
    padding: 8,
  },
});
