"use client";

import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeftIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    Link2Icon,
    PencilIcon,
    PlusIcon,
    Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { useDebounce } from "#/hooks/use-debounce";
import { DEBOUNCE_DELAY_MS } from "#/lib/utils";
import type { TaxonomyTermListRow } from "#/server/db/repositories/taxonomy-repository";
import type { TaxonomyKind } from "#/server/db/schema";
import { taxonomyKindKeys, taxonomyKindLabels } from "#/server/db/schema";
import { useTRPC } from "#/trpc/react";
import type { TaxonomyTermDeleteTarget } from "./taxonomy-term-delete-dialog";
import { TaxonomyTermDeleteDialog } from "./taxonomy-term-delete-dialog";
import type { TaxonomyTermFormTarget } from "./taxonomy-term-form-dialog";
import { TaxonomyTermFormDialog } from "./taxonomy-term-form-dialog";
import type { TaxonomyRelationsTarget } from "./taxonomy-term-relations-dialog";
import { TaxonomyTermRelationsDialog } from "./taxonomy-term-relations-dialog";

const PAGE_SIZE = 25;
const ALL_KINDS = "all" as const;

function getTermVariant(kind: TaxonomyKind) {
    return kind === "fandom" ? "outline" : "secondary";
}

type TaxonomyTermRowProps = {
    term: TaxonomyTermListRow;
    onManageRelations: (term: TaxonomyTermListRow) => void;
    onEdit: (term: TaxonomyTermListRow) => void;
    onDelete: (term: TaxonomyTermListRow) => void;
};

const TaxonomyTermRow = React.memo(function TaxonomyTermRowComponent({
    term,
    onManageRelations,
    onEdit,
    onDelete,
}: TaxonomyTermRowProps) {
    const handleManageRelations = React.useCallback(() => onManageRelations(term), [term, onManageRelations]);
    const handleEdit = React.useCallback(() => onEdit(term), [term, onEdit]);
    const handleDelete = React.useCallback(() => onDelete(term), [term, onDelete]);

    return (
        <li className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-medium text-sm">{term.name}</span>
                    <Badge className="rounded-md text-[10px]" variant={getTermVariant(term.kind)}>
                        {taxonomyKindLabels[term.kind]}
                    </Badge>
                </div>
                <span className="truncate text-muted-foreground text-xs">
                    /{term.slug} · {term.assignmentCount} work
                    {term.assignmentCount === 1 ? "" : "s"}
                </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <Button
                    aria-label={`Manage relations for ${term.name}`}
                    onClick={handleManageRelations}
                    size="icon"
                    title="Relations"
                    type="button"
                    variant="ghost"
                >
                    <Link2Icon className="size-4" />
                </Button>
                <Button
                    aria-label={`Edit ${term.name}`}
                    onClick={handleEdit}
                    size="icon"
                    title="Edit"
                    type="button"
                    variant="ghost"
                >
                    <PencilIcon className="size-4" />
                </Button>
                <Button
                    aria-label={`Delete ${term.name}`}
                    onClick={handleDelete}
                    size="icon"
                    title="Delete"
                    type="button"
                    variant="ghost"
                >
                    <Trash2Icon className="size-4" />
                </Button>
            </div>
        </li>
    );
});

export function TaxonomyManageClient() {
    const trpc = useTRPC();

    const [kind, setKind] = React.useState<TaxonomyKind | typeof ALL_KINDS>(ALL_KINDS);
    const [search, setSearch] = React.useState("");
    const debouncedSearch = useDebounce(search, DEBOUNCE_DELAY_MS);
    const [offset, setOffset] = React.useState(0);

    React.useEffect(() => {
        setOffset(0);
    }, [kind, debouncedSearch]);

    const listQuery = useQuery(
        trpc.taxonomy.list.queryOptions({
            kind: kind === ALL_KINDS ? undefined : kind,
            limit: PAGE_SIZE,
            offset,
            search: debouncedSearch.trim() || undefined,
        })
    );

    const [formTarget, setFormTarget] = React.useState<TaxonomyTermFormTarget | null | undefined>(undefined);
    const [deleteTarget, setDeleteTarget] = React.useState<TaxonomyTermDeleteTarget | null>(null);
    const [relationsTarget, setRelationsTarget] = React.useState<TaxonomyRelationsTarget | null>(null);

    const terms = listQuery.data?.terms ?? [];
    const total = listQuery.data?.total ?? 0;
    const hasNextPage = offset + PAGE_SIZE < total;
    const hasPreviousPage = offset > 0;

    const handleSearchChange = React.useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value),
        []
    );
    const handleKindChange = React.useCallback(
        (value: string) => setKind(value as TaxonomyKind | typeof ALL_KINDS),
        []
    );
    const handleOpenCreate = React.useCallback(() => setFormTarget(null), []);
    const handlePreviousPage = React.useCallback(() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE)), []);
    const handleNextPage = React.useCallback(() => setOffset((prev) => prev + PAGE_SIZE), []);
    const handleCloseForm = React.useCallback(() => setFormTarget(undefined), []);
    const handleCloseDelete = React.useCallback(() => setDeleteTarget(null), []);
    const handleCloseRelations = React.useCallback(() => setRelationsTarget(null), []);

    const handleManageRelations = React.useCallback(
        (term: TaxonomyTermListRow) =>
            setRelationsTarget({ kind: term.kind, name: term.name, publicId: term.publicId }),
        []
    );
    const handleEdit = React.useCallback(
        (term: TaxonomyTermListRow) =>
            setFormTarget({
                description: term.description,
                kind: term.kind,
                name: term.name,
                publicId: term.publicId,
            }),
        []
    );
    const handleDelete = React.useCallback(
        (term: TaxonomyTermListRow) =>
            setDeleteTarget({
                assignmentCount: term.assignmentCount,
                name: term.name,
                publicId: term.publicId,
            }),
        []
    );

    return (
        <div className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 p-4 sm:p-8">
            <div className="flex items-center gap-3">
                <Button asChild size="icon" variant="ghost">
                    <Link aria-label="Back to library" href="/library">
                        <ArrowLeftIcon className="size-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="font-medium text-xl tracking-tight">Manage Taxonomy</h1>
                    <p className="text-muted-foreground text-sm">
                        Rename, delete, and relate fandoms, tags, genres, and other taxonomy terms.
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                    <Input
                        aria-label="Search taxonomy terms"
                        className="sm:max-w-xs"
                        onChange={handleSearchChange}
                        placeholder="Search terms…"
                        value={search}
                    />
                    <Select onValueChange={handleKindChange} value={kind}>
                        <SelectTrigger className="w-full sm:w-44">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_KINDS}>All kinds</SelectItem>
                            {taxonomyKindKeys.map((key) => (
                                <SelectItem key={key} value={key}>
                                    {taxonomyKindLabels[key]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={handleOpenCreate} type="button">
                    <PlusIcon className="size-4" />
                    New term
                </Button>
            </div>

            <div className="min-h-0 flex-1 rounded-md border">
                {listQuery.isLoading ? (
                    <p className="p-4 text-muted-foreground text-sm">Loading taxonomy terms…</p>
                ) : terms.length === 0 ? (
                    <p className="p-4 text-muted-foreground text-sm">No taxonomy terms found.</p>
                ) : (
                    <ul className="divide-y">
                        {terms.map((term) => (
                            <TaxonomyTermRow
                                key={term.publicId}
                                onDelete={handleDelete}
                                onEdit={handleEdit}
                                onManageRelations={handleManageRelations}
                                term={term}
                            />
                        ))}
                    </ul>
                )}
            </div>

            <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                    {total === 0 ? "0 terms" : `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}`}
                </span>
                <div className="flex items-center gap-2">
                    <Button
                        disabled={!hasPreviousPage}
                        onClick={handlePreviousPage}
                        size="sm"
                        type="button"
                        variant="outline"
                    >
                        <ChevronLeftIcon className="size-4" />
                        Previous
                    </Button>
                    <Button disabled={!hasNextPage} onClick={handleNextPage} size="sm" type="button" variant="outline">
                        Next
                        <ChevronRightIcon className="size-4" />
                    </Button>
                </div>
            </div>

            <TaxonomyTermFormDialog
                defaultKind={kind === ALL_KINDS ? undefined : kind}
                isOpen={formTarget !== undefined}
                onCloseAction={handleCloseForm}
                term={formTarget ?? null}
            />
            <TaxonomyTermDeleteDialog
                isOpen={deleteTarget !== null}
                onCloseAction={handleCloseDelete}
                term={deleteTarget}
            />
            <TaxonomyTermRelationsDialog
                isOpen={relationsTarget !== null}
                onCloseAction={handleCloseRelations}
                term={relationsTarget}
            />
        </div>
    );
}
