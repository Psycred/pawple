import { useEffect } from 'react';

/**
 * Legacy route — Wave 5 §1 merged sign-in into Welcome.
 * Keep the screen registered so deep links and stale navigations resolve safely.
 */
export default function AuthScreen({ navigation }) {
  useEffect(() => {
    navigation.replace('Welcome');
  }, [navigation]);

  return null;
}
