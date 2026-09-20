export function AnvilMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 9h6c0-2.2 1.8-4 4-4s4 1.8 4 4h4.5c.8 0 1.5.7 1.5 1.5S26.3 12 25.5 12H6.5C5.7 12 5 11.3 5 10.5S5.7 9 6.5 9H7zm1 5h16v2.2c0 .5-.3 1-.8 1.2L20 19.2V26c0 .6-.4 1-1 1h-6c-.6 0-1-.4-1-1v-6.8l-3.2-1.8c-.5-.2-.8-.7-.8-1.2V14z"
      />
    </svg>
  );
}
