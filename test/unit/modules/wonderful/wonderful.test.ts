import { describe, expect, it } from 'vitest';
import { buildWonderfulPayload, pickAgentTexts, type WonderfulEvent } from '../../../../src/modules/wonderful/wonderful';

describe('wonderful helpers', () => {
  describe('buildWonderfulPayload', () => {
    it('joins message parts into a payload', () => {
      expect(buildWonderfulPayload(['hello', 'world'])).toEqual({ payload: { message: 'hello world' } });
    });

    it('includes reply text when provided', () => {
      expect(buildWonderfulPayload(['hello'], 'quoted message')).toEqual({
        payload: { message: 'hello', reply: 'quoted message' },
      });
    });

    it('returns null for empty payload', () => {
      expect(buildWonderfulPayload([])).toBeNull();
      expect(buildWonderfulPayload(['   '])).toBeNull();
    });
  });

  describe('pickAgentTexts', () => {
    it('picks only agent events after last seen index', () => {
      const events: WonderfulEvent[] = [
        { event_index: 0, event_type: 'status_change', text: 'Task created' },
        { event_index: 1, event_type: 'agent', text: 'Hello from agent' },
        { event_index: 2, event_type: 'agent', text: '  ' },
        { event_index: 3, event_type: 'agent', text: 'Another update' },
      ];

      expect(pickAgentTexts(events, 1)).toEqual({
        texts: ['Another update'],
        newLastSeenEventIndex: 3,
      });
    });

    it('advances last seen to max index', () => {
      const events: WonderfulEvent[] = [
        { event_index: 5, event_type: 'agent', text: 'A' },
        { event_index: 6, event_type: 'status_change', text: 'Task started' },
        { event_index: 7, event_type: 'agent', text: 'B' },
      ];

      expect(pickAgentTexts(events, 4)).toEqual({
        texts: ['A', 'B'],
        newLastSeenEventIndex: 7,
      });

      expect(pickAgentTexts(events, 7)).toEqual({
        texts: [],
        newLastSeenEventIndex: 7,
      });
    });

    it('dedupes duplicate agent indices within a single call', () => {
      const events: WonderfulEvent[] = [
        { event_index: 1, event_type: 'agent', text: 'First' },
        { event_index: 1, event_type: 'agent', text: 'Duplicate same index' },
        { event_index: 2, event_type: 'agent', text: 'Second' },
      ];

      expect(pickAgentTexts(events, -1)).toEqual({
        texts: ['First', 'Second'],
        newLastSeenEventIndex: 2,
      });
    });

    it('handles missing indices', () => {
      const events: WonderfulEvent[] = [
        { event_type: 'agent', text: 'No index but should be ignored' },
        { event_index: 2, event_type: 'agent', text: 'Indexed' },
      ];

      expect(pickAgentTexts(events, 1)).toEqual({
        texts: ['Indexed'],
        newLastSeenEventIndex: 2,
      });
    });
  });
});

