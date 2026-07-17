-- OneMCP Postgres bootstrap
-- Extensions required by v1 (FTS + semantic search + fuzzy match)

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom text search config for Vietnamese: unaccent + simple
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'onemcp_vi_en') THEN
    CREATE TEXT SEARCH CONFIGURATION onemcp_vi_en (COPY = simple);
    ALTER TEXT SEARCH CONFIGURATION onemcp_vi_en
      ALTER MAPPING FOR hword, hword_part, word
      WITH unaccent, simple;
  END IF;
END $$;
