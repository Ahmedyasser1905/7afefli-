import { addMinutesToTime } from './time.util';

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
});
