import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Progress/Reading Status Enum
 * Used to track the current reading status of a story in user's library
 */
export const progressStatusEnum = pgEnum("reading_status", [
    "NotStarted",
    "Reading",
    "Paused",
    "Completed",
    "Dropped",
    "PlanToRead",
    "DroppedAsAbandoned",
]);

export type ProgressStatus = (typeof progressStatusEnum.enumValues)[number];

export const progressStatusLabels: Record<ProgressStatus, string> = {
    NotStarted: "Not Started",
    Reading: "Reading",
    Paused: "Paused",
    Completed: "Completed",
    Dropped: "Dropped",
    PlanToRead: "PlanToRead",
    DroppedAsAbandoned: "Dropped as Abandoned",
};

/**
 * Story Source Enum
 * Represents the platform/website where the story is hosted
 */
export const sourceEnum = pgEnum("source", [
    "ArchiveOfOurOwn",
    "FanFictionNet",
    "Wattpad",
    "SpaceBattles",
    "SufficientVelocity",
    "QuestionableQuesting",
    "RoyalRoad",
    "WebNovel",
    "ScribbleHub",
    "NovelBin",
    "Other",
]);

export type Source = (typeof sourceEnum.enumValues)[number];

export const sourceLabels = {
    ArchiveOfOurOwn: "Archive of Our Own",
    Wattpad: "Wattpad",
    SpaceBattles: "SpaceBattles",
    SufficientVelocity: "Sufficient Velocity",
    QuestionableQuesting: "Questionable Questing",
    FanFictionNet: "FanFiction.Net",
    RoyalRoad: "Royal Road",
    WebNovel: "WebNovel",
    ScribbleHub: "ScribbleHub",
    NovelBin: "NovelBin",
    Other: "Other",
} satisfies Record<Source, string>;

export const sourceShortLabels = {
    ArchiveOfOurOwn: "AO3",
    Wattpad: "Wattpad",
    SpaceBattles: "SB",
    SufficientVelocity: "SV",
    QuestionableQuesting: "QQ",
    FanFictionNet: "FFN",
    RoyalRoad: "RR",
    WebNovel: "WN",
    ScribbleHub: "SH",
    NovelBin: "NB",
    Other: "Other",
} satisfies Record<Source, string>;

/**
 * Story Status Enum
 * Represents the publication/completion status of a story
 */
export const storyStatusEnum = pgEnum("story_status", ["Ongoing", "Completed", "Hiatus", "Abandoned", "Unknown"]);

export type StoryStatus = (typeof storyStatusEnum.enumValues)[number];

export const storyStatusLabels = {
    Ongoing: "Ongoing",
    Completed: "Completed",
    Hiatus: "Hiatus",
    Abandoned: "Abandoned",
    Unknown: "Unknown",
} satisfies Record<StoryStatus, string>;
