require('dotenv').config();

const Discord = require('discord.js');
const {
    Mangadex
} = require('mangadex-api')

const client = new Discord.Client();
const mangadex = new Mangadex();

const preferredGroups = [{
        name: "Helvetica Scans",
        id: 27
    },
    {
        name: "Fire Syndicate",
        id: 4366
    },
    {
        name: "Kyuu Scans",
        id: 14385
    }
];

const preferredLanguages = ["en", "gb"];

const commands = [".k", ".kyuu", ".kyuute", ".kyuutechan"]

client.on('ready', async () => {
    try {
        mangaDexLogin();
    } catch (ex) {
        console.log(ex)
    }
});

client.on('message', async (msg) => {
    let [command, chapterCommand] = msg.content.split(" ");
    if (commands.includes(command.toLowerCase())) {
        // todo: retry logic for login. Seems like you don't need to auth atm, but if needed, implement retry function if getMangaChapters fails
        const {
            chapters
        } = await mangadex.manga.getMangaChapters(23279); // 23279 -> kyuu chan

        const chapterNumber = getChapterNumber(chapters, chapterCommand);
        if (!chapterNumber) {
            msg.channel.send("Usage: .k followed by a chapter number. No letters allowed!\n", {
                files: ["https://cdn.discordapp.com/emojis/659321777297817630.png?v=1"]
            });
            return;
        }

        const allMatchedChapters = chapters.filter(chapterInfo => chapterInfo.chapter === chapterNumber);
        if (allMatchedChapters.length === 0) {
            msg.channel.send("Kyuute Comic not found\n", {
                files: ["https://cdn.discordapp.com/emojis/674281264181805086.png?v=1"]
            });
            return;
        }

        const chapter = await getPreferredChapter(allMatchedChapters);
        for (const page of chapter.pages) {
            msg.channel.send(page);
        }
    }
});

const getChapterNumber = (chapters, chapterCommand) => {
    // .k => get latest chapter
    if (!chapterCommand) {
        return chapters[0].chapter;
    } else if (chapterCommand.toLowerCase().trim() === "r") {
        const randomInt = (min, max) => {
            return Math.floor(Math.random() * (max - min + 1) + min);
        }
        return randomInt(1, parseInt(chapters[0].chapter)).toString();
    } else if (!new RegExp('^[0-9]+$').test(chapterCommand)) {
        return null;
    }
    return chapterCommand;
}

const getPreferredChapter = async (chapters) => {
    let preferredGroupChapter = chapters.find(chapter => preferredGroups.find(group => group.id === chapter.groups[0])); // not sure why groups is an array here, just taking the first group

    // if we can't find a preferred group, find the first english group and use them
    if (!preferredGroupChapter) {
        preferredGroupChapter = chapters.find(chapter => preferredLanguages.includes(chapter.language.toLowerCase()));
    }

    return await mangadex.chapter.getChapter(preferredGroupChapter.id);
};

const mangaDexLogin = async () => {
    try {
        await mangadex.agent.login(process.env.mangadexUser, process.env.mangadexPassword);
    } catch (ex) {
        throw new Error(ex);
    }
}

const retryMangaDexLogin = async () => {

}

client.login(process.env.token);