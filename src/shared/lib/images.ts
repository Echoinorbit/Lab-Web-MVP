/** Site images owned by the application shell. */
export const images = {
  brandMark: "/brand-mark.jpg",
  loginBackdrop: "/images/kv_v1d4.d0e55f7f.jpg",
  dashboardHero: "/assets/lab-collaboration-workbench.png",
  avatarFallback: "/assets/yukina.jpeg",
} as const;

export type ImageKey = keyof typeof images;
