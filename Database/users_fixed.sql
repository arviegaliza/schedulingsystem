-- Users table for Neon PostgreSQL
-- Cleaned version from original pg_dump

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET row_security = off;

-- Remove CREATE EXTENSION (Neon already has plpgsql)
-- Remove OWNER TO rebasedata (use Neon default owner)

CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    employee_number INTEGER NOT NULL,
    email VARCHAR(255),
    password VARCHAR(255),
    type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    otp_code VARCHAR(10),
    otp_expires VARCHAR(50)
);

-- Insert data
INSERT INTO public.users (id, employee_number, email, password, type, created_at, updated_at, otp_code, otp_expires) VALUES
(23, 2202093, 'Admin@gmail.com', 'admin', 'Administrator', '2025-07-08 12:28:50', '2025-07-08 12:28:50', NULL, NULL),
(24, 1234567, 'arbgaliza@gmail.com', '123456', 'OSDS', '2025-07-08 14:12:40', '2025-07-08 14:12:40', NULL, NULL),
(25, 7654321, 'arbgaliza@gmail.com', 'admin', 'SGOD', '2025-07-08 14:13:54', '2025-07-08 14:13:54', NULL, NULL),
(26, 7865478, 'arvir@gmail.com', 'cid', 'CID', '2025-07-17 12:39:10', '2025-07-17 12:39:10', NULL, NULL);
