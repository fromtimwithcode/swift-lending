# Surfaces

Border radius, optical alignment, shadows, image outlines, and hit areas.

## Concentric Border Radius

When nesting rounded elements, the outer radius must equal the inner radius plus the padding between them:

```text
outerRadius = innerRadius + padding
```

```tsx
<div className="rounded-2xl p-2">
  <div className="rounded-lg">...</div>
</div>
```

If padding is larger than `24px`, treat the layers as separate surfaces and choose each radius independently.

## Optical Alignment

When geometric centering looks off, align optically instead.

For buttons with text and an icon, use slightly less padding on the icon side. A reliable rule is `icon-side padding = text-side padding - 2px`.

```tsx
<button className="flex items-center gap-2 pl-4 pr-3.5">
  <span>Continue</span>
  <ArrowRightIcon />
</button>
```

Play icons are triangular and their geometric center is not their visual center. Shift them slightly right. For asymmetric icons, prefer fixing the SVG viewBox or path directly.

## Shadows Instead of Borders

For buttons, cards, and containers that use a border for depth or elevation, prefer a subtle `box-shadow`. Keep real borders for dividers, table boundaries, and form input outlines.

```css
:root {
  --shadow-border:
    0px 0px 0px 1px rgba(0, 0, 0, 0.06),
    0px 1px 2px -1px rgba(0, 0, 0, 0.06),
    0px 2px 4px 0px rgba(0, 0, 0, 0.04);
  --shadow-border-hover:
    0px 0px 0px 1px rgba(0, 0, 0, 0.08),
    0px 1px 2px -1px rgba(0, 0, 0, 0.08),
    0px 2px 4px 0px rgba(0, 0, 0, 0.06);
}
```

In dark mode, use a single white ring: `0 0 0 1px rgba(255, 255, 255, 0.08)`.

## Image Outlines

Add a subtle inset `1px` outline to images for consistent depth.

```tsx
<img
  className="outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
  src={src}
  alt={alt}
/>
```

Use pure black in light mode, `rgba(0, 0, 0, 0.1)`, and pure white in dark mode, `rgba(255, 255, 255, 0.1)`. Do not use tinted neutral palette colors.

## Minimum Hit Area

Interactive elements should have at least a `40x40px` hit area, ideally `44x44px`. If the visible element is smaller, extend the hit area with a pseudo-element, but never let hit areas of adjacent controls overlap.

```tsx
<button className="relative size-5 after:absolute after:left-1/2 after:top-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2">
  <CheckIcon />
</button>
```
