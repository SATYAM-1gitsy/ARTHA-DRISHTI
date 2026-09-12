-- Runs once, on first initialisation of the postgres volume.
--
-- MLflow keeps its own schema and should not share a database with the
-- application: a `mlflow db upgrade` must never be able to touch drishti's
-- tables.
CREATE DATABASE mlflow;

\connect drishti

CREATE EXTENSION IF NOT EXISTS postgis;
-- Entity resolution (audit finding D-04: 311 ALL-CAPS vs 232 mixed-case MP
-- names). These ship with the postgis image, so agency and vendor
-- canonicalisation needs no extra dependency.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS unaccent;
