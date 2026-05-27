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

// Replace fnName(<balanced>) with wrap(<balanced>), honoring nested parens.
// A word-char before the name (e.g. "update(") is skipped so we only match
// the standalone function, not a substring of a longer identifier.
function replaceFuncBalanced(sql, fnName, wrap) {
    const needle = fnName.toLowerCase() + '(';
    const lower = sql.toLowerCase();
    let out = '';
    let i = 0;
    while (i < sql.length) {
        const idx = lower.indexOf(needle, i);
        if (idx === -1) { out += sql.slice(i); break; }
        const prev = idx > 0 ? sql[idx - 1] : '';
        if (prev && /[A-Za-z0-9_]/.test(prev)) {
            out += sql.slice(i, idx + needle.length);
            i = idx + needle.length;
            continue;
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
        out += wrap(inner);
        i = j + 1;
    }
    return out;
}

function translate(sql) {
    let s = sql;

    // strftime('%s', X) -> epoch seconds
    s = s.replace(/strftime\(\s*'%s'\s*,\s*([^()]+?)\)/gi, 'EXTRACT(EPOCH FROM ($1)::timestamptz)');

    // datetime('now', ...) variants
    s = s.replace(/datetime\(\s*'now'\s*,\s*'([^']+)'\s*\)/gi, (_m, mod) => `(now() + interval '${mod}')`);
    s = s.replace(/datetime\(\s*'now'\s*,\s*\?\s*\)/gi, '(now() + (?)::interval)');
    s = s.replace(/datetime\(\s*'now'\s*\)/gi, 'now()');
    // date('now', ...) variants -> a DATE value
    s = s.replace(/date\(\s*'now'\s*,\s*'([^']+)'\s*\)/gi, (_m, mod) => `((now() + interval '${mod}')::date)`);
    s = s.replace(/date\(\s*'now'\s*,\s*\?\s*\)/gi, '((now() + (?)::interval)::date)');
    s = s.replace(/date\(\s*'now'\s*\)/gi, 'CURRENT_DATE');

    // Generic single-arg forms (after the 'now' cases are consumed)
    s = replaceFuncBalanced(s, 'datetime', (inner) => `(${inner})::timestamptz`);
    s = replaceFuncBalanced(s, 'date', (inner) => `(${inner})::date`);

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
        // Build with ? placeholders (SET first, then WHERE) and let translate()
        // number them and convert any SQLite functions in the WHERE clause.
        const setClause = keys.map((k) => `${k} = ?`).join(', ');
        const sql = translate(`UPDATE ${table} SET ${setClause} WHERE ${where}`);
        const res = await pool.query(sql, [...values, ...whereParams]);
        return res.rowCount;
    },

    async delete(table, where, whereParams = []) {
        const sql = translate(`DELETE FROM ${table} WHERE ${where}`);
        const res = await pool.query(sql, whereParams);
        return res.rowCount;
    },

    async count(table, where = '1=1', params = []) {
        const sql = translate(`SELECT COUNT(*) as count FROM ${table} WHERE ${where}`);
        const res = await pool.query(sql, params);
        return res.rows[0] ? parseInt(res.rows[0].count, 10) : 0;
    },
};
