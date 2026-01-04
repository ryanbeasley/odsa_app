import { RequestHandler } from 'express';
import {
  createWorkingGroup,
  findWorkingGroupById,
  listWorkingGroups,
  updateWorkingGroup,
  deleteWorkingGroup,
} from '../repositories/workingGroupRepository';
import { deleteEventsByWorkingGroup } from '../repositories/eventRepository';
import { serializeWorkingGroup } from '../utils/serializer';
import { WorkingGroupPayload } from '../validation/eventsSchemas';
import { WorkingGroupIdPayload } from '../validation/workingGroupSchemas';

/**
 * Lists all working groups (auth required).
 */
export const listWorkingGroupsHandler: RequestHandler = (_req, res) => {
  const groups = listWorkingGroups().map(serializeWorkingGroup);
  return res.json({ groups });
};

/**
 * Creates a new working group (admin only).
 */
export const createWorkingGroupHandler: RequestHandler = (req, res) => {
  const { name, description, members } = req.validated as WorkingGroupPayload;
  const created = createWorkingGroup(name, description, members);
  return res.status(201).json({ group: serializeWorkingGroup(created) });
};

/**
 * Updates a working group by ID (admin only).
 */
export const updateWorkingGroupHandler: RequestHandler = (req, res) => {
  const { id } = req.validatedQuery as WorkingGroupIdPayload;
  const { name, description, members } = req.validated as WorkingGroupPayload;
  const updated = updateWorkingGroup(id, name, description, members);
  if (!updated) {
    return res.status(404).json({ error: 'Working group not found' });
  }
  return res.json({ group: serializeWorkingGroup(updated) });
};

/**
 * Deletes a working group by ID (admin only).
 */
export const deleteWorkingGroupHandler: RequestHandler = (req, res) => {
  const { id } = req.validatedQuery as WorkingGroupIdPayload;
  const existing = findWorkingGroupById(id);
  if (!existing) {
    console.log('Working group not found for ID:', id);
    return res.status(404).json({ error: 'Working group not found' });
  }
  deleteEventsByWorkingGroup(id);
  deleteWorkingGroup(id);
  console.log('Deleted working group with ID:', id);
  return res.status(204).send();
};
