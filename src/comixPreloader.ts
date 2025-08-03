import { Manga } from 'mangadex-full-api';

let comix: Manga[];

// fetches MangaDex comics that this bot supports, so that we don't have to fetch them everytime on request.
export const initComix = async (ids: string[]) => {
  comix = await Manga.getMultiple(ids);
};

export const retrieveComix = (comixId: string) => {
  return comix.find((comic) => comic.id === comixId);
};
