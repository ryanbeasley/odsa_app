import { describe, expect, it } from 'vitest';
import { eventIdSchema } from '../../src/validation/eventsParamsSchemas';

const buildReq = (id: string) => ({ params: { id } });

describe('eventsParamsSchemas', () => {
  it('parses event id params', () => {
    const result = eventIdSchema.parse(undefined, buildReq('42'));
    expect(result).toEqual({ id: 42 });
  });

  it('rejects invalid event id params', () => {
    expect(() => eventIdSchema.parse(undefined, buildReq('0'))).toThrow('id must be a positive number');
    expect(() => eventIdSchema.parse(undefined, buildReq('nope'))).toThrow('id must be a positive number');
  });
});
