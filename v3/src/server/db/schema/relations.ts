import { relations } from "drizzle-orm";

import { account, session, user } from "./auth";
import {
  contributor,
  sourcePlatform,
  work,
  workContributor,
  workSource,
} from "./catalog";
import { libraryEntry, readingEvent, readingState } from "./library";
import {
  taxonomyKind,
  taxonomyLabel,
  taxonomyRelation,
  taxonomyTerm,
  workTaxonomyAssignment,
  workTaxonomyEffective,
} from "./taxonomy";

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  libraryEntries: many(libraryEntry),
  sessions: many(session),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const workRelations = relations(work, ({ many }) => ({
  contributors: many(workContributor),
  effectiveTaxonomy: many(workTaxonomyEffective),
  libraryEntries: many(libraryEntry),
  sources: many(workSource),
  taxonomyAssignments: many(workTaxonomyAssignment),
}));

export const workSourceRelations = relations(workSource, ({ one }) => ({
  sourcePlatform: one(sourcePlatform, {
    fields: [workSource.sourcePlatformId],
    references: [sourcePlatform.id],
  }),
  work: one(work, {
    fields: [workSource.workId],
    references: [work.id],
  }),
}));

export const sourcePlatformRelations = relations(
  sourcePlatform,
  ({ many }) => ({
    workSources: many(workSource),
  })
);

export const contributorRelations = relations(contributor, ({ many }) => ({
  works: many(workContributor),
}));

export const workContributorRelations = relations(
  workContributor,
  ({ one }) => ({
    contributor: one(contributor, {
      fields: [workContributor.contributorId],
      references: [contributor.id],
    }),
    work: one(work, {
      fields: [workContributor.workId],
      references: [work.id],
    }),
  })
);

export const taxonomyKindRelations = relations(taxonomyKind, ({ many }) => ({
  terms: many(taxonomyTerm),
}));

export const taxonomyTermRelations = relations(
  taxonomyTerm,
  ({ one, many }) => ({
    labels: many(taxonomyLabel),
    mergedInto: one(taxonomyTerm, {
      fields: [taxonomyTerm.mergedIntoId],
      references: [taxonomyTerm.id],
      relationName: "taxonomy_term_merged_into",
    }),
    relationsFrom: many(taxonomyRelation, {
      relationName: "taxonomy_relation_from",
    }),
    relationsTo: many(taxonomyRelation, {
      relationName: "taxonomy_relation_to",
    }),
    taxonomyKind: one(taxonomyKind, {
      fields: [taxonomyTerm.taxonomyKindId],
      references: [taxonomyKind.id],
    }),
    workAssignments: many(workTaxonomyAssignment),
    workEffective: many(workTaxonomyEffective),
  })
);

export const taxonomyLabelRelations = relations(taxonomyLabel, ({ one }) => ({
  taxonomyTerm: one(taxonomyTerm, {
    fields: [taxonomyLabel.taxonomyTermId],
    references: [taxonomyTerm.id],
  }),
}));

export const taxonomyRelationRelations = relations(
  taxonomyRelation,
  ({ one }) => ({
    fromTerm: one(taxonomyTerm, {
      fields: [taxonomyRelation.fromTermId],
      references: [taxonomyTerm.id],
      relationName: "taxonomy_relation_from",
    }),
    toTerm: one(taxonomyTerm, {
      fields: [taxonomyRelation.toTermId],
      references: [taxonomyTerm.id],
      relationName: "taxonomy_relation_to",
    }),
  })
);

export const workTaxonomyAssignmentRelations = relations(
  workTaxonomyAssignment,
  ({ one }) => ({
    taxonomyTerm: one(taxonomyTerm, {
      fields: [workTaxonomyAssignment.taxonomyTermId],
      references: [taxonomyTerm.id],
    }),
    work: one(work, {
      fields: [workTaxonomyAssignment.workId],
      references: [work.id],
    }),
  })
);

export const workTaxonomyEffectiveRelations = relations(
  workTaxonomyEffective,
  ({ one }) => ({
    taxonomyTerm: one(taxonomyTerm, {
      fields: [workTaxonomyEffective.taxonomyTermId],
      references: [taxonomyTerm.id],
    }),
    work: one(work, {
      fields: [workTaxonomyEffective.workId],
      references: [work.id],
    }),
  })
);

export const libraryEntryRelations = relations(
  libraryEntry,
  ({ one, many }) => ({
    readingEvents: many(readingEvent),
    readingState: one(readingState, {
      fields: [libraryEntry.id],
      references: [readingState.libraryEntryId],
    }),
    user: one(user, {
      fields: [libraryEntry.userId],
      references: [user.id],
    }),
    work: one(work, {
      fields: [libraryEntry.workId],
      references: [work.id],
    }),
  })
);

export const readingStateRelations = relations(readingState, ({ one }) => ({
  libraryEntry: one(libraryEntry, {
    fields: [readingState.libraryEntryId],
    references: [libraryEntry.id],
  }),
}));

export const readingEventRelations = relations(readingEvent, ({ one }) => ({
  libraryEntry: one(libraryEntry, {
    fields: [readingEvent.libraryEntryId],
    references: [libraryEntry.id],
  }),
}));
