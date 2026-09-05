import { describe, expect, it } from "vitest";

import { backlogScore, genreAffinity, isDropRisk, isStale } from "./heuristics";

describe("isStale", () => {
  const now = new Date("2026-01-30T00:00:00Z");

  it("is false with no observation on record", () => {
    expect(
      isStale({
        lastProgressAt: null,
        latestObservationAt: null,
        now,
        staleAfterDays: 14,
      })
    ).toBe(false);
  });

  it("is true when the source grew and progress has stalled past the threshold", () => {
    expect(
      isStale({
        lastProgressAt: new Date("2025-12-01T00:00:00Z"),
        latestObservationAt: new Date("2026-01-01T00:00:00Z"),
        now,
        staleAfterDays: 14,
      })
    ).toBe(true);
  });

  it("is false when progress is more recent than the source's last growth", () => {
    expect(
      isStale({
        lastProgressAt: new Date("2026-01-20T00:00:00Z"),
        latestObservationAt: new Date("2025-12-01T00:00:00Z"),
        now,
        staleAfterDays: 14,
      })
    ).toBe(false);
  });

  it("is false when the gap hasn't reached the threshold yet", () => {
    expect(
      isStale({
        lastProgressAt: new Date("2026-01-20T00:00:00Z"),
        latestObservationAt: new Date("2026-01-25T00:00:00Z"),
        now,
        staleAfterDays: 14,
      })
    ).toBe(false);
  });
});

describe("backlogScore", () => {
  it("scores highest for a favorite, top-rated, freshly-updated work", () => {
    expect(
      backlogScore({
        daysSinceUpdate: 0,
        favorite: true,
        freshnessHorizonDays: 30,
        rating: 5,
      })
    ).toBe(100);
  });

  it("scores lower for a non-favorite unrated stale work", () => {
    const score = backlogScore({
      daysSinceUpdate: 30,
      favorite: false,
      freshnessHorizonDays: 30,
      rating: null,
    });
    expect(score).toBe(0);
  });

  it("stays within 0-100", () => {
    const score = backlogScore({
      daysSinceUpdate: 5,
      favorite: true,
      freshnessHorizonDays: 30,
      rating: 3,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("genreAffinity", () => {
  it("aggregates average rating and completion rate per term", () => {
    const result = genreAffinity([
      { completed: true, rating: 5, taxonomyTermSlug: "angst" },
      { completed: false, rating: 3, taxonomyTermSlug: "angst" },
      { completed: true, rating: 4, taxonomyTermSlug: "fluff" },
    ]);

    const angst = result.find((row) => row.taxonomyTermSlug === "angst");
    expect(angst?.averageRating).toBe(4);
    expect(angst?.completionRate).toBe(0.5);
    expect(angst?.sampleSize).toBe(2);
  });

  it("sorts by average rating descending", () => {
    const result = genreAffinity([
      { completed: true, rating: 2, taxonomyTermSlug: "low" },
      { completed: true, rating: 5, taxonomyTermSlug: "high" },
    ]);

    expect(result.map((row) => row.taxonomyTermSlug)).toEqual(["high", "low"]);
  });

  it("treats unrated rows as excluded from the average, not zero", () => {
    const result = genreAffinity([
      { completed: true, rating: null, taxonomyTermSlug: "x" },
      { completed: true, rating: 4, taxonomyTermSlug: "x" },
    ]);

    expect(result[0]?.averageRating).toBe(4);
  });
});

describe("isDropRisk", () => {
  it("flags a paused, silent, low-rated entry", () => {
    expect(
      isDropRisk({ daysSinceLastEvent: 45, rating: 1, status: "paused" })
    ).toBe(true);
  });

  it("does not flag an active status", () => {
    expect(
      isDropRisk({ daysSinceLastEvent: 45, rating: 1, status: "reading" })
    ).toBe(false);
  });

  it("does not flag recent inactivity under the threshold", () => {
    expect(
      isDropRisk({ daysSinceLastEvent: 10, rating: 1, status: "paused" })
    ).toBe(false);
  });

  it("does not flag a highly-rated paused entry", () => {
    expect(
      isDropRisk({ daysSinceLastEvent: 45, rating: 5, status: "paused" })
    ).toBe(false);
  });

  it("flags a paused entry that was never rated", () => {
    expect(
      isDropRisk({ daysSinceLastEvent: 45, rating: null, status: "paused" })
    ).toBe(true);
  });
});
