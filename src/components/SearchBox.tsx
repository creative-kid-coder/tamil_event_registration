'use client';

import { forwardRef } from 'react';
import { SearchIcon, XIcon } from './icons';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export const SearchBox = forwardRef<HTMLInputElement, Props>(function SearchBox({ value, onChange }, ref) {
  return (
    <div className="relative flex-1">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search name or mobile"
        aria-label="Search registrations"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="input h-14 rounded-2xl pr-12 pl-12 text-lg shadow-card [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
});
