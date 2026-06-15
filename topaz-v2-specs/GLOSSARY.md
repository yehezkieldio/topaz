# Glossary

## Work

The canonical creative work in Topaz. A work is not a URL. One work can have many source listings.

## Source Platform

A fiction platform or custom source such as AO3, FanFiction.Net, RoyalRoad, ScribbleHub, Wattpad, or a personal site.

## Work Source

A source listing for a work. Stores URL, normalized URL, source-specific title/author text, word/chapter counts, external ID, and source metadata.

## Contributor

A simple person/handle record for authors or other roles. V2 starts with one contributor table and JSONB platform handles.

## Library Entry

The user's relationship to a work. Stores status, favorite/private flags, priority, and archive state.

## Reading State

The current reading state for one library entry: chapter, percent, rating, notes, dates, reread count.

## Reading Event

Append-only history of reading changes. Used for timeline and time-window stats.

## Taxonomy Kind

A table-driven facet such as fandom, character, relationship, genre, trope, warning, tone, or custom.

## Taxonomy Term

A canonical taxonomy concept. It is not merely a typed string.

## Taxonomy Label

A searchable/displayable string for a taxonomy term. Replaces the old alias table.

## Taxonomy Relation

A graph edge between terms, such as `implies`, `broader`, `related`, `conflicts_with`, or `equivalent_to`.

## Direct Assignment

A term explicitly assigned to a work by the user or system.

## Effective Term

A term that applies to a work either directly or through taxonomy inference.

