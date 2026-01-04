import { beforeEach, describe, expect, it, vi } from 'vitest';
import { announcementSchema, supportLinkReorderSchema, supportLinkSchema } from '../../src/validation/homeSchemas';
import { listSupportLinks } from '../../src/repositories/supportLinkRepository';

vi.mock('../../src/repositories/supportLinkRepository', () => ({
  listSupportLinks: vi.fn(),
}));

describe('homeSchemas', () => {
  const mockedListSupportLinks = vi.mocked(listSupportLinks);

  beforeEach(() => {
    mockedListSupportLinks.mockReset();
  });

  it('parses announcement payloads', () => {
    const result = announcementSchema.parse({ message: 'Hello' });
    expect(result).toEqual({ message: 'Hello' });
  });

  it('rejects invalid announcement payloads', () => {
    expect(() => announcementSchema.parse({ message: '' })).toThrow('message must be a non-empty string');
  });

  it('parses support link payloads', () => {
    const result = supportLinkSchema.parse({ title: 'Docs', description: 'Desc', link: 'https://example.com' });
    expect(result).toEqual({ title: 'Docs', description: 'Desc', link: 'https://example.com' });
  });

  it('rejects invalid support link payloads', () => {
    expect(() => supportLinkSchema.parse({ title: '', description: 'Desc', link: 'x' })).toThrow('title is required');
  });

  it('parses reorder payloads when ids are valid', () => {
    mockedListSupportLinks.mockReturnValue([{ id: 1 }, { id: 2 }] as never);
    const result = supportLinkReorderSchema.parse({ ids: [2, 1] });
    expect(result).toEqual({ ids: [2, 1] });
  });

  it('rejects reorder payloads with invalid ids', () => {
    mockedListSupportLinks.mockReturnValue([{ id: 1 }, { id: 2 }] as never);
    expect(() => supportLinkReorderSchema.parse({ ids: [] })).toThrow('ids must be an array of numbers');
    expect(() => supportLinkReorderSchema.parse({ ids: [1, 1] })).toThrow('ids must be unique');
    expect(() => supportLinkReorderSchema.parse({ ids: [3] })).toThrow('ids must match existing support links');
  });
});
