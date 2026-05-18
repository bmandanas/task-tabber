import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from './src/hooks/useAuth';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { C } from './src/constants/colors';

export default function App() {
  const [fontsLoaded] = useFonts({ PressStart2P_400Regular });
  const { session, loading, signInWithGoogle, signOut } = useAuth();

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {session
        ? <HomeScreen session={session} onSignOut={signOut} />
        : <LoginScreen onSignIn={signInWithGoogle} />
      }
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
});
