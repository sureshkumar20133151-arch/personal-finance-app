import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

// Haptics/vibration disabled app-wide per user request (2026-08).
// Kept as no-ops (rather than deleting call sites) so it's a one-line
// revert if wanted back later - just flip this flag to true.
const HAPTICS_ENABLED = false;

// Check if app is running on a native device (Android/iOS)
const isNative = Capacitor.isNativePlatform();

/**
 * Trigger physical impact feedback (light/medium/heavy)
 * @param {string} style - 'LIGHT', 'MEDIUM', 'HEAVY'
 */
export const triggerHapticImpact = async (style = 'LIGHT') => {
  if (!HAPTICS_ENABLED || !isNative) return;
  try {
    const impactStyle = 
      style === 'HEAVY' ? ImpactStyle.Heavy :
      style === 'MEDIUM' ? ImpactStyle.Medium :
      ImpactStyle.Light;
    await Haptics.impact({ style: impactStyle });
  } catch (error) {
    console.warn('Haptic impact failed:', error);
  }
};

/**
 * Trigger native haptic notification feedback (success/warning/error)
 * @param {string} type - 'SUCCESS', 'WARNING', 'ERROR'
 */
export const triggerHapticNotification = async (type = 'SUCCESS') => {
  if (!HAPTICS_ENABLED || !isNative) return;
  try {
    const notificationType = 
      type === 'ERROR' ? NotificationType.Error :
      type === 'WARNING' ? NotificationType.Warning :
      NotificationType.Success;
    await Haptics.notification({ type: notificationType });
  } catch (error) {
    console.warn('Haptic notification failed:', error);
  }
};

/**
 * Trigger subtle selection change haptic click (best for switches, dials, navigation tabs)
 */
export const triggerHapticSelection = async () => {
  if (!HAPTICS_ENABLED || !isNative) return;
  try {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
  } catch (error) {
    console.warn('Haptic selection failed:', error);
  }
};

/**
 * Trigger standard system vibration
 * @param {number} duration - vibration duration in milliseconds
 */
export const triggerVibrate = async (duration = 50) => {
  if (!HAPTICS_ENABLED || !isNative) return;
  try {
    await Haptics.vibrate({ duration });
  } catch (error) {
    console.warn('Vibration failed:', error);
  }
};
