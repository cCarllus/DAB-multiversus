import type { DatabaseQueryable } from '../types';

interface ExistingUserRow {
  email: string;
  id: string;
  name: string | null;
  nickname: string | null;
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function sanitizeNicknameCandidate(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '.')
    .replace(/[._-]{2,}/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 24);
}

function buildNicknameBase(row: ExistingUserRow): string {
  const emailAlias = row.email.split('@')[0] ?? 'player';
  const normalizedCandidate = sanitizeNicknameCandidate(row.nickname ?? emailAlias);

  if (normalizedCandidate.length >= 3) {
    return normalizedCandidate;
  }

  return `player${row.id.replaceAll('-', '').slice(0, 8)}`.slice(0, 24);
}

function buildUniqueNickname(base: string, usedNicknames: Set<string>): string {
  let candidate = base;
  let suffix = 1;

  while (usedNicknames.has(candidate)) {
    suffix += 1;
    const suffixLabel = `-${suffix}`;
    const trimmedBase =
      base.slice(0, Math.max(3, 24 - suffixLabel.length)).replace(/[._-]+$/g, '') || 'player';
    candidate = `${trimmedBase}${suffixLabel}`;
  }

  usedNicknames.add(candidate);
  return candidate;
}

function buildDisplayName(row: ExistingUserRow, nickname: string): string {
  const normalizedName = row.name ? normalizeWhitespace(row.name) : '';
  return normalizedName || nickname;
}

async function hasColumn(
  client: DatabaseQueryable,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = $1
         AND column_name = $2
     ) AS "exists"`,
    [tableName, columnName],
  );

  return result.rows[0]?.exists ?? false;
}

async function hasUniqueConstraint(
  client: DatabaseQueryable,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.table_constraints AS tc
       INNER JOIN information_schema.key_column_usage AS kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = current_schema()
         AND tc.table_name = $1
         AND tc.constraint_type = 'UNIQUE'
         AND kcu.column_name = $2
     ) AS "exists"`,
    [tableName, columnName],
  );

  return result.rows[0]?.exists ?? false;
}

export async function normalizeUsersProfileMigration(client: DatabaseQueryable): Promise<void> {
  if (!(await hasColumn(client, 'users', 'name'))) {
    await client.query(`ALTER TABLE users ADD COLUMN name TEXT`);
  }

  if (!(await hasColumn(client, 'users', 'nickname'))) {
    await client.query(`ALTER TABLE users ADD COLUMN nickname TEXT`);
  }

  if (!(await hasColumn(client, 'users', 'profile_image_url'))) {
    await client.query(`ALTER TABLE users ADD COLUMN profile_image_url TEXT`);
  }

  if (await hasColumn(client, 'users', 'username')) {
    await client.query(`
      UPDATE users
      SET nickname = COALESCE(NULLIF(BTRIM(nickname), ''), NULLIF(BTRIM(username), ''))
      WHERE nickname IS NULL OR BTRIM(nickname) = ''
    `);
    await client.query(`ALTER TABLE users DROP COLUMN username`);
  }

  const result = await client.query<ExistingUserRow>(
    `SELECT id, email, name, nickname
     FROM users
     ORDER BY created_at ASC, id ASC`,
  );
  const usedNicknames = new Set<string>();

  for (const row of result.rows) {
    const nickname = buildUniqueNickname(buildNicknameBase(row), usedNicknames);
    const name = buildDisplayName(row, nickname);

    if (row.nickname !== nickname || row.name !== name) {
      await client.query(
        `UPDATE users
         SET nickname = $2, name = $3, updated_at = NOW()
         WHERE id = $1`,
        [row.id, nickname, name],
      );
    }
  }

  await client.query(`ALTER TABLE users ALTER COLUMN nickname SET NOT NULL`);
  await client.query(`ALTER TABLE users ALTER COLUMN name SET NOT NULL`);

  if (!(await hasUniqueConstraint(client, 'users', 'nickname'))) {
    await client.query(`ALTER TABLE users ADD CONSTRAINT users_nickname_unique UNIQUE (nickname)`);
  }
}
