import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventSchema, seriesToggleSchema, updateEventSchema, workingGroupSchema } from '../../src/validation/eventsSchemas';
import { validateEvent, validateEventPayload } from '../../src/services/eventService';

vi.mock('../../src/services/eventService', () => ({
  validateEvent: vi.fn(),
  validateEventPayload: vi.fn(),
}));

describe('eventsSchemas', () => {
  const mockedValidateEvent = vi.mocked(validateEvent);
  const mockedValidateEventPayload = vi.mocked(validateEventPayload);

  beforeEach(() => {
    mockedValidateEvent.mockReset();
    mockedValidateEventPayload.mockReset();
  });

  it('parses working group payloads', () => {
    const result = workingGroupSchema.parse({ name: 'WG', description: 'Desc', members: 'People' });
    expect(result).toEqual({ name: 'WG', description: 'Desc', members: 'People' });
  });

  it('rejects invalid working group payloads', () => {
    expect(() => workingGroupSchema.parse({ name: '', description: 'Desc', members: 'People' })).toThrow('name is required');
    expect(() => workingGroupSchema.parse({ name: 'WG', description: '', members: 'People' })).toThrow(
      'description is required'
    );
  });

  it('parses event creation payloads when validation passes', () => {
    mockedValidateEvent.mockReturnValue(null);
    const payload = { name: 'Event' } as Record<string, unknown>;
    expect(createEventSchema.parse(payload)).toBe(payload);
  });

  it('rejects event creation payloads when validation fails', () => {
    mockedValidateEvent.mockReturnValue('Invalid event');
    expect(() => createEventSchema.parse({})).toThrow('Invalid event');
  });

  it('parses update payloads when validation passes', () => {
    mockedValidateEventPayload.mockReturnValue({ payload: { name: 'Event' }, normalized: { recurrence: 'none' } } as never);
    const result = updateEventSchema.parse({});
    expect(result).toEqual({ payload: { name: 'Event' }, normalized: { recurrence: 'none' } });
  });

  it('rejects update payloads when validation fails', () => {
    mockedValidateEventPayload.mockReturnValue({ error: 'Invalid update' } as never);
    expect(() => updateEventSchema.parse({})).toThrow('Invalid update');
  });

  it('parses series toggle payloads', () => {
    expect(seriesToggleSchema.parse({})).toEqual({ series: false });
    expect(seriesToggleSchema.parse({ series: true })).toEqual({ series: true });
  });

  it('rejects invalid series toggle payloads', () => {
    expect(() => seriesToggleSchema.parse({ series: 'yes' })).toThrow('series must be a boolean');
  });
});
