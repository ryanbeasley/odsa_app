"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPublicUser = toPublicUser;
exports.serializeAnnouncement = serializeAnnouncement;
exports.serializeSupportLink = serializeSupportLink;
exports.serializeWorkingGroup = serializeWorkingGroup;
exports.serializeEvent = serializeEvent;
exports.serializePushSubscription = serializePushSubscription;
exports.serializeWebPushSubscription = serializeWebPushSubscription;
function toPublicUser(user) {
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name ?? null,
        lastName: user.last_name ?? null,
        phone: user.phone ?? null,
    };
}
function serializeAnnouncement(row) {
    return {
        id: row.id,
        body: row.body,
        createdAt: new Date(row.created_at).toISOString(),
    };
}
function serializeSupportLink(row) {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        link: row.link,
        createdAt: new Date(row.created_at).toISOString(),
    };
}
function serializeWorkingGroup(row) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        members: row.members,
        createdAt: new Date(row.created_at).toISOString(),
    };
}
function serializeEvent(row) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        workingGroupId: row.working_group_id,
        workingGroupName: row.working_group_name ?? null,
        startAt: row.start_at,
        endAt: row.end_at,
        location: row.location,
        seriesUuid: row.series_uuid ?? null,
        recurrence: row.recurrence ?? null,
        seriesEndAt: row.series_end_at ?? null,
        createdAt: new Date(row.created_at).toISOString(),
    };
}
function serializePushSubscription(row) {
    return {
        token: row.token,
        createdAt: new Date(row.created_at).toISOString(),
        announcementAlertsEnabled: Boolean(row.announcement_alerts_enabled),
        eventAlertsEnabled: Boolean(row.event_alerts_enabled),
    };
}
function serializeWebPushSubscription(row) {
    return {
        endpoint: row.endpoint,
        createdAt: new Date(row.created_at).toISOString(),
    };
}
