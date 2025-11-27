"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findUserByEmail = findUserByEmail;
exports.findUserById = findUserById;
exports.createUser = createUser;
exports.listUsers = listUsers;
exports.updateUserProfile = updateUserProfile;
exports.updateUserRole = updateUserRole;
const connection_1 = require("../db/connection");
function findUserByEmail(email) {
    return connection_1.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}
function findUserById(id) {
    return connection_1.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}
function createUser(email, passwordHash, role) {
    const info = connection_1.db
        .prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
        .run(email, passwordHash, role);
    return findUserById(Number(info.lastInsertRowid));
}
function listUsers(search) {
    if (search?.trim()) {
        const term = `%${search.trim().toLowerCase()}%`;
        return connection_1.db
            .prepare(`SELECT * FROM users
         WHERE LOWER(email) LIKE ?
            OR LOWER(COALESCE(first_name, '')) LIKE ?
            OR LOWER(COALESCE(last_name, '')) LIKE ?
         ORDER BY email ASC`)
            .all(term, term, term);
    }
    return connection_1.db.prepare('SELECT * FROM users ORDER BY email ASC').all();
}
function updateUserProfile(id, updates) {
    const fields = [];
    const values = [];
    if (updates.email !== undefined) {
        fields.push('email = ?');
        values.push(updates.email);
    }
    if (updates.first_name !== undefined) {
        fields.push('first_name = ?');
        values.push(updates.first_name);
    }
    if (updates.last_name !== undefined) {
        fields.push('last_name = ?');
        values.push(updates.last_name);
    }
    if (updates.phone !== undefined) {
        fields.push('phone = ?');
        values.push(updates.phone);
    }
    if (!fields.length) {
        return findUserById(id);
    }
    values.push(id);
    connection_1.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return findUserById(id);
}
function updateUserRole(id, role) {
    connection_1.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    return findUserById(id);
}
