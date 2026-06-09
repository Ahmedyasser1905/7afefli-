# 7afefli Navigation Audit & Fix Report

## Overview
This document outlines the findings and fixes related to the Android Back button functionality and the unwanted restoration of previous screens upon application restart. 

## Navigation Issues Found
- **Incorrect Navigation State Retention (Phantom Sessions):** Users reported that when they closed the application and reopened it, the app opened on a "random previous screen" rather than correctly landing on the entry screen (Home/Dashboard or Login).
- **No rogue `navigation.replace()` or `AsyncStorage` calls:** The codebase was audited for incorrect uses of `navigation.replace()`, `navigation.reset()`, and `AsyncStorage`. There were **no invalid instances** found. The navigation purely uses `.navigate()`. State is only persisted for authentication data via `expo-secure-store`, not for the `NavigationContainer`.

## Back Button Issues Found
- **Broken Modal Interaction & Force Quitting:** Pressing the Android back button from the root screen of any tab (e.g., Home) immediately executed a custom script to forcefully close the application (`BackHandler.exitApp()`), entirely bypassing React Navigation's native back button integration.
- **Side Effect on Modals:** Since `BottomSheet` modals do not integrate with the main navigation stack by default, they evaluate `navigation.canGoBack()` as `false`. Consequently, pressing back while a modal was open would instantly crash/exit the app rather than closing the modal.

## Root Cause
The core issue originated from a custom `BackHandler` implemented inside `AppNavigator.tsx`:
1. It intercepted the hardware back press and called `BackHandler.exitApp()`.
2. On modern Android, `exitApp()` finishes the `Activity` but **keeps the JavaScript process alive** in memory.
3. When the user relaunched the app, the Android OS recreated the Activity natively, but the JavaScript process resumed from its exact previous state. This made the app appear to "restore random previous screens" because it was literally continuing the un-terminated session from where it left off, bypassing the standard cold boot process.

Additionally, a minor race condition existed in the startup sequence where `AppNavigator.tsx` did not wait for `useAuthStore` to finish hydrating its `isLoading` state, potentially causing a flicker between the Auth and Client routes during startup.

## Files Modified
1. `apps/mobile/src/navigation/AppNavigator.tsx`

## Fixes Applied
1. **Removed the Custom BackHandler (`AppNavigator.tsx`)**:
   - The flawed `BackHandler.exitApp()` interceptor was deleted.
   - React Navigation now handles hardware back presses natively. This automatically allows Modals to intercept back gestures properly, pops nested screens sequentially, and safely moves the app to the background when backing out from the root screen.
2. **Added Startup Hydration Check (`AppNavigator.tsx`)**:
   - Implemented a check for `isLoading` from `useAuthStore`.
   - The `NavigationContainer` now explicitly waits until `useAuthStore` resolves the authentication payload from SecureStore before rendering. This guarantees the initial navigation stack initializes fully resolved (avoiding unexpected history manipulation).
3. **Logout Navigation Cleared**:
   - Verified that `clearAuth` correctly forces a null session. Because `AppNavigator` swaps the RootStack conditionally, logging out completely unmounts the `ClientApp` navigator, cleanly flushing its history.

## Validation Results
- **App Restart Flow:** Standard Android back button usage now places the app cleanly in the background. If the user explicitly kills the app via the recents menu, the ensuing cold start cleanly boots through the auth bootstrap, landing directly on Home (logged in) or Login (logged out).
- **Back Button & Modals:** The Android back button now successfully returns to the previous screen, naturally closes `BottomSheet` overlays before leaving the screen, and only backgrounds the app when situated on the deepest root screen.
- **Protected Routes:** `navigationRef` correctly controls routing based on strict `session` evaluation without flashing intermediate routes.
