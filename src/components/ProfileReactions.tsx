"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  applyReactionSelection,
  PROFILE_REACTIONS,
  type ProfileReaction,
  type ProfileReactionState,
} from "@/lib/reactions";

const REACTION_EMOJI: Record<ProfileReaction, string> = {
  like: "👍",
  poop: "💩",
  kick: "🦶",
  fire: "🔥",
  salute: "🫡",
  clown: "🤡",
};

export function ProfileReactions({
  authenticated,
  authAvailable,
  initialState,
  profileUsername,
  signInAction,
}: {
  authenticated: boolean;
  authAvailable: boolean;
  initialState: ProfileReactionState;
  profileUsername: string;
  signInAction: () => Promise<void>;
}) {
  const t = useTranslations("reactions");
  const [state, setState] = useState(initialState);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [animated, setAnimated] = useState<ProfileReaction | null>(null);

  async function react(reaction: ProfileReaction) {
    if (!authenticated) {
      setShowLogin(true);
      setFailed(false);
      return;
    }
    if (saving) return;

    const previousState = state;
    const nextReaction = state.viewerReaction === reaction ? null : reaction;
    setState({
      counts: applyReactionSelection(state.counts, state.viewerReaction, nextReaction),
      viewerReaction: nextReaction,
    });
    setSaving(true);
    setFailed(false);
    setAnimated(reaction);

    try {
      const response = await fetch(
        `/api/profile-reactions/${encodeURIComponent(profileUsername)}`,
        {
          method: nextReaction ? "PUT" : "DELETE",
          headers: nextReaction ? { "Content-Type": "application/json" } : undefined,
          body: nextReaction ? JSON.stringify({ reaction: nextReaction }) : undefined,
        },
      );
      if (response.status === 401) {
        setShowLogin(true);
        throw new Error("authentication_required");
      }
      if (!response.ok) throw new Error("reaction_failed");
      setState((await response.json()) as ProfileReactionState);
    } catch (error) {
      setState(previousState);
      setFailed(
        !(error instanceof Error && error.message === "authentication_required"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-orange-300/15 bg-orange-500/[0.035] p-3 sm:p-4">
      <div className="mb-3 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h2 className="text-sm font-bold text-orange-100">{t("heading")}</h2>
        <p className="text-[11px] text-zinc-500">{t("hint")}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {PROFILE_REACTIONS.map((reaction) => {
          const selected = state.viewerReaction === reaction;
          const count = state.counts[reaction];
          return (
            <button
              key={reaction}
              type="button"
              aria-label={`${t(reaction)}: ${count}`}
              aria-pressed={selected}
              disabled={saving}
              onClick={() => react(reaction)}
              onAnimationEnd={() => {
                if (animated === reaction) setAnimated(null);
              }}
              className={`profile-reaction-button flex min-h-16 flex-col items-center justify-center rounded-xl border px-2 py-2 transition-colors disabled:cursor-wait ${
                selected
                  ? "border-orange-400/60 bg-orange-500/15 text-orange-100 shadow-[0_0_24px_rgba(249,115,22,0.12)]"
                  : "border-white/10 bg-black/20 text-zinc-300 hover:border-orange-300/30 hover:bg-orange-500/[0.07]"
              } ${animated === reaction ? "profile-reaction-bump" : ""}`}
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                {REACTION_EMOJI[reaction]}
              </span>
              <span className="mt-1 text-[11px] font-medium leading-none">{t(reaction)}</span>
              <span className="mt-1 text-xs font-bold tabular-nums text-zinc-400">{count}</span>
            </button>
          );
        })}
      </div>

      {showLogin && !authenticated ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-300/15 bg-black/25 px-3 py-2">
          <p role="status" className="text-xs text-orange-100/80">
            {t("loginRequired")}
          </p>
          {authAvailable ? (
            <form action={signInAction}>
              <button
                type="submit"
                className="rounded-full bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-500"
              >
                {t("loginAction")}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {failed ? (
        <p role="alert" className="mt-3 text-xs text-red-300/80">
          {t("failed")}
        </p>
      ) : null}
    </section>
  );
}
