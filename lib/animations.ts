import type { Variants } from "framer-motion";

export const premiumEase = [0.25, 0.46, 0.45, 0.94] as const;

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: premiumEase },
  },
};
