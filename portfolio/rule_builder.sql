-- ============================================================================
-- V002__create_rule_builder_schema.sql
--
-- Rule Builder module schema, under the los_config schema.
-- Exported directly from the live Postgres instance (los_lap database, via
-- pgAdmin) — this is the exact current schema, not a reconstruction.
-- No migration file previously existed in the repo for this module
-- (tracked as a known gap in the project handoff notes).
-- ============================================================================

-- Table: los_config.rule_definition

-- DROP TABLE IF EXISTS los_config.rule_definition;

CREATE TABLE IF NOT EXISTS los_config.rule_definition
(
    rule_key character varying(100) COLLATE pg_catalog."default" NOT NULL,
    label character varying(200) COLLATE pg_catalog."default" NOT NULL,
    version integer NOT NULL DEFAULT 1,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'draft'::character varying,
    payload_json jsonb NOT NULL,
    updated_by character varying(100) COLLATE pg_catalog."default" NOT NULL DEFAULT 'local_dev_user'::character varying,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT rule_definition_pkey PRIMARY KEY (rule_key)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS los_config.rule_definition
    OWNER to postgres;


-- Table: los_config.rule_definition_history

-- DROP TABLE IF EXISTS los_config.rule_definition_history;

CREATE TABLE IF NOT EXISTS los_config.rule_definition_history
(
    id bigserial NOT NULL,
    rule_key character varying(100) COLLATE pg_catalog."default" NOT NULL,
    version integer NOT NULL,
    payload_json jsonb NOT NULL,
    changed_by character varying(100) COLLATE pg_catalog."default" NOT NULL DEFAULT 'local_dev_user'::character varying,
    changed_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT rule_definition_history_pkey PRIMARY KEY (id),
    CONSTRAINT rule_definition_history_rule_key_version_key UNIQUE (rule_key, version)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS los_config.rule_definition_history
    OWNER to postgres;

-- Index: idx_rule_definition_history_key

-- DROP INDEX IF EXISTS los_config.idx_rule_definition_history_key;

CREATE INDEX IF NOT EXISTS idx_rule_definition_history_key
    ON los_config.rule_definition_history USING btree
    (rule_key COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;