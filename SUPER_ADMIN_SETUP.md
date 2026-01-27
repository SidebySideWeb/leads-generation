# Super Admin User Setup

## Overview

A super admin user has been configured with the following credentials:
- **Email**: `dgeronikolos@sidebysideweb.gr`
- **Password**: `!84C*HAaw#D#PxHL`
- **Plan**: `pro`
- **Internal User**: `true` (bypasses all limits)

## Setup Steps

### 1. Create Users Table

First, run the migration to create the `users` table:

```bash
npm run migrate:users
```

Or directly:
```bash
tsx src/db/migrations/run.ts create_users_table.sql
```

This creates a table with:
- `id` (UUID)
- `email` (unique)
- `password_hash` (bcrypt)
- `plan` (demo/starter/pro)
- `is_internal_user` (boolean)
- `created_at`, `updated_at`

### 2. Create Super Admin User

Run the script to create the super admin:

```bash
npm run create-super-admin
```

Or directly:
```bash
tsx src/cli/createSuperAdmin.ts
```

The script will:
- Check if user already exists
- Hash the password using bcrypt
- Create the user with `is_internal_user = true` and `plan = 'pro'`
- If user exists, update it to ensure super admin status

### 3. Verify User Creation

Check the database:

```sql
SELECT id, email, plan, is_internal_user, created_at 
FROM users 
WHERE email = 'dgeronikolos@sidebysideweb.gr';
```

## Super Admin Permissions

The super admin user (`is_internal_user = true`) has:
- **Unlimited exports**: No row limits
- **Unlimited crawls**: No monthly crawl limits
- **Unlimited datasets**: Can create unlimited datasets
- **Maximum crawl depth**: Up to 10 pages (safety cap)
- **No usage tracking**: Bypasses all monthly usage limits
- **Re-crawl access**: Can re-crawl websites without restrictions

## Security Notes

- Password is hashed using bcrypt with 10 salt rounds
- `is_internal_user` flag is server-side only (never sent to client)
- Super admin status cannot be set via API or client requests
- Only database administrators can set this flag

## Troubleshooting

### "Users table does not exist"
Run the migration first:
```bash
npm run migrate:users
```

### "Database connection failed"
Ensure your `.env` file has correct database credentials:
- `DATABASE_URL` or
- `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`

### "User already exists"
The script will update the existing user to ensure super admin status and update the password.

## Next Steps

After creating the super admin user, you'll need to:
1. Implement authentication endpoints (login/register) that use the `users` table
2. Update JWT generation to include `is_internal_user` flag
3. Ensure permission checks use the `is_internal_user` flag from the database
