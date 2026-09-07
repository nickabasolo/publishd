#!/usr/bin/env node
// Runs a .sql file (or inline SQL via --sql) against the linked Supabase
// database. Connection credentials are obtained fresh from the Supabase CLI
// (`supabase db dump --dry-run`, which prints a throwaway pg_dump script
// containing PG* env vars for a short-lived `cli_login_postgres` role) and
// are NEVER written to stdout/stderr. Only query results are printed.
//
// Usage:
//   node scripts/db-query.mjs path/to/file.sql
//   node scripts/db-query.mjs --sql "select 1"
//   cat foo.sql | node scripts/db-query.mjs -
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Client } from "pg";

function getConnectionConfig() {
  // Ask the Supabase CLI for a dry-run dump script. It embeds fresh
  // short-lived PG* credentials for the linked project as `export` lines.
  // We parse them out of memory only — never echoed.
  const out = execFileSync(
    "npx",
    ["supabase", "db", "dump", "--dry-run", "--linked", "-f", "/dev/null"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  ).toString();

  const grab = (name) => {
    const m = out.match(new RegExp(`export ${name}="([^"]*)"`));
    if (!m) throw new Error(`could not find ${name} in supabase CLI output`);
    return m[1];
  };

  return {
    host: grab("PGHOST"),
    port: Number(grab("PGPORT")),
    user: grab("PGUSER"),
    password: grab("PGPASSWORD"),
    database: grab("PGDATABASE"),
    ssl: { rejectUnauthorized: false },
  };
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      "usage: node scripts/db-query.mjs <file.sql> | --sql \"<sql>\" | -"
    );
    process.exit(1);
  }

  let sql;
  if (arg === "--sql") {
    sql = process.argv[3];
    if (!sql) {
      console.error("missing SQL string after --sql");
      process.exit(1);
    }
  } else if (arg === "-") {
    sql = readFileSync(0, "utf8");
  } else {
    sql = readFileSync(arg, "utf8");
  }

  const config = getConnectionConfig();
  const client = new Client(config);
  await client.connect();
  try {
    // Support multi-statement files (simple_query protocol via `query`
    // handles `;`-separated statements as long as no parameters are used).
    const result = await client.query(sql);
    const results = Array.isArray(result) ? result : [result];
    for (const r of results) {
      if (r && r.command && /^(DO|BEGIN|COMMIT|ROLLBACK|SET)$/i.test(r.command) && (!r.rows || r.rows.length === 0)) {
        console.log(`-- ${r.command} ok`);
        continue;
      }
      if (r && r.rows && r.rows.length) {
        console.table(r.rows);
      } else if (r && r.command) {
        console.log(`-- ${r.command} (${r.rowCount ?? 0} rows)`);
      }
    }
  } catch (err) {
    console.error("QUERY ERROR:", err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
