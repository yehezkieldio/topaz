import "server-only";
import { eq } from "drizzle-orm";

import type { db as dbClient } from "@/server/db/client";
import { taxonomyKind, taxonomyTerm } from "@/server/db/schema";

type Tx = Parameters<Parameters<typeof dbClient.transaction>[0]>[0];

const normalize = (value: string) => value.trim().toLowerCase();

const slugify = (value: string) =>
  normalize(value)
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");

export interface TermRow {
  id: string;
  publicId: string;
  version: number;
}

export const findTermByPublicId = async (
  tx: Tx,
  publicId: string
): Promise<TermRow | undefined> => {
  const [row] = await tx
    .select({
      id: taxonomyTerm.id,
      publicId: taxonomyTerm.publicId,
      version: taxonomyTerm.version,
    })
    .from(taxonomyTerm)
    .where(eq(taxonomyTerm.publicId, publicId))
    .limit(1);
  return row;
};

export const findKindBySlug = async (tx: Tx, slug: string) => {
  const [row] = await tx
    .select({ id: taxonomyKind.id })
    .from(taxonomyKind)
    .where(eq(taxonomyKind.slug, slug))
    .limit(1);
  return row;
};

export const renameTerm = async (
  tx: Tx,
  termId: string,
  currentVersion: number,
  name: string
) => {
  const trimmed = name.trim();
  return await tx
    .update(taxonomyTerm)
    .set({
      name: trimmed,
      normalizedName: normalize(trimmed),
      slug: slugify(trimmed),
      version: currentVersion + 1,
    })
    .where(eq(taxonomyTerm.id, termId))
    .returning({
      id: taxonomyTerm.publicId,
      label: taxonomyTerm.name,
      version: taxonomyTerm.version,
    });
};

export const changeTermKind = async (
  tx: Tx,
  termId: string,
  currentVersion: number,
  taxonomyKindId: string
) =>
  await tx
    .update(taxonomyTerm)
    .set({ taxonomyKindId, version: currentVersion + 1 })
    .where(eq(taxonomyTerm.id, termId))
    .returning({ id: taxonomyTerm.publicId, version: taxonomyTerm.version });
