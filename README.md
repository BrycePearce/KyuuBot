<p align="center">
  <img src="https://github.com/BrycePearce/KyuuBot/assets/16729071/7ffa2778-14ba-424a-bbca-8fee471d5cde" />
</p>

# KyuuBot

This is a multi use Discord bot that hosts trivia, rolls dice for dnd night, prints comics on demand & more!

## Run it locally

First, after pulling you'll need a whole suite of env keys that you'll need to add to a .env in the root directory.

```bash
token=[discordToken]
mangadexUser=[mangadexUsername]
mangadexPassword=[mangadexPassword]
defaultPrefix=.
cache=./bin/.md_cache
./src/tmp
googleGeoToken=[googleMapsToken]
openWeatherKey=[openWeatherMapKey]
gptImageGen=[chatgptKey]
stableDiffusion=[stableDiffusionKey]
gptChatCompletion=[chatgptKey]
```

Then, run the development server:

```bash
npm install
# or
yarn install
```

Finally run the bot with:

```bash
npm run start
```
