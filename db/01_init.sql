--
-- NOTE: This is a placeholder. As requested, please replace this
-- with the full production schema from the MCP toolkit (db/10_init.sql).
--
CREATE TABLE IF NOT EXISTS placeholder_table (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL
);

INSERT INTO placeholder_table (description)
VALUES ('This is a placeholder schema. Please replace it with the full 01_init.sql content.');
