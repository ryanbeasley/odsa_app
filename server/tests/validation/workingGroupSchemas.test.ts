import { describe, expect, it } from 'vitest';
import { workingGroupIdSchema } from '../../src/validation/workingGroupSchemas';

const buildReq = (id: string) => ({ params: { id } });

describe('workingGroupSchemas', () => {
  it('parses working group id params', () => {
    const result = workingGroupIdSchema.parse(undefined, buildReq('3'));
    expect(result).toEqual({ id: 3 });
  });

  it('rejects invalid working group id params', () => {
    expect(() => workingGroupIdSchema.parse(undefined, buildReq('0'))).toThrow('id must be a positive number');
  });
});
