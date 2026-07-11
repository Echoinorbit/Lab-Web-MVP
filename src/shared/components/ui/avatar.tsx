"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { cn } from "@/shared/lib/utils";

export const DEFAULT_AVATAR_PATH = "/avatar/default.png";

export function Avatar({
  src,
  name,
  size = 40,
  className,
  priority = false,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  const requestedSource = src || DEFAULT_AVATAR_PATH;
  const [resolvedSource, setResolvedSource] = useState(requestedSource);

  useEffect(() => setResolvedSource(requestedSource), [requestedSource]);

  return (
    <span
      className={cn("relative inline-flex shrink-0 overflow-hidden rounded-full bg-muted", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={resolvedSource}
        alt={`${name}的头像`}
        fill
        sizes={`${size}px`}
        className="object-cover"
        priority={priority}
        unoptimized
        onError={() => setResolvedSource(DEFAULT_AVATAR_PATH)}
      />
    </span>
  );
}
