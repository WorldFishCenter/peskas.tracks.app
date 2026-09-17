import { User } from '../contexts/AuthContext';
import { TFunction } from 'i18next';

/**
 * Is there a tracking device whose data this user can be shown?
 *
 * A fisher answers for their own account. An administrator never has a device
 * of their own — their account is a person, not a vessel — so the question is
 * about the vessel they have selected instead. Ask it of the account alone and
 * an administrator selects a boat and the app decides there is nothing to
 * draw.
 */
export const hasTrackingDevice = (currentUser: User | null): boolean => {
  if (!currentUser) return false;

  if (currentUser.role === 'admin') {
    return (currentUser.imeis?.length ?? 0) > 0;
  }

  return currentUser.hasImei === true ||
         (currentUser.hasImei !== false && (currentUser.imeis?.length ?? 0) > 0);
};

/**
 * Render "No data" message for the specified IMEI
 */
export const renderNoImeiDataMessage = (currentUser: User | null, t: TFunction): string => {
  if (!currentUser) return t('dashboard.noVesselSelected');

  if (currentUser.role === 'admin') {
    if (!currentUser.imeis || currentUser.imeis.length === 0) {
      return t('dashboard.noVesselSelected');
    }
    return t('dashboard.noDataMessage');
  }

  // Users without IMEI (self-registered) should see a specific message
  if (currentUser.hasImei === false) {
    return t('dashboard.noTrackingDevice');
  }

  const imeis = currentUser.imeis || [];
  const imeiCount = imeis.length;

  if (imeiCount === 0) {
    return t('dashboard.noImeiDataMessage');
  } else if (imeiCount === 1) {
    return t('dashboard.noDataForImei', { imei: imeis[0] });
  } else {
    return t('dashboard.noDataForImeis', { imeis: imeis.join(', ') });
  }
};

/**
 * Render user IMEI info 
 */
export const renderUserImeiInfo = (currentUser: User | null): string | null => {
  if (!currentUser || currentUser.role === 'admin') return null;
  
  const imeis = currentUser.imeis || [];
  
  if (imeis.length === 0) {
    return "No IMEIs associated with your account";
  } else if (imeis.length === 1) {
    return `Your IMEI: ${imeis[0]}`;
  } else {
    return `Your IMEIs: ${imeis.join(', ')}`;
  }
}; 