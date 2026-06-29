export const PROFILE_REACTIONS = [
  "like",
  "poop",
  "kick",
  "fire",
  "salute",
  "clown",
] as const;

export type ProfileReaction = (typeof PROFILE_REACTIONS)[number];
export type ProfileReactionCounts = Record<ProfileReaction, number>;

export interface ProfileReactionState {
  counts: ProfileReactionCounts;
  viewerReaction: ProfileReaction | null;
}

export function isProfileReaction(value: unknown): value is ProfileReaction {
  return typeof value === "string" && PROFILE_REACTIONS.includes(value as ProfileReaction);
}

export function emptyReactionCounts(): ProfileReactionCounts {
  return {
    like: 0,
    poop: 0,
    kick: 0,
    fire: 0,
    salute: 0,
    clown: 0,
  };
}

export function applyReactionSelection(
  counts: ProfileReactionCounts,
  previous: ProfileReaction | null,
  next: ProfileReaction | null,
): ProfileReactionCounts {
  const updated = { ...counts };
  if (previous && previous !== next) {
    updated[previous] = Math.max(0, updated[previous] - 1);
  }
  if (next && next !== previous) {
    updated[next] += 1;
  }
  return updated;
}
