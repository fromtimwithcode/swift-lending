# Typography

Typography rendering details that make interfaces feel better.

## Text Wrapping

### text-wrap: balance

Distributes text evenly across lines, preventing orphaned words on headings and short text blocks. Only works on blocks of 6 lines or fewer in Chromium or 10 lines or fewer in Firefox, so use it for short text.

```css
h1,
h2,
h3 {
  text-wrap: balance;
}
```

Tailwind: `text-balance`.

### text-wrap: pretty

Prevents orphaned words by adjusting line breaks throughout the paragraph. Use it for short-to-medium paragraphs, descriptions, captions, list items, card text, and similar UI copy.

```tsx
<p className="text-pretty">
  A short paragraph that won't leave an orphan on the last line.
</p>
```

Tailwind: `text-pretty`.

### When to Use Which

| Scenario | Use |
| --- | --- |
| Headings and titles where even distribution matters | `text-wrap: balance` |
| Short-to-medium text, descriptions, captions, UI text | `text-wrap: pretty` |
| Long text, code blocks, pre-formatted text | Neither |

## Font Smoothing

On macOS, text renders heavier than intended by default. Apply antialiased smoothing to the root layout so all text renders crisper and thinner.

```css
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

```tsx
<html className="antialiased">
```

Apply this once at the root, not per element.

## Tabular Numbers

When numbers update dynamically, use `tabular-nums` so all digits have equal width. This prevents layout shift as values change.

```tsx
<span className="tabular-nums">{count}</span>
```

Use it for counters, timers, prices that update, table columns with numbers, animated number transitions, scoreboards, and dashboards. Avoid it for static decorative numbers, phone numbers, zip codes, and version numbers.
