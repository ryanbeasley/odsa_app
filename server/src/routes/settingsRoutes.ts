import { RouteDefinition } from './types';
import { profileUpdateSchema } from '../validation/userSchemas';
import { pushSubscriptionSchema, smsPushSubscriptionSchema, userRoleSchema } from '../validation/settingsSchemas';
import { userIdParamSchema, userListQuerySchema } from '../validation/settingsParamsSchemas';
import {
  updateProfileHandler,
  upsertSmsSubscriptionHandler,
  upsertPushSubscriptionHandler,
  getPushSubscriptionHandler,
  deletePushSubscriptionHandler,
  listUsersHandler,
  updateUserRoleHandler,
  syncDiscordHandler,
} from '../controllers/settingsController';

export const settingsRoutes: RouteDefinition[] = [
  { method: 'PATCH', path: '/profile', handler: updateProfileHandler, schema: profileUpdateSchema },
  {
    method: 'POST',
    path: '/sms-subscriptions',
    handler: upsertSmsSubscriptionHandler,
    schema: smsPushSubscriptionSchema,
  },
  {
    method: 'POST',
    path: '/push-subscriptions',
    handler: upsertPushSubscriptionHandler,
    schema: pushSubscriptionSchema,
  },
  { method: 'GET', path: '/push-subscriptions', handler: getPushSubscriptionHandler },
  { method: 'DELETE', path: '/push-subscriptions', handler: deletePushSubscriptionHandler },
  { method: 'GET', path: '/users', handler: listUsersHandler, querySchema: userListQuerySchema, admin: true },
  {
    method: 'PATCH',
    path: '/users/:id/role',
    handler: updateUserRoleHandler,
    schema: userRoleSchema,
    querySchema: userIdParamSchema,
    admin: true,
  },
  { method: 'POST', path: '/discord-sync', handler: syncDiscordHandler, admin: true },
];
