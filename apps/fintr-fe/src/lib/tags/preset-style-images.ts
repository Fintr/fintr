export type TagStylePreset = {
  key: string;
  label: string;
  src: string;
};

export const TAG_STYLE_PRESETS: TagStylePreset[] = [
  { key: "japan-vacation", label: "Japan vacation" },
  { key: "europe-vacation", label: "Vacation" },
  { key: "beach-vacation", label: "Beach vacation" },
  { key: "road-trip", label: "Road trip" },
  { key: "wedding", label: "Wedding" },
  { key: "new-baby", label: "New baby" },
  { key: "home-renovation", label: "Home renovation" },
  { key: "moving", label: "Moving" },
  { key: "pet", label: "Pet" },
  { key: "car", label: "Car" },
  { key: "medical", label: "Health" },
  { key: "education", label: "Education" },
  { key: "business-trip", label: "Business trip" },
  { key: "holidays", label: "Holidays" },
  { key: "birthday", label: "Birthday" },
  { key: "side-hustle", label: "Side hustle" },
  { key: "fitness", label: "Fitness" },
  { key: "concert", label: "Concert" },
  { key: "family", label: "Family" },
  { key: "new-home", label: "New home" },
].map((preset) => ({
  ...preset,
  src: `/tags/${preset.key}.png`,
}));

export const TAG_STYLE_PRESET_KEYS = TAG_STYLE_PRESETS.map(
  (preset) => preset.key,
);

export const tagStylePresetSrc = (key: string): string => `/tags/${key}.png`;

export const isTagStylePresetKey = (key: string): boolean =>
  TAG_STYLE_PRESET_KEYS.includes(key);

export const resolveTagStyleImageUrl = (tag: {
  styleImageUrl?: string;
  stylePresetKey?: string;
}): string | undefined => {
  if (tag.styleImageUrl) {
    return tag.styleImageUrl;
  }

  if (tag.stylePresetKey && isTagStylePresetKey(tag.stylePresetKey)) {
    return tagStylePresetSrc(tag.stylePresetKey);
  }

  return undefined;
};
