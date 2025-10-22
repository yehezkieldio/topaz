import { parseArgs } from "node:util";
import { db } from "#/server/db";
import {
    type ProgressStatus,
    type Source,
    type StoryStatus,
    fandoms,
    libraryMaterializedView,
    libraryStatsMaterializedView,
    progresses,
    stories,
    storyFandoms,
    storyTags,
    tags,
    users,
} from "#/server/db/schema";

const { values } = parseArgs({
    options: {
        depopulate: {
            type: "boolean",
            short: "d",
            default: false,
        },
        populate: {
            type: "boolean",
            short: "p",
            default: false,
        },
    },
});

const SHUFFLE_RANDOM_OFFSET = 0.5;
const NSFW_PROBABILITY = 0.3;
const MIN_CHAPTERS = 1;
const MAX_CHAPTERS = 200;
const MIN_WORDS = 1000;
const MAX_WORDS = 500_000;
const MIN_FANDOMS_PER_STORY = 1;
const MAX_FANDOMS_PER_STORY = 3;
const MIN_TAGS_PER_STORY = 2;
const MAX_TAGS_PER_STORY = 8;
const TRACKED_STORIES_RATIO = 0.8;
const PAUSED_DROPPED_CHAPTER_RATIO = 0.7;
const MIN_RATING = 1;
const MAX_RATING = 5;
const RATING_DECIMAL_PRECISION = 1;
const NOTES_PROBABILITY = 0.3;

const SOURCES: Source[] = [
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
];

const STATUSES: StoryStatus[] = ["Ongoing", "Completed", "Hiatus", "Abandoned"];

const PROGRESS_STATUSES: ProgressStatus[] = ["NotStarted", "Reading", "Paused", "Completed", "Dropped"];

const FANDOMS = [
    "Harry Potter",
    "Naruto",
    "My Hero Academia",
    "Attack on Titan",
    "One Piece",
    "Dragon Ball",
    "Bleach",
    "Death Note",
    "Fullmetal Alchemist",
    "Code Geass",
    "Fairy Tail",
    "Tokyo Ghoul",
    "High School DxD",
    "Overlord",
    "Re:Zero",
    "Konosuba",
    "Sword Art Online",
    "One Punch Man",
    "Mob Psycho 100",
    "Demon Slayer",
    "Jujutsu Kaisen",
    "Chainsaw Man",
    "Marvel Comics",
    "DC Comics",
    "Star Wars",
    "Lord of the Rings",
    "Game of Thrones",
    "Percy Jackson",
    "Twilight",
    "The Hunger Games",
    "Supernatural",
    "Sherlock Holmes",
    "Pokemon",
    "Digimon",
    "Final Fantasy",
    "Kingdom Hearts",
    "The Legend of Zelda",
    "Mass Effect",
    "Dragon Age",
    "Elder Scrolls",
    "Witcher",
    "Worm",
    "Ward",
    "RWBY",
    "Avatar: The Last Airbender",
    "Teen Titans",
    "Young Justice",
    "X-Men",
    "Spider-Man",
    "Batman",
    "Superman",
];

const TAGS = [
    "Romance",
    "Adventure",
    "Action",
    "Drama",
    "Comedy",
    "Angst",
    "Hurt/Comfort",
    "Fluff",
    "Smut",
    "Dark",
    "AU",
    "Crossover",
    "Time Travel",
    "Fix-It",
    "Self-Insert",
    "OC",
    "Soulmates",
    "Enemies to Lovers",
    "Friends to Lovers",
    "Slow Burn",
    "Pining",
    "Unrequited Love",
    "Love Triangle",
    "Forbidden Love",
    "Arranged Marriage",
    "Fake Dating",
    "Bodyguard",
    "Royalty",
    "Mafia",
    "College/University",
    "High School",
    "Workplace",
    "Coffee Shop",
    "Bookstore",
    "Library",
    "Hospital",
    "Police",
    "Military",
    "Superhero",
    "Villain",
    "Anti-Hero",
    "Redemption",
    "Revenge",
    "Betrayal",
    "Sacrifice",
    "Death",
    "Resurrection",
    "Magic",
    "Fantasy",
    "Sci-Fi",
    "Dystopia",
    "Apocalypse",
    "Zombie",
    "Vampire",
    "Werewolf",
    "Dragon",
    "Angel",
    "Demon",
    "God",
    "Mythology",
    "Historical",
    "Modern",
    "Future",
    "Space",
    "Aliens",
    "Robot",
    "AI",
    "Virtual Reality",
    "Game",
    "Sport",
    "Music",
    "Art",
    "Dance",
    "Cooking",
    "Travel",
    "Road Trip",
    "Vacation",
    "Holiday",
    "Christmas",
    "Halloween",
    "Valentine's Day",
    "Wedding",
    "Pregnancy",
    "Kid Fic",
    "Family",
    "Friendship",
    "Team",
    "Mentor",
    "Student",
    "Teacher",
    "Boss",
    "Employee",
    "Neighbor",
    "Roommate",
    "Pen Pal",
    "Online",
    "Long Distance",
    "Reunion",
    "Second Chance",
    "Forgiveness",
    "Jealousy",
    "Misunderstanding",
    "Communication",
    "Trust",
    "Loyalty",
    "Honor",
    "Duty",
    "Justice",
    "Freedom",
    "Peace",
    "War",
    "Battle",
    "Tournament",
    "Competition",
    "Training",
    "Power",
    "Strength",
    "Weakness",
    "Fear",
    "Courage",
    "Hope",
    "Despair",
    "Loss",
    "Grief",
    "Healing",
    "Recovery",
    "Therapy",
    "Mental Health",
    "Disability",
    "Injury",
    "Illness",
    "Amnesia",
    "Identity",
    "Secret",
    "Mystery",
    "Detective",
    "Crime",
    "Murder",
    "Theft",
    "Kidnapping",
    "Rescue",
    "Escape",
    "Prison",
    "Trial",
    "Court",
    "Law",
    "Politics",
    "Government",
    "Rebellion",
    "Revolution",
    "Resistance",
    "Underground",
    "Spy",
    "Assassin",
    "Mercenary",
    "Bounty Hunter",
    "Pirate",
    "Thief",
    "Noble",
    "Peasant",
    "Slave",
    "Master",
    "Servant",
    "Knight",
    "Princess",
    "Prince",
    "King",
    "Queen",
    "Emperor",
    "Empress",
    "Duke",
    "Duchess",
    "Lord",
    "Lady",
    "Baron",
    "Count",
    "Earl",
    "Marquis",
    "Viscount",
    "Sir",
    "Dame",
];

const AUTHORS = [
    "AuthorOne",
    "WriterTwo",
    "StorytellerThree",
    "PenNameFour",
    "CreativeFive",
    "FictionSix",
    "NarratorSeven",
    "ScribeEight",
    "ChroniclerNine",
    "FantasyTen",
    "AdventurousEleven",
    "RomanceTwelve",
    "DramaThirteen",
    "ComedyFourteen",
    "ActionFifteen",
    "MysterySeventeen",
    "ThrillerEighteen",
    "HorrorNineteen",
    "SciFiTwenty",
    "FantasyTwentyOne",
    "HistoricalTwentyTwo",
    "ContemporaryTwentyThree",
    "YoungAdultTwentyFour",
    "MiddleGradeTwentyFive",
    "ChildrensTwentySix",
    "AdultTwentySeven",
    "NewAdultTwentyEight",
    "LiteraryTwentyNine",
    "CommercialThirty",
    "IndependentThirtyOne",
    "MainstreamThirtyTwo",
    "UndergroundThirtyThree",
    "AlternativeThirtyFour",
    "ExperimentalThirtyFive",
    "TraditionalThirtySix",
    "ModernThirtySeven",
    "PostmodernThirtyEight",
    "ClassicThirtyNine",
    "ContemporaryForty",
];

function randomChoice<T>(array: T[]): T {
    const item = array[Math.floor(Math.random() * array.length)];
    if (!item) throw new Error("Array is empty");
    return item;
}

function randomChoices<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => SHUFFLE_RANDOM_OFFSET - Math.random());
    return shuffled.slice(0, count);
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomStory(index: number) {
    const title = `Test Story ${index + 1}: ${randomChoice([
        "The Chronicles of",
        "The Legend of",
        "The Adventures of",
        "The Tales of",
        "The Journey of",
        "The Quest for",
        "The Search for",
        "The Battle for",
        "The War of",
        "The Rise of",
        "The Fall of",
        "The Return of",
        "The Revenge of",
        "The Secret of",
        "The Mystery of",
        "The Power of",
        "The Magic of",
        "The Curse of",
        "The Blessing of",
        "The Gift of",
    ])} ${randomChoice([
        "Destiny",
        "Eternity",
        "Infinity",
        "Harmony",
        "Balance",
        "Chaos",
        "Order",
        "Light",
        "Darkness",
        "Shadow",
        "Fire",
        "Ice",
        "Earth",
        "Wind",
        "Water",
        "Thunder",
        "Lightning",
        "Storm",
        "Rain",
        "Snow",
        "Sun",
        "Moon",
        "Stars",
        "Sky",
        "Heaven",
        "Hell",
        "Paradise",
        "Nightmare",
        "Dream",
        "Reality",
        "Fantasy",
        "Magic",
        "Power",
        "Strength",
        "Courage",
        "Honor",
        "Justice",
        "Freedom",
        "Peace",
        "War",
        "Love",
        "Hope",
        "Faith",
        "Truth",
        "Wisdom",
        "Knowledge",
        "Time",
        "Space",
        "Life",
        "Death",
        "Rebirth",
        "Renewal",
        "Awakening",
        "Enlightenment",
        "Transformation",
        "Evolution",
        "Revolution",
        "Change",
        "Growth",
        "Discovery",
        "Adventure",
        "Journey",
        "Quest",
        "Mission",
        "Purpose",
        "Destiny",
    ])}`;

    const author = randomChoice(AUTHORS);
    const source = randomChoice(SOURCES);
    const status = randomChoice(STATUSES);
    const isNsfw = Math.random() < NSFW_PROBABILITY;
    const chapterCount = randomInt(MIN_CHAPTERS, MAX_CHAPTERS);
    const wordCount = randomInt(MIN_WORDS, MAX_WORDS);
    const description = `This is a test story about ${title.toLowerCase()}. It contains various elements of ${randomChoice(TAGS).toLowerCase()} and ${randomChoice(TAGS).toLowerCase()}.`;
    const summary = `A brief summary of ${title}.`;

    return {
        title,
        author,
        source,
        status,
        is_nsfw: isNsfw,
        chapter_count: chapterCount,
        word_count: wordCount,
        description,
        summary,
        url: `https://example.com/story/${index + 1}`,
    };
}

async function depopulate(): Promise<void> {
    console.log("🗑️  Depopulating database (keeping users)...");

    await db.delete(progresses);
    console.log("   ✓ Deleted all progresses");

    await db.delete(storyTags);
    console.log("   ✓ Deleted all story tags");

    await db.delete(storyFandoms);
    console.log("   ✓ Deleted all story fandoms");

    await db.delete(stories);
    console.log("   ✓ Deleted all stories");

    await db.delete(tags);
    console.log("   ✓ Deleted all tags");

    await db.delete(fandoms);
    console.log("   ✓ Deleted all fandoms");

    await db.refreshMaterializedView(libraryMaterializedView);
    console.log("   ✓ Refreshed materialized view");

    console.log("✅ Database depopulated successfully!");
}

async function populate(): Promise<void> {
    console.log("📚 Populating database with dummy data...");

    const [firstUser] = await db.select().from(users).limit(1);
    if (!firstUser) {
        console.error("❌ No users found in the database. Please ensure at least one user exists.");
        process.exit(1);
    }
    console.log(`   ✓ Using user: ${firstUser.id}`);

    const fandomsToInsert = FANDOMS.map((name) => ({ name }));
    const insertedFandoms = await db.insert(fandoms).values(fandomsToInsert).returning();
    console.log(`   ✓ Inserted ${insertedFandoms.length} fandoms`);

    const tagsToInsert = TAGS.map((name) => ({ name }));
    const insertedTags = await db.insert(tags).values(tagsToInsert).returning();
    console.log(`   ✓ Inserted ${insertedTags.length} tags`);

    const storiesToInsert = Array.from({ length: 150 }, (_, i) => generateRandomStory(i));
    const insertedStories = await db.insert(stories).values(storiesToInsert).returning();
    console.log(`   ✓ Inserted ${insertedStories.length} stories`);

    const storyFandomsToInsert: (typeof storyFandoms.$inferInsert)[] = [];
    for (const story of insertedStories) {
        const fandomCount = randomInt(MIN_FANDOMS_PER_STORY, MAX_FANDOMS_PER_STORY);
        const selectedFandoms = randomChoices(insertedFandoms, fandomCount);

        for (const fandom of selectedFandoms) {
            storyFandomsToInsert.push({
                storyId: story.id,
                fandomId: fandom.id,
            });
        }
    }
    await db.insert(storyFandoms).values(storyFandomsToInsert);
    console.log(`   ✓ Created ${storyFandomsToInsert.length} story-fandom relationships`);

    const storyTagsToInsert: (typeof storyTags.$inferInsert)[] = [];
    for (const story of insertedStories) {
        const tagCount = randomInt(MIN_TAGS_PER_STORY, MAX_TAGS_PER_STORY);
        const selectedTags = randomChoices(insertedTags, tagCount);

        for (const tag of selectedTags) {
            storyTagsToInsert.push({
                storyId: story.id,
                tagId: tag.id,
            });
        }
    }
    await db.insert(storyTags).values(storyTagsToInsert);
    console.log(`   ✓ Created ${storyTagsToInsert.length} story-tag relationships`);

    const progressesToInsert: (typeof progresses.$inferInsert)[] = [];
    const storiesToTrack = randomChoices(insertedStories, Math.floor(insertedStories.length * TRACKED_STORIES_RATIO));

    for (const story of storiesToTrack) {
        const status = randomChoice(PROGRESS_STATUSES);
        const maxChapter = story.chapter_count ?? 1;

        let currentChapter = 0;
        if (status === "Reading") {
            currentChapter = randomInt(1, Math.max(1, maxChapter - 1));
        } else if (status === "Completed") {
            currentChapter = maxChapter;
        } else if (status === "Paused" || status === "Dropped") {
            currentChapter = randomInt(1, Math.max(1, Math.floor(maxChapter * PAUSED_DROPPED_CHAPTER_RATIO)));
        }

        const randomDecimalRating = (Math.random() * (MAX_RATING - MIN_RATING) + MIN_RATING).toFixed(
            RATING_DECIMAL_PRECISION,
        );

        progressesToInsert.push({
            userId: firstUser.id,
            storyId: story.id,
            status,
            current_chapter: currentChapter,
            rating: randomDecimalRating,
            notes: Math.random() < NOTES_PROBABILITY ? `Random note for ${story.title}` : null,
        });
    }
    await db.insert(progresses).values(progressesToInsert);
    console.log(`   ✓ Created ${progressesToInsert.length} progress entries`);

    await db.refreshMaterializedView(libraryMaterializedView).concurrently();
    await db.refreshMaterializedView(libraryStatsMaterializedView);
    console.log("   ✓ Refreshed materialized view");

    console.log("✅ Database populated successfully!");
}

async function main(): Promise<void> {
    try {
        if (values.depopulate && values.populate) {
            console.log("🔄 Running both depopulate and populate...");
            await depopulate();
            await populate();
        } else if (values.depopulate) {
            await depopulate();
        } else if (values.populate) {
            await populate();
        } else {
            console.log("ℹ️  Please specify either --depopulate or --populate flag:");
            console.log("   --depopulate (-d): Remove all data except users");
            console.log("   --populate (-p): Add dummy data (150+ stories)");
            console.log("   Both flags can be used together");
            process.exit(0);
        }

        console.log("\n🎉 Operation completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
