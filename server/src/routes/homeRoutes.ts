import { RouteDefinition } from './types';
import { announcementSchema, supportLinkSchema, supportLinkReorderSchema } from '../validation/homeSchemas';
import { announcementQuerySchema, supportLinkIdSchema } from '../validation/homeParamsSchemas';
import {
  getAnnouncements,
  createAnnouncementHandler,
  listSupportLinksHandler,
  createSupportLinkHandler,
  reorderSupportLinksHandler,
  updateSupportLinkHandler,
  deleteSupportLinkHandler,
} from '../controllers/homeController';

export const homeRoutes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/announcements',
    handler: getAnnouncements,
    querySchema: announcementQuerySchema,
  },
  {
    method: 'POST',
    path: '/announcements',
    handler: createAnnouncementHandler,
    schema: announcementSchema,
    admin: true,
  },
  { method: 'GET', path: '/support-links', handler: listSupportLinksHandler },
  {
    method: 'POST',
    path: '/support-links',
    handler: createSupportLinkHandler,
    schema: supportLinkSchema,
    admin: true,
  },
  {
    method: 'PATCH',
    path: '/support-links/reorder',
    handler: reorderSupportLinksHandler,
    schema: supportLinkReorderSchema,
    admin: true,
  },
  {
    method: 'PATCH',
    path: '/support-links/:id',
    handler: updateSupportLinkHandler,
    schema: supportLinkSchema,
    querySchema: supportLinkIdSchema,
    admin: true,
  },
  {
    method: 'DELETE',
    path: '/support-links/:id',
    handler: deleteSupportLinkHandler,
    querySchema: supportLinkIdSchema,
    admin: true,
  },
];
