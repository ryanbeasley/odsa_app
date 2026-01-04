import { RouteDefinition } from './types';
import { workingGroupSchema } from '../validation/eventsSchemas';
import { workingGroupIdSchema } from '../validation/workingGroupSchemas';
import {
  listWorkingGroupsHandler,
  createWorkingGroupHandler,
  updateWorkingGroupHandler,
  deleteWorkingGroupHandler,
} from '../controllers/workingGroupController';

export const workingGroupRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/working-groups', handler: listWorkingGroupsHandler },
  {
    method: 'POST',
    path: '/working-groups',
    handler: createWorkingGroupHandler,
    schema: workingGroupSchema,
    admin: true,
  },
  {
    method: 'PATCH',
    path: '/working-groups/:id',
    handler: updateWorkingGroupHandler,
    schema: workingGroupSchema,
    querySchema: workingGroupIdSchema,
    admin: true,
  },
  {
    method: 'DELETE',
    path: '/working-groups/:id',
    handler: deleteWorkingGroupHandler,
    querySchema: workingGroupIdSchema,
    admin: true,
  },
];
