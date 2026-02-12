import { describe, expect, it } from 'vitest';
import { buildWonderfulPayload, pickNotifySlackTexts, type WonderfulEvent } from '../../../../src/modules/wonderful/wonderful';

describe('wonderful helpers', () => {
  describe('buildWonderfulPayload', () => {
    it('joins message parts into a payload', () => {
      expect(buildWonderfulPayload(['hello', 'world'])).toEqual({ payload: { message: 'hello world' } });
    });

    it('returns null for empty payload', () => {
      expect(buildWonderfulPayload([])).toBeNull();
      expect(buildWonderfulPayload(['   '])).toBeNull();
    });
  });

  describe('pickNotifySlackTexts', () => {
    it('picks only notify_slack events after last seen index', () => {
      const events: WonderfulEvent[] = [
        { event_index: 0, event_type: 'status_change', text: 'Task created' },
        { event_index: 1, event_type: 'notify_slack', text: 'Hello from agent' },
        { event_index: 2, event_type: 'notify_slack', text: '  ' },
        { event_index: 3, event_type: 'notify_slack', text: 'Another update' },
      ];

      expect(pickNotifySlackTexts(events, 1)).toEqual({
        texts: ['Another update'],
        newLastSeenEventIndex: 3,
      });
    });

    it('advances last seen to max index', () => {
      const events: WonderfulEvent[] = [
        { event_index: 5, event_type: 'notify_slack', text: 'A' },
        { event_index: 6, event_type: 'status_change', text: 'Task started' },
        { event_index: 7, event_type: 'notify_slack', text: 'B' },
      ];

      expect(pickNotifySlackTexts(events, 4)).toEqual({
        texts: ['A', 'B'],
        newLastSeenEventIndex: 7,
      });

      expect(pickNotifySlackTexts(events, 7)).toEqual({
        texts: [],
        newLastSeenEventIndex: 7,
      });
    });

    it('dedupes duplicate notify_slack indices within a single call', () => {
      const events: WonderfulEvent[] = [
        { event_index: 1, event_type: 'notify_slack', text: 'First' },
        { event_index: 1, event_type: 'notify_slack', text: 'Duplicate same index' },
        { event_index: 2, event_type: 'notify_slack', text: 'Second' },
      ];

      expect(pickNotifySlackTexts(events, -1)).toEqual({
        texts: ['First', 'Second'],
        newLastSeenEventIndex: 2,
      });
    });

    it('handles missing indices', () => {
      const events: WonderfulEvent[] = [
        { event_type: 'notify_slack', text: 'No index but still should send' },
        { event_index: 2, event_type: 'notify_slack', text: 'Indexed' },
      ];

      expect(pickNotifySlackTexts(events, 1)).toEqual({
        texts: ['Indexed'],
        newLastSeenEventIndex: 2,
      });
    });
  });
});

