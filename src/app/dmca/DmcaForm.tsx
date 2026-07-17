"use client";

import { useActionState } from "react";
import { submitDmcaAction, type DmcaActionResult } from "./actions";

const initialState: DmcaActionResult = { ok: false };

async function action(
  _previous: DmcaActionResult,
  formData: FormData,
): Promise<DmcaActionResult> {
  return submitDmcaAction(formData);
}

export default function DmcaForm() {
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (state.ok) {
    return (
      <p className="rounded border border-border bg-muted p-4 text-sm text-foreground">
        Your takedown notice has been submitted.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded border border-border p-4">
      <div className="space-y-1">
        <label htmlFor="photoUrl" className="block text-sm font-medium">
          Photo URL
        </label>
        <input
          id="photoUrl"
          name="photoUrl"
          type="text"
          required
          placeholder="https://con-share.example/c/some-con/p/abc123"
          className="w-full rounded border border-border p-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="complainantName" className="block text-sm font-medium">
          Your name
        </label>
        <input
          id="complainantName"
          name="complainantName"
          type="text"
          required
          className="w-full rounded border border-border p-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="contactEmail" className="block text-sm font-medium">
          Contact email
        </label>
        <input
          id="contactEmail"
          name="contactEmail"
          type="email"
          required
          className="w-full rounded border border-border p-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="claim" className="block text-sm font-medium">
          Describe your copyright claim
        </label>
        <textarea
          id="claim"
          name="claim"
          rows={5}
          required
          className="w-full rounded border border-border p-2 text-sm"
        />
      </div>
      <div className="flex items-start gap-2">
        <input
          id="agreed"
          name="agreed"
          type="checkbox"
          required
          className="mt-1"
        />
        <label htmlFor="agreed" className="text-sm">
          I have a good-faith belief that the use of this material is not
          authorized by the copyright owner, its agent, or the law, and this
          notice is accurate.
        </label>
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 active:bg-destructive/80 disabled:opacity-50"
      >
        {isPending ? "Submitting…" : "Submit takedown notice"}
      </button>
    </form>
  );
}
