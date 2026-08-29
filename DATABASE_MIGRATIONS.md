# Database Migration Discipline

## Core Rules
1. **No Destructive Operations**: Never drop tables, delete columns, or change column types if they contain production data.
2. **Backward Compatibility**: Migrations must not break the currently running code.
3. **Expand and Contract Pattern**: 
   - Phase 1: Add new schema/columns.
   - Phase 2: Application writes to both (dual-write).
   - Phase 3: Backfill old records.
   - Phase 4: Application reads only from new schema.
   - Phase 5: Remove old schema.
4. **Validation**: Any AI/Coding agent proposing a schema change must answer the 13 verification questions outlined in the architecture guidelines (e.g., Why is it necessary? Is it rollback possible?).

## Storage Guidelines
- **Transient State**: Do not store temporary job status, rate limit trackers, or short-lived presence data in Postgres. Use Redis.
- **Large Binaries**: Do not store PDFs in Postgres or Redis. Use Supabase Object Storage (or local transient storage for single-node development).
