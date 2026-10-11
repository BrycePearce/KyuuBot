import { readdir } from 'node:fs/promises';
import path from 'node:path';

/** Pick an existing Kyuu reaction image for user-facing command errors. */
export async function getRandomEmotePath(): Promise<string> {
  const directory = path.resolve(__dirname, '../../emotes');
  const entries = await readdir(directory, { withFileTypes: true });
  const images = entries.filter((entry) => entry.isFile() && /\.(png|jpe?g|gif|webp)$/i.test(entry.name));
  if (!images.length) throw new Error('No Kyuu reaction images are available.');
  return path.join(directory, images[Math.floor(Math.random() * images.length)].name);
}
