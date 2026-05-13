# Animations

Interruptible animations, enter and exit transitions, contextual icon animations, and press feedback.

## Interruptible Animations

Users change intent mid-interaction. If animations are not interruptible, the interface feels broken.

Prefer CSS transitions for interactive state changes because they interpolate toward the latest state and retarget mid-animation. Reserve keyframes for staged sequences that run once.

```css
.drawer {
  transform: translateX(-100%);
  transition: transform 200ms ease-out;
}

.drawer.open {
  transform: translateX(0);
}
```

## Enter Animations

Do not animate a single large container. Split content into semantic chunks and stagger each item by about `100ms`.

Combine `opacity`, `blur`, and `translateY` for the enter effect.

```tsx
<motion.div
  initial="hidden"
  animate="visible"
  variants={{
    visible: { transition: { staggerChildren: 0.1 } },
  }}
>
  <motion.h1 variants={itemVariants}>Welcome</motion.h1>
  <motion.p variants={itemVariants}>A description of the page.</motion.p>
  <motion.div variants={itemVariants}>
    <Button>Get started</Button>
  </motion.div>
</motion.div>
```

```tsx
const itemVariants = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};
```

## Exit Animations

Exit animations should be softer and less attention-grabbing than enter animations.

```tsx
<motion.div
  exit={{
    opacity: 0,
    y: -12,
    filter: "blur(4px)",
    transition: { duration: 0.15, ease: "easeIn" },
  }}
>
  {content}
</motion.div>
```

Use a small fixed `translateY` such as `-12px`, keep directional movement, and make exit duration shorter than enter duration.

## Contextual Icon Animations

When icons appear or disappear contextually, animate them with `opacity`, `scale`, and `blur` instead of toggling visibility.

Use exactly these values:

| Property | From | To |
| --- | --- | --- |
| `scale` | `0.25` | `1` |
| `opacity` | `0` | `1` |
| `filter` | `blur(4px)` | `blur(0px)` |

If the project has `motion` or `framer-motion`, use this transition: `{ type: "spring", duration: 0.3, bounce: 0 }`.

```tsx
<AnimatePresence initial={false} mode="popLayout">
  <motion.span
    key={isActive ? "active" : "inactive"}
    initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
    exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
    transition={{ type: "spring", duration: 0.3, bounce: 0 }}
  >
    <Icon />
  </motion.span>
</AnimatePresence>
```

If no motion library is installed, keep both icons in the DOM and cross-fade them with CSS transitions. Do not add a dependency just for icon transitions.

## Scale on Press

A subtle scale-down on click gives buttons tactile feedback. Always use `scale(0.96)`. Never use a value smaller than `0.95`.

```tsx
<button className="transition-transform duration-150 ease-out active:scale-[0.96]">
  Click me
</button>
```

Add a `static` prop to a reusable button component when the scale effect should be disabled.

## Skip Animation on Page Load

Use `initial={false}` on `AnimatePresence` to prevent default-state elements from animating on first render. This works well for icon swaps, toggles, tabs, and segmented controls.

Do not use `initial={false}` when a component relies on first-time enter animation, such as a staggered page hero.
