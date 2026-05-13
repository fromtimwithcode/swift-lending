# Performance

Transition specificity and GPU compositing hints.

## Transition Only What Changes

Never use `transition: all` or Tailwind's `transition` shorthand. Always specify the exact properties that change.

```css
.button {
  transition-property: scale, background-color;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}
```

```tsx
<button className="transition-[scale,background-color] duration-150 ease-out">
```

Tailwind's `transition-transform` maps to `transform, translate, scale, rotate`, so use it when only transform-related properties change. For multiple non-transform properties, use bracket syntax such as `transition-[scale,opacity,filter]`.

## Use `will-change` Sparingly

`will-change` hints that the browser should pre-promote an element to its own compositing layer. Only add it when you notice first-frame stutter.

```css
.animated-card {
  will-change: transform;
}
```

Good candidates are `transform`, `opacity`, `filter`, and `clip-path`. Never use `will-change: all`, and do not add `will-change` for properties such as `background`, `border`, `color`, `top`, `left`, `width`, or `height`.
