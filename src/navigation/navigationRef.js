import { createNavigationContainerRef } from '@react-navigation/native';

/** Root stack ref so the Moment hub can `replace` into full-screen create flows. */
export const navigationRef = createNavigationContainerRef();
