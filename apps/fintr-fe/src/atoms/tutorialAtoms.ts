import { atom } from 'jotai';

export const isTutorialActiveAtom = atom<boolean>(false);
export const desktopTutorialCompletedAtom = atom<string | null>(null);
export const mobileTutorialCompletedAtom = atom<string | null>(null);
export const tutorialDataLoadedAtom = atom<boolean>(false);

