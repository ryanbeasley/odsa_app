import { describe, expect, it } from 'vitest';
import { userIdParamSchema, userListQuerySchema } from '../../src/validation/settingsParamsSchemas';

const buildReq = (id: string) => ({ params: { id } });

describe('settingsParamsSchemas', () => {
  it('parses user id params', () => {
    const result = userIdParamSchema.parse(undefined, buildReq('7'));
    expect(result).toEqual({ id: 7 });
  });

  it('rejects invalid user id params', () => {
    expect(() => userIdParamSchema.parse(undefined, buildReq('0'))).toThrow('id must be a positive number');
  });

  it('parses user list query params', () => {
    expect(userListQuerySchema.parse({})).toEqual({});
    expect(userListQuerySchema.parse({ q: '  hello ' })).toEqual({ q: 'hello' });
  });

  it('rejects invalid user list query params', () => {
    expect(() => userListQuerySchema.parse({ q: 123 })).toThrow('q must be a string');
  });
});
