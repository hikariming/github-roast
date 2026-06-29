import { describe, expect, it } from "vitest";
import {
  applyReactionSelection,
  emptyReactionCounts,
  isProfileReaction,
  PROFILE_REACTIONS,
} from "../reactions";

describe("profile reactions", () => {
  it("accepts only the six supported reactions", () => {
    expect(PROFILE_REACTIONS).toEqual(["like", "poop", "kick", "fire", "salute", "clown"]);
    expect(PROFILE_REACTIONS.every(isProfileReaction)).toBe(true);
    expect(isProfileReaction("heart")).toBe(false);
    expect(isProfileReaction(null)).toBe(false);
  });

  it("creates zeroed counts for every supported reaction", () => {
    expect(emptyReactionCounts()).toEqual({
      like: 0,
      poop: 0,
      kick: 0,
      fire: 0,
      salute: 0,
      clown: 0,
    });
  });

  it("updates counts when selecting, switching, and removing a reaction", () => {
    const initial = { ...emptyReactionCounts(), like: 3, poop: 2 };

    const selected = applyReactionSelection(initial, null, "like");
    expect(selected).toMatchObject({ like: 4, poop: 2 });

    const switched = applyReactionSelection(selected, "like", "poop");
    expect(switched).toMatchObject({ like: 3, poop: 3 });

    const removed = applyReactionSelection(switched, "poop", null);
    expect(removed).toMatchObject({ like: 3, poop: 2 });
  });

  it("never decrements a reaction below zero", () => {
    expect(applyReactionSelection(emptyReactionCounts(), "like", null).like).toBe(0);
  });
});
