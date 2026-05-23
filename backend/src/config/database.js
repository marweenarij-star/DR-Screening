/**
 * Database Configuration - SQLite (no server required)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../dr_screening.db');
const db = new sqlite3.Database(dbPath);

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

module.exports = {
    db,
    
    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },
    
    async queryOne(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    },
    
    async insert(table, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?').join(', ');
        
        const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
        return new Promise((resolve, reject) => {
            db.run(sql, values, function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    },
    
    async update(table, data, where, whereParams = []) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        
        const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
        return new Promise((resolve, reject) => {
            db.run(sql, [...values, ...whereParams], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    },
    
    async delete(table, where, whereParams = []) {
        const sql = `DELETE FROM ${table} WHERE ${where}`;
        return new Promise((resolve, reject) => {
            db.run(sql, whereParams, function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    },
    
    async count(table, where = '1=1', params = []) {
        const sql = `SELECT COUNT(*) as count FROM ${table} WHERE ${where}`;
        const row = await this.queryOne(sql, params);
        return row ? row.count : 0;
    }
};
