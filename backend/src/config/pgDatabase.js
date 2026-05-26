/**
 * PostgreSQL database adapter.
 *
 * Exposes the SAME interface as the SQLite module (query, queryOne, insert,
 * update, delete, count) so the rest of the app is unchanged. Translates the
 * SQLite-flavoured SQL the routes use into PostgreSQL on the fly:
 *   - `?` positional placeholders  -> `$1, $2, ...`
 *   - `LIKE`                        -> `ILIKE` (SQLite LIKE is case-insensitive)
 *   - `datetime('now', '-5 min')`   -> `(now() + interval '-5 min')`
 *   - `datetime('now', ?)`          -> `(now() + ($n)::interval)`
 *   - `datetime(expr)`              -> `(expr)::timestamptz`
 *   - `strftime('%s', expr)`        -> `EXTRACT(EPOCH FROM (expr)::timestamptz)`
 */

const { Pool, types } = require('pg');

// Return timestamp columns as raw strings (like SQLite) instead of JS Date
// objects, so any string handling in the app keeps behaving the same.
types.setTypeParser(1114, (v) => v); // timestamp without time zone
types.setTypeParser(1184, (v) => v); // timestamp with time zone
types.setTypeParser(1082, (v) => v); // date
// bigint (e.g. COUNT(*)) defaults to string in node-postgres; counts here are
// always well within Number range, so parse to a JS number to match SQLite.
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString,
    // Supabase requires SSL; the platform cert isn't in the local trust store.
    ssl: { rejectUnauthorized: false },
    max: parseInt(process.env.PG_POOL_MAX || '8', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
});

pool.on('error', (err) => {
    console.error('[pgDatabase] idle client error:', err.message);
});

// Replace datetime(<balanced>) with (<balanced>)::timestamptz, honoring nested parens.
function replaceDatetimeBalanced(sql) {
    const needle = 'datetime(';
    let out = '';
    let i = 0;
    const lower = sql.toLowerCase();
    while (i < sql.length) {
        const idx = lower.indexOf(needle, i);
        if (idx === -1) {
            out += sql.slice(i);
            break;
        }
        out += sql.slice(i, idx);
        let depth = 0;
        let j = idx + needle.length - 1; // index of the opening '('
        const start = j + 1;
        for (; j < sql.length; j++) {
            if (sql[j] === '(') depth++;
            else if (sql[j] === ')') { depth--; if (depth === 0) break; }
        }
        const inner = sql.slice(start, j);
        out += `(${inner})::timestamptz`;
        i = j + 1;
    }
    return out;
}

function translate(sql) {
    let s = sql;

    // strftime('%s', X) -> epoch seconds
    s = s.replace(/strftime\(\s*'%s'\s*,\s*([^()]+?)\)/gi, 'EXTRACT(EPOCH FROM ($1)::timestamptz)');

    // datetime('now', '<modifier>') -> (now() + interval '<modifier>')
    s = s.replace(/datetime\(\s*'now'\s*,\s*'([^']+)'\s*\)/gi, (_m, mod) => `(now() + interval '${mod}')`);
    // datetime('now', ?) -> (now() + (?)::interval)  [? becomes $n below]
    s = s.replace(/datetime\(\s*'now'\s*,\s*\?\s*\)/gi, '(now() + (?)::interval)');
    // datetime('now') -> now()
    s = s.replace(/datetime\(\s*'now'\s*\)/gi, 'now()');
    // datetime(<expr>) -> (<expr>)::timestamptz  (remaining single-arg forms)
    s = replaceDatetimeBalanced(s);

    // SQLite LIKE is case-insensitive; ILIKE matches that behavior in Postgres.
    s = s.replace(/\bLIKE\b/gi, 'ILIKE');

    // Positional placeholders: ? -> $1, $2, ... (done last so all ? are numbered)
    let n = 0;
    s = s.replace(/\?/g, () => `$${++n}`);

    return s;
}

async function run(sql, params = []) {
    const text = translate(sql);
    return pool.query(text, params);
}

module.exports = {
    pool,
    db: pool, // compatibility shim; SQLite-only code paths are guarded by DATABASE_URL

    // Run raw SQL with NO translation (used for schema DDL).
    async raw(sql, params = []) {
        return pool.query(sql, params);
    },

    async query(sql, params = []) {
        const res = await run(sql, params);
        return res.rows || [];
    },

    async queryOne(sql, params = []) {
        const res = await run(sql, params);
        return (res.rows && res.rows[0]) || null;
    },

    async insert(table, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const cols = keys.join(', ');
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING id`;
        const res = await pool.query(sql, values);
        return res.rows[0] ? res.rows[0].id : null;
    },

    async update(table, data, where, whereParams = []) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        // Renumber the WHERE clause placeholders to continue after the SET values.
        let n = keys.length;
        const whereText = where.replace(/\?/g, () => `$${++n}`);
        const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereText}`;
        const res = await pool.query(sql, [...values, ...whereParams]);
        return res.rowCount;
    },

    async delete(table, where, whereParams = []) {
        let n = 0;
        const whereText = where.replace(/\?/g, () => `$${++n}`);
        const sql = `DELETE FROM ${table} WHERE ${whereText}`;
        const res = await pool.query(sql, whereParams);
        return res.rowCount;
    },

    async count(table, where = '1=1', params = []) {
        let n = 0;
        const whereText = where.replace(/\?/g, () => `$${++n}`);
        const sql = `SELECT COUNT(*) as count FROM ${table} WHERE ${whereText}`;
        const res = await pool.query(sql, params);
        return res.rows[0] ? parseInt(res.rows[0].count, 10) : 0;
    },
};
