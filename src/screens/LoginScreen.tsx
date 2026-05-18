import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { PixelButton } from '../components/PixelButton';
import { C } from '../constants/colors';

// Blink animation for the ▶ icon
function BlinkIcon() {
  const opacity = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true, easing: Easing.step0 }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.step0 }),
      ])
    ).start();
  }, []);

  return <Animated.Text style={[styles.icon, { opacity }]}>▶</Animated.Text>;
}

type Props = { onSignIn: () => void };

export function LoginScreen({ onSignIn }: Props) {
  return (
    <View style={styles.screen}>
      <View style={styles.box}>
        <BlinkIcon />
        <Text style={styles.title}>TASK{'\n'}TABBER</Text>
        <Text style={styles.sub}>SIGN IN TO SAVE YOUR TASKS</Text>
        <PixelButton label="▶  SIGN IN WITH GOOGLE" onPress={onSignIn} variant="primary" style={styles.btn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  box: {
    backgroundColor: C.surface,
    borderWidth: 3,
    borderColor: C.borderHi,
    padding: 32,
    width: 300,
    alignItems: 'center',
    shadowColor: C.shadow,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  icon: {
    fontFamily: 'PressStart2P_400Regular',
    fontSize: 24,
    color: C.accent,
    marginBottom: 16,
  },
  title: {
    fontFamily: 'PressStart2P_400Regular',
    fontSize: 14,
    color: C.text,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  sub: {
    fontFamily: 'PressStart2P_400Regular',
    fontSize: 6,
    color: C.textDim,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 12,
  },
  btn: { width: '100%' },
});
