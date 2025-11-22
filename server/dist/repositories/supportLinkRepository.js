"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSupportLinks = listSupportLinks;
exports.createSupportLink = createSupportLink;
exports.updateSupportLink = updateSupportLink;
exports.deleteSupportLink = deleteSupportLink;
exports.reorderSupportLinks = reorderSupportLinks;
const connection_1 = require("../db/connection");
function listSupportLinks() {
    return connection_1.db
        .prepare('SELECT * FROM support_links ORDER BY position ASC, created_at ASC, id ASC')
        .all();
}
function createSupportLink(title, description, link) {
    const maxPositionRow = connection_1.db
        .prepare('SELECT MAX(position) as maxPos FROM support_links')
        .get();
    const nextPosition = (maxPositionRow?.maxPos ?? -1) + 1;
    const insert = connection_1.db
        .prepare('INSERT INTO support_links (title, description, link, position) VALUES (?, ?, ?, ?)')
        .run(title, description, link, nextPosition);
    return connection_1.db
        .prepare('SELECT * FROM support_links WHERE id = ?')
        .get(Number(insert.lastInsertRowid));
}
function updateSupportLink(id, title, description, link) {
    connection_1.db.prepare('UPDATE support_links SET title = ?, description = ?, link = ? WHERE id = ?').run(title, description, link, id);
    return connection_1.db.prepare('SELECT * FROM support_links WHERE id = ?').get(id);
}
function deleteSupportLink(id) {
    connection_1.db.prepare('DELETE FROM support_links WHERE id = ?').run(id);
}
function reorderSupportLinks(ids) {
    const applyOrder = connection_1.db.transaction((orderedIds) => {
        orderedIds.forEach((linkId, index) => {
            connection_1.db.prepare('UPDATE support_links SET position = ? WHERE id = ?').run(index, linkId);
        });
    });
    applyOrder(ids);
    return listSupportLinks();
}
