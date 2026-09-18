import { CommonActions } from '@react-navigation/native';
import { navigationRef } from './navigationRef';

/** Route name for the cold-open / logged-out Pawple entry screen (Wave 5 §1). */
export const UNAUTHENTICATED_ENTRY_ROUTE = 'Welcome';

/**
 * Drop all stack history and land on the unauthenticated entry screen.
 * Required after logout and account deletion (Product Contract §10 / PAW-180 V1.1).
 */
export function resetToUnauthenticatedEntry() {
  if (!navigationRef.isReady()) {
    return false;
  }

  navigationRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: UNAUTHENTICATED_ENTRY_ROUTE }],
    }),
  );
  return true;
}
