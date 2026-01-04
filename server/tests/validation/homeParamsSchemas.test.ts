import { describe, expect, it } from 'vitest';
import { announcementQuerySchema, supportLinkIdSchema } from '../../src/validation/homeParamsSchemas';

const buildReq = (id: string) => ({ params: { id } });

describe('homeParamsSchemas', () => {
  it('parses support link id params', () => {
    const result = supportLinkIdSchema.parse(undefined, buildReq('5'));
    expect(result).toEqual({ id: 5 });
  });

  it('rejects invalid support link id params', () => {
    expect(() => supportLinkIdSchema.parse(undefined, buildReq('0'))).toThrow('id must be a positive number');
  });

  it('parses announcement query params', () => {
    expect(announcementQuerySchema.parse({})).toEqual({ limit: 5 });
    expect(announcementQuerySchema.parse({ limit: '50' })).toEqual({ limit: 20 });
    expect(announcementQuerySchema.parse({ limit: '2', cursor: '10' })).toEqual({ limit: 2, cursor: 10 });
  });

  it('rejects invalid announcement query params', () => {
    expect(() => announcementQuerySchema.parse({ cursor: '0' })).toThrow('cursor must be a positive number');
  });
});
