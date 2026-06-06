// apps/mobile/src/navigation/navigationRef.ts
// Global navigation reference for use outside of React components (e.g. notification handlers).

import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();
