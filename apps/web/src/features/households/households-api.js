import { apiRequest } from '../../lib/api-client.js';

export const householdKeys = {
  all: ['households'],
  detail: (id) => ['households', id],
  members: (id) => ['households', id, 'members'],
  invitations: (id) => ['households', id, 'invitations'],
};

export const listHouseholds = async () => (await apiRequest('/households')).households;

export const createHousehold = async (body) =>
  (await apiRequest('/households', { method: 'POST', body })).household;

export const getHousehold = async (id) => (await apiRequest(`/households/${id}`)).household;

export const listMembers = async (id) => (await apiRequest(`/households/${id}/members`)).members;

export const listInvitations = async (id) =>
  (await apiRequest(`/households/${id}/invitations`)).invitations;

export const createInvitation = async (id, body) =>
  (await apiRequest(`/households/${id}/invitations`, { method: 'POST', body })).invitation;

export const revokeInvitation = (id, invitationId) =>
  apiRequest(`/households/${id}/invitations/${invitationId}`, { method: 'DELETE' });

export const previewInvitation = async (token) =>
  (await apiRequest('/invitations/preview', { method: 'POST', body: { token }, auth: false }))
    .invitation;

export const acceptInvitation = async (token) =>
  (await apiRequest('/invitations/accept', { method: 'POST', body: { token } })).household;
