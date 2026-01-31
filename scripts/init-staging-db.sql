-- PostgreSQL Staging Database Initialization
-- Creates necessary extensions and initial schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schemas if needed
-- (Prisma will handle the actual table creation)

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE rappit_staging TO rappit_staging;

-- Log successful initialization
SELECT 'Rappit staging database initialized successfully' AS status;
