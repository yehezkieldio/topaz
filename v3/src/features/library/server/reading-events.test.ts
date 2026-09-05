import { describe, expect, it } from "vitest";

import { toReadingEvent } from "./reading-events";

describe("toReadingEvent", () => {
  it("returns null when nothing changed (favorite)", () => {
    expect(
      toReadingEvent({
        from: { favorite: true, status: "reading" },
        kind: "favorite",
        to: { favorite: true, status: "reading" },
      })
    ).toBeNull();
  });

  it("maps a favorite toggle to a progressed event", () => {
    const plan = toReadingEvent({
      from: { favorite: false, status: "reading" },
      kind: "favorite",
      to: { favorite: true, status: "reading" },
    });

    expect(plan?.eventType).toBe("progressed");
    expect(plan?.fromSnapshot).toEqual({ favorite: false, status: "reading" });
    expect(plan?.toSnapshot).toEqual({ favorite: true, status: "reading" });
  });

  it("maps first transition into reading to started", () => {
    const plan = toReadingEvent({
      from: { status: "plan_to_read" },
      hasStartedBefore: false,
      kind: "status",
      to: { status: "reading" },
    });

    expect(plan?.eventType).toBe("started");
  });

  it("maps a repeat transition into reading to status_changed", () => {
    const plan = toReadingEvent({
      from: { status: "paused" },
      hasStartedBefore: true,
      kind: "status",
      to: { status: "reading" },
    });

    expect(plan?.eventType).toBe("status_changed");
  });

  it("maps completed status to a completed event", () => {
    const plan = toReadingEvent({
      from: { status: "reading" },
      hasStartedBefore: true,
      kind: "status",
      to: { status: "completed" },
    });

    expect(plan?.eventType).toBe("completed");
  });

  it("maps dropped and dropped_as_abandoned to a dropped event", () => {
    expect(
      toReadingEvent({
        from: { status: "reading" },
        hasStartedBefore: true,
        kind: "status",
        to: { status: "dropped" },
      })?.eventType
    ).toBe("dropped");

    expect(
      toReadingEvent({
        from: { status: "reading" },
        hasStartedBefore: true,
        kind: "status",
        to: { status: "dropped_as_abandoned" },
      })?.eventType
    ).toBe("dropped");
  });

  it("maps other status transitions to status_changed", () => {
    const plan = toReadingEvent({
      from: { status: "reading" },
      hasStartedBefore: true,
      kind: "status",
      to: { status: "paused" },
    });

    expect(plan?.eventType).toBe("status_changed");
  });

  it("returns null when status is unchanged", () => {
    expect(
      toReadingEvent({
        from: { status: "reading" },
        hasStartedBefore: true,
        kind: "status",
        to: { status: "reading" },
      })
    ).toBeNull();
  });

  it("maps a rating change to rating_changed", () => {
    const plan = toReadingEvent({
      from: { rating: null },
      kind: "rating",
      to: { rating: 5 },
    });

    expect(plan?.eventType).toBe("rating_changed");
    expect(plan?.fromSnapshot).toEqual({ rating: null });
    expect(plan?.toSnapshot).toEqual({ rating: 5 });
  });

  it("returns null when rating is unchanged", () => {
    expect(
      toReadingEvent({
        from: { rating: 4 },
        kind: "rating",
        to: { rating: 4 },
      })
    ).toBeNull();
  });

  it("maps a chapter progress change to a progressed event", () => {
    const plan = toReadingEvent({
      from: { currentChapter: 3 },
      kind: "progress",
      to: { currentChapter: 4 },
    });

    expect(plan?.eventType).toBe("progressed");
    expect(plan?.fromSnapshot).toEqual({ currentChapter: 3 });
    expect(plan?.toSnapshot).toEqual({ currentChapter: 4 });
  });

  it("returns null when chapter progress is unchanged", () => {
    expect(
      toReadingEvent({
        from: { currentChapter: 3 },
        kind: "progress",
        to: { currentChapter: 3 },
      })
    ).toBeNull();
  });
});
