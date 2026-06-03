import { addMinutesToTime } from './time.util';
import { formatDZD, formatDuration } from '@barberdz/shared/utils/formatters';

describe('Core Utilities', () => {
  describe('addMinutesToTime', () => {
    it('should correctly add minutes without rolling over the hour', () => {
      expect(addMinutesToTime('09:00', 30)).toBe('09:30');
    });

    it('should correctly roll over the hour', () => {
      expect(addMinutesToTime('09:45', 30)).toBe('10:15');
    });

    it('should correctly pad hours and minutes with zeros', () => {
      expect(addMinutesToTime('08:05', 4)).toBe('08:09');
    });
  });

  describe('formatDZD', () => {
    it('should format numbers to DZD currency format', () => {
      // Note: Intl formatting spaces can be non-breaking spaces
      const result = formatDZD(1500);
      expect(result).toMatch(/1\s*500 DA/);
    });
  });

  describe('formatDuration', () => {
    it('should format duration under 60 minutes', () => {
      expect(formatDuration(45)).toBe('45 min');
    });

    it('should format duration of exactly one hour', () => {
      expect(formatDuration(60)).toBe('1h');
    });

    it('should format duration over one hour', () => {
      expect(formatDuration(90)).toBe('1h 30min');
    });
  });
});
