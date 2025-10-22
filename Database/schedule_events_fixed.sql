-- Schedule Events table for Neon PostgreSQL
-- Cleaned version from original pg_dump

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET row_security = off;

-- Remove CREATE EXTENSION and OWNER lines (handled by Neon)

CREATE TABLE public.schedule_events (
    id SERIAL PRIMARY KEY,
    program VARCHAR(255),
    start_date DATE,
    end_date DATE,
    purpose VARCHAR(255),
    created_at TIMESTAMP,
    category_id INTEGER,
    start_time TIME,
    end_time TIME,
    participants TEXT,
    department TEXT,
    status VARCHAR(20),
    created_by VARCHAR(255),
    notified BOOLEAN DEFAULT false
);

-- Insert data
INSERT INTO public.schedule_events 
(program, start_date, end_date, purpose, created_at, category_id, start_time, end_time, participants, department, status, created_by, notified) 
VALUES
('gg', '2025-07-17', '2025-07-17', 'gg', '2025-07-15 17:56:25', NULL, '14:00:00', '15:00:00', '["secret"]', '["SGOD"]', 'ended', 'arbgaliza@gmail.com', false),
('gg', '2025-07-17', '2025-07-17', 'gg', '2025-07-15 17:57:09', NULL, '14:00:00', '15:00:00', '["GGGG","banna","dfdsdfsddssssf","dffggffgfgdfdgddddghd","shjkhsjkhjkshjhshhsjhjhkjkshkshjkhsjhjks","kokey","hjkhkhjkhjkhkjjhkjkjkljlkjl"]', '["SGOD"]', 'ended', 'arbgaliza@gmail.com', false),
('meeting', '2025-07-15', '2025-07-15', 'gg', '2025-07-15 18:06:44', NULL, '14:00:00', '15:00:00', '["GGGG"]', '["SGOD"]', 'ended', 'arbgaliza@gmail.com', false),
('meeting', '2025-07-17', '2025-07-17', 'ff', '2025-07-15 18:07:29', NULL, '19:00:00', '20:00:00', '["GGGG"]', '["SGOD"]', 'ended', 'arbgaliza@gmail.com', true),
('meeting', '2025-07-17', '2025-07-17', 'ff', '2025-07-15 18:08:26', NULL, '20:00:00', '21:00:00', '["GGGG"]', '["SGOD"]', 'ended', 'arbgaliza@gmail.com', true),
('SECRET AKO LANG ANG MAY ALA,', '2025-07-17', '2025-07-17', 'okay', '2025-07-17 13:38:09', NULL, '22:00:00', '23:00:00', '["ACOSTA"]', '["CID"]', 'ended', 'arbgaliza@gmail.com', true),
('SECRET AKO LANG ANG MAY ALA,', '2025-07-22', '2025-07-22', 'gg', '2025-07-22 14:35:53', NULL, '20:40:00', '22:00:00', '["secret"]', '["SGOD"]', 'ended', 'arbgaliza@gmail.com', true),
('SECRET AKO LANG ANG MAY ALA,', '2025-07-23', '2025-07-23', 'gg', '2025-07-23 08:17:34', NULL, '15:00:00', '16:00:00', '["ACOSTA"]', '["CID"]', 'ended', 'Admin@gmail.com', true),
('meeting', '2025-07-23', '2025-07-23', 'FF', '2025-07-23 08:19:10', NULL, '15:00:00', '16:00:00', '["GGGG"]', '["SGOD"]', 'ended', 'arbgaliza@gmail.com', true),
('SECRET AKO LANG ANG MAY ALA,', '2025-07-23', '2025-07-23', 'gg', '2025-07-23 08:21:20', NULL, '15:00:00', '16:00:00', '["banna"]', '["CID"]', 'ended', 'arvir@gmail.com', true),
('meeting', '2025-08-01', '2025-08-01', 'gg', '2025-08-01 04:08:49', NULL, '11:00:00', '12:00:00', '["secret"]', '["SGOD"]', 'upcoming', 'arbgaliza@gmail.com', true);
