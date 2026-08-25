import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useColorScheme, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../config/theme';

export default function SplashScreen({ navigation, route }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    const nextRoute = route?.params?.nextRoute || 'Auth';

    // Keep splash motion minimal and warm: soft fade-in only.
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });

    animation.start();

    const timer = setTimeout(() => {
      navigation.replace(nextRoute);
    }, 1200);

    return () => {
      clearTimeout(timer);
      animation.stop();
    };
  }, [navigation, opacity, route?.params?.nextRoute]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity }]}>
        <Feather
          name="heart"
          size={theme.spacing.xxxl}
          color={isDark ? theme.colors.text.primary.dark : theme.colors.brand.sage.light}
          accessibilityLabel="Pawple splash logo"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
});
