export type WonderfulCreateTaskResponse = {
  data?: {
    id?: string;
  };
  status?: number;
};

export type WonderfulTask = {
  id: string;
  status?: string;
  resolution_summary?: string;
};

export type WonderfulEvent = {
  event_index?: number;
  event_type?: string;
  speaker?: string;
  text?: string;
  metadata?: Record<string, unknown>;
};

export type WonderfulGetTaskResponse = {
  data?: {
    task?: WonderfulTask;
    events?: WonderfulEvent[];
  };
  status?: number;
};

export function buildWonderfulPayload(messageParts: string[]): { payload: { message: string } } | null {
  const message = messageParts.join(' ').trim();
  if (message === '') return null;
  return { payload: { message } };
}

export function extractCreatedTaskId(res: WonderfulCreateTaskResponse): string | null {
  const id = res.data?.id;
  if (typeof id !== 'string' || id.trim() === '') return null;
  return id;
}

export function extractTaskAndEvents(res: WonderfulGetTaskResponse): {
  task: WonderfulTask | null;
  events: WonderfulEvent[];
} {
  const task = res.data?.task ?? null;
  const events = res.data?.events ?? [];
  return { task, events };
}

export function pickAgentTexts(
  events: WonderfulEvent[],
  lastSeenEventIndex: number,
): {
  texts: string[];
  newLastSeenEventIndex: number;
} {
  let maxIndex = lastSeenEventIndex;
  const texts: string[] = [];
  const emitted = new Set<number>();

  for (const e of events) {
    const idx = typeof e.event_index === 'number' ? e.event_index : undefined;
    if (idx !== undefined && idx > maxIndex) maxIndex = idx;

    if (e.event_type !== 'agent') continue;
    // Ignore agent events without an index to avoid re-sending them on every poll.
    if (idx === undefined) continue;
    if (idx <= lastSeenEventIndex) continue;
    if (typeof e.text !== 'string' || e.text.trim() === '') continue;
    if (emitted.has(idx)) continue;

    texts.push(e.text);
    emitted.add(idx);
  }

  return { texts, newLastSeenEventIndex: maxIndex };
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
