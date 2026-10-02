# MVP 1 — Database Schema

## users

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | TEXT | User name |
| phone | TEXT | User phone |
| email | TEXT | Account email |
| created_at | TIMESTAMPTZ | Creation time |

## emergency_contacts

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | References user |
| name | TEXT | Contact name |
| phone | TEXT | Contact phone |
| relationship | TEXT | Relationship to user |
| created_at | TIMESTAMPTZ | Creation time |

## emergency_incidents

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | References user |
| latitude | DOUBLE PRECISION | GPS latitude |
| longitude | DOUBLE PRECISION | GPS longitude |
| accuracy | DOUBLE PRECISION | GPS accuracy |
| started_at | TIMESTAMPTZ | Emergency start |
| ended_at | TIMESTAMPTZ | Emergency end |
| status | TEXT | ACTIVE/CANCELLED/RESOLVED |

## Security

The production database must enforce row-level access controls so users cannot read or modify another user's private emergency information.
