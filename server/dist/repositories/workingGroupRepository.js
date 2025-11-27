"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listWorkingGroups = listWorkingGroups;
exports.findWorkingGroupById = findWorkingGroupById;
exports.createWorkingGroup = createWorkingGroup;
exports.updateWorkingGroup = updateWorkingGroup;
exports.deleteWorkingGroup = deleteWorkingGroup;
const connection_1 = require("../db/connection");
function listWorkingGroups() {
    return connection_1.db.prepare('SELECT * FROM working_groups ORDER BY created_at DESC, id DESC').all();
}
function findWorkingGroupById(id) {
    return connection_1.db.prepare('SELECT * FROM working_groups WHERE id = ?').get(id);
}
function createWorkingGroup(name, description, members) {
    const insert = connection_1.db
        .prepare('INSERT INTO working_groups (name, description, members) VALUES (?, ?, ?)')
        .run(name, description, members);
    return connection_1.db
        .prepare('SELECT * FROM working_groups WHERE id = ?')
        .get(Number(insert.lastInsertRowid));
}
function updateWorkingGroup(id, name, description, members) {
    connection_1.db.prepare('UPDATE working_groups SET name = ?, description = ?, members = ? WHERE id = ?').run(name, description, members, id);
    return connection_1.db.prepare('SELECT * FROM working_groups WHERE id = ?').get(id);
}
function deleteWorkingGroup(id) {
    connection_1.db.prepare('DELETE FROM working_groups WHERE id = ?').run(id);
}
