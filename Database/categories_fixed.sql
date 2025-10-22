-- Categories table for Neon PostgreSQL
-- Cleaned version from original pg_dump

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET row_security = off;

-- Remove CREATE EXTENSION (already exists on Neon)
-- Remove OWNER TO rebasedata (not needed)

CREATE TABLE public.categories (
    id SERIAL PRIMARY KEY,
    idnumber INTEGER NOT NULL,
    email VARCHAR(255),
    department VARCHAR(50),
    office VARCHAR(100)
);

-- Insert data
INSERT INTO public.categories (id, idnumber, email, department, office) VALUES
(128, 9876543, 'arbgaliza@gmail.com', 'SGOD', 'secret'),
(129, 1234567, 'arbgaliza@gmail.com', 'SGOD', 'GGGG'),
(134, 2202097, 'arbgaliza@gmail.com', 'SGOD', 'kokey'),
(139, 6785036, 'Admin@gmail.com', 'SGOD', 'banna'),
(142, 5456791, 'Admin@gmail.com', 'SGOD', 'banna'),
(144, 5456792, 'Admin@gmail.com', 'SGOD', 'banna'),
(145, 5456799, 'Admin@gmail.com', 'SGOD', 'banna'),
(151, 1234907, 'Admin@gmail.com', 'SGOD', 'dfdsdfsddssssf'),
(153, 1234978, 'Admin@gmail.com', 'SGOD', 'dfdsdfsddssssf'),
(154, 6789465, 'maezyalexia@gmail.com', 'SGOD', 'dffggffgfgdfdgddddghd'),
(155, 7898579, 'alvinmedrano19@gmail.com', 'SGOD', 'hjkhkhjkhjkhkjjhkjkjkljlkjl'),
(156, 6589132, 'gabriel@gmail.com', 'SGOD', 'shjkhsjkhjkshjhshhsjhjhkjkshkshjkhsjhjks'),
(166, 5467380, 'arbgaliza@gmail.com', 'CID', 'ACOSTA'),
(167, 7865368, 'arbgaliza1@gmail.com', 'CID', 'banna');
