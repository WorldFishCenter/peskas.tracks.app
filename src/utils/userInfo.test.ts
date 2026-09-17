import { describe, it, expect } from 'vitest';
import { hasTrackingDevice } from './userInfo';
import type { User } from '../contexts/AuthContext';

/**
 * Whether there is a device whose data we can draw.
 *
 * The administrator cases are the ones that bite. An administrator's account
 * carries no IMEI — it is a person, not a vessel — so asking the account alone
 * answers "no device" even after they have picked a boat, and the dashboard
 * quietly draws nothing. That is a real regression this pins down: it appeared
 * the moment administrators stopped being minted in the browser with a blank
 * identity and started arriving from the server like everybody else.
 */

const user = (overrides: Partial<User>): User => ({
  id: 'id',
  name: 'name',
  role: 'user',
  imeis: [],
  ...overrides
});

describe('an administrator', () => {
  it('has a device once a vessel is selected', () => {
    const admin = user({ role: 'admin', hasImei: false, imeis: ['861508035295419'] });

    expect(hasTrackingDevice(admin)).toBe(true);
  });

  it('has none before selecting one', () => {
    const admin = user({ role: 'admin', hasImei: false, imeis: [] });

    expect(hasTrackingDevice(admin)).toBe(false);
  });

  it('is not judged by the IMEI on their own account', () => {
    // Their account never has one; the selected vessel is what counts.
    const admin = user({ role: 'admin', hasImei: false, imeis: ['862044068727895'] });
    const adminWithoutTheFlag = user({ role: 'admin', imeis: ['862044068727895'] });

    expect(hasTrackingDevice(admin)).toBe(hasTrackingDevice(adminWithoutTheFlag));
  });
});

describe('a fisher', () => {
  it('has a device when the flag says so', () => {
    expect(hasTrackingDevice(user({ hasImei: true, imeis: ['861508035295419'] }))).toBe(true);
  });

  it('has none when the flag says so, whatever else is on the account', () => {
    expect(hasTrackingDevice(user({ hasImei: false, imeis: ['861508035295419'] }))).toBe(false);
  });

  it('has one when the flag is absent but an IMEI is present', () => {
    expect(hasTrackingDevice(user({ imeis: ['861508035295419'] }))).toBe(true);
  });

  it('has none when the flag is absent and no IMEI is present', () => {
    expect(hasTrackingDevice(user({ imeis: [] }))).toBe(false);
  });
});

it('answers no when nobody is signed in', () => {
  expect(hasTrackingDevice(null)).toBe(false);
});
