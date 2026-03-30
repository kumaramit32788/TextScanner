import React from 'react';
import {
  StatusBar,
  useColorScheme,
} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';

import {SafeAreaProvider} from 'react-native-safe-area-context';
import AppContent from './src/Screens/AppContent';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <AppContent isDarkMode={isDarkMode} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
