import type { ReactNode } from "react";

import { ViewportScale } from "@/shared/components/viewport-scale";

export default function EndfieldPreviewLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ViewportScale />
      {children}
    </>
  );
}
