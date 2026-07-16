"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { normalizeTagName } from "@/lib/tag-utils";

interface TagSuggestResponse {
  tags: string[];
}

interface TagInputProps {
  name: string;
  defaultValue?: string[];
}

const DEBOUNCE_MS = 200;

export default function TagInput({ name, defaultValue }: TagInputProps) {
  const [tags, setTags] = useState<string[]>(() => defaultValue ?? []);
  const [query, setQuery] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    const requestId = ++requestIdRef.current;
    const timeoutId = setTimeout(() => {
      if (trimmed.length === 0) {
        setSuggestions([]);
        return;
      }
      fetch(`/api/tags?q=${encodeURIComponent(trimmed)}`)
        .then((response) => response.json() as Promise<TagSuggestResponse>)
        .then((data) => {
          if (requestId !== requestIdRef.current) return;
          setSuggestions(data.tags.filter((tag) => !tags.includes(tag)));
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setSuggestions([]);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [query, tags]);

  function addTag(raw: string): void {
    const normalized = normalizeTagName(raw);
    if (normalized.length === 0 || tags.includes(normalized)) return;
    setTags((current) => [...current, normalized]);
    setQuery("");
    setSuggestions([]);
  }

  function removeTag(tag: string): void {
    setTags((current) => current.filter((existing) => existing !== tag));
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    setQuery(event.target.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(query);
      return;
    }
    if (event.key === "Backspace" && query.length === 0 && tags.length > 0) {
      event.preventDefault();
      setTags((current) => current.slice(0, -1));
    }
  }

  return (
    <div className="w-full">
      <input type="hidden" name={name} value={tags.join(",")} />
      <div className="flex flex-wrap gap-2 rounded-md border border-border p-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm text-foreground"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Add a tag"
          className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none"
        />
      </div>
      {suggestions.length > 0 ? (
        <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-sm">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => addTag(suggestion)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
