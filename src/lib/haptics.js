import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

// Check if app is running on a native device (Android/iOS)
const isNative = Capacitor.isNativePlatform();

/**
 * Trigger physical impact feedback (light/medium/heavy)
 * @param {string} style - 'LIGHT', 'MEDIUM', 'HEAVY'
 */
export const triggerHapticImpact = async (style = 'LIGHT') => {
  if (!isNative) return;
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
  if (!isNative) return;
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
  if (!isNative) return;
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
  if (!isNative) return;
  try {
    await Haptics.vibrate({ duration });
  } catch (error) {
    console.warn('Vibration failed:', error);
  }
};
