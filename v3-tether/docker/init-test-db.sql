create database topaz_test;
\connect topaz_test
create extension if not exists citext;
create extension if not exists pg_trgm;
