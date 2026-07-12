"use client";

import { ImagePlus, Move, ZoomIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type KeyboardEvent, type PointerEvent } from "react";

import { updateAvatarResult } from "@/features/profile/actions/update-avatar";
import { Avatar } from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { StatusNotice } from "@/shared/components/ui/status-notice";
import { useToast } from "@/shared/components/ui/toast";

const OUTPUT_SIZE = 512;
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type Offset = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function imageToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function AvatarEditor({ currentAvatar, displayName }: { currentAvatar: string | null; displayName: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; start: Offset } | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const getGeometry = useCallback((nextZoom = zoom) => {
    const image = imageRef.current;
    if (!image) return null;
    const scale = Math.max(OUTPUT_SIZE / image.naturalWidth, OUTPUT_SIZE / image.naturalHeight) * nextZoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    return {
      scale,
      width,
      height,
      maxX: Math.max(0, (width - OUTPUT_SIZE) / 2),
      maxY: Math.max(0, (height - OUTPUT_SIZE) / 2),
    };
  }, [zoom]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const geometry = getGeometry();
    if (!canvas || !image || !geometry) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;
    const safeOffset = {
      x: clamp(offset.x, -geometry.maxX, geometry.maxX),
      y: clamp(offset.y, -geometry.maxY, geometry.maxY),
    };
    context.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    context.drawImage(
      image,
      (OUTPUT_SIZE - geometry.width) / 2 + safeOffset.x,
      (OUTPUT_SIZE - geometry.height) / 2 + safeOffset.y,
      geometry.width,
      geometry.height,
    );
  }, [getGeometry, offset]);

  useEffect(() => draw(), [draw, sourceName, zoom]);
  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  function resetEditor() {
    imageRef.current = null;
    setSourceName(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setError(null);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setError("请选择 JPEG、PNG 或 WebP 图片。");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError("原始图片不能超过 10 MiB。");
      return;
    }
    imageRef.current = null;
    dragRef.current = null;
    setSourceName(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    const image = new Image();
    image.onload = () => {
      if (objectUrlRef.current !== url) return;
      imageRef.current = image;
      setSourceName(file.name);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    image.onerror = () => {
      if (objectUrlRef.current !== url) return;
      URL.revokeObjectURL(url);
      objectUrlRef.current = null;
      setError("图片无法解码，请更换文件后重试。");
    };
    image.src = url;
  }

  function updateZoom(value: number) {
    const geometry = getGeometry(value);
    setZoom(value);
    if (geometry) {
      setOffset((current) => ({
        x: clamp(current.x, -geometry.maxX, geometry.maxX),
        y: clamp(current.y, -geometry.maxY, geometry.maxY),
      }));
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!imageRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: offset };
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    const geometry = getGeometry();
    if (!drag || drag.pointerId !== event.pointerId || !geometry) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = OUTPUT_SIZE / rect.width;
    setOffset({
      x: clamp(drag.start.x + (event.clientX - drag.x) * ratio, -geometry.maxX, geometry.maxX),
      y: clamp(drag.start.y + (event.clientY - drag.y) * ratio, -geometry.maxY, geometry.maxY),
    });
  }

  function handlePointerEnd(event: PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function handleCropKeyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    const geometry = getGeometry();
    if (!geometry) return;
    const step = event.shiftKey ? 24 : 8;
    const deltas: Partial<Record<string, Offset>> = {
      ArrowLeft: { x: step, y: 0 },
      ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    };
    const delta = deltas[event.key];
    if (delta) {
      event.preventDefault();
      setOffset((current) => ({
        x: clamp(current.x + delta.x, -geometry.maxX, geometry.maxX),
        y: clamp(current.y + delta.y, -geometry.maxY, geometry.maxY),
      }));
    } else if (event.key === "Home") {
      event.preventDefault();
      setOffset({ x: 0, y: 0 });
      updateZoom(1);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      updateZoom(Math.min(3, zoom + 0.1));
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      updateZoom(Math.max(1, zoom - 0.1));
    }
  }

  function saveAvatar() {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;
    setError(null);
    startTransition(async () => {
      try {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((value) => value ? resolve(value) : reject(new Error("无法生成裁剪图片。")), "image/png");
        });
        const pngBase64 = await imageToBase64(blob);
        const result = await updateAvatarResult({ pngBase64 });
        if (!result.ok) {
          setError(result.message);
          toast({ title: "头像保存失败", description: result.message, variant: "error" });
          return;
        }
        toast({
          title: "头像已更新",
          description: result.data.cleanupPending
            ? "新头像已生效；旧文件清理未完成，后台任务会继续重试。"
            : "导航栏与个人资料已同步刷新。",
          variant: result.data.cleanupPending ? "info" : "success",
        });
        resetEditor();
        router.refresh();
      } catch {
        const message = "头像保存失败，请重试。";
        setError(message);
        toast({ title: "头像保存失败", description: message, variant: "error" });
      }
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[160px_minmax(0,1fr)]">
      <div className="flex flex-col items-center gap-3 lg:items-start">
        <Avatar src={currentAvatar} name={displayName} size={112} priority />
        <p className="text-center text-xs leading-5 text-muted-foreground lg:text-left">当前头像。未上传时使用平台默认头像。</p>
      </div>
      <div className="min-w-0 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="avatar-source">选择图片</Label>
          <Input
            ref={fileInputRef}
            id="avatar-source"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="h-auto cursor-pointer py-2.5 file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
            onChange={(event) => handleFile(event.target.files?.[0])}
            disabled={isPending}
          />
          <p className="text-xs leading-5 text-muted-foreground">支持 JPEG、PNG、WebP，原图最大 10 MiB；保存为 512 × 512 PNG。</p>
        </div>

        {sourceName ? (
          <div className="space-y-4">
            <div className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-2xl border border-border bg-muted shadow-inner">
              <canvas
                ref={canvasRef}
                width={OUTPUT_SIZE}
                height={OUTPUT_SIZE}
                className="h-full w-full touch-none cursor-grab object-cover active:cursor-grabbing"
                aria-label="头像裁剪预览，可拖动图片调整位置"
                tabIndex={0}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onKeyDown={handleCropKeyDown}
              />
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/25" />
            </div>
            <div className="mx-auto max-w-[420px] space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ZoomIn className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Label htmlFor="avatar-zoom">缩放</Label>
                <span className="ml-auto tabular-nums text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
              </div>
              <input
                id="avatar-zoom"
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(event) => updateZoom(Number(event.target.value))}
                className="h-11 w-full cursor-pointer accent-primary"
                disabled={isPending}
              />
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Move className="h-3.5 w-3.5" aria-hidden="true" />
                拖动或使用方向键调整位置，Shift + 方向键可加速。
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-5 text-center text-sm text-muted-foreground">
            <ImagePlus className="mb-3 h-6 w-6" aria-hidden="true" />
            选择图片后可拖动、缩放并预览 1:1 裁剪结果。
          </div>
        )}

        {error ? <StatusNotice variant="error">{error}</StatusNotice> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={saveAvatar} disabled={!sourceName || isPending}>
            {isPending ? "正在保存…" : "保存头像"}
          </Button>
          {sourceName ? <Button type="button" variant="secondary" onClick={resetEditor} disabled={isPending}>取消裁剪</Button> : null}
          {sourceName ? <Button type="button" variant="ghost" onClick={() => { setOffset({ x: 0, y: 0 }); updateZoom(1); }} disabled={isPending}>重置位置</Button> : null}
        </div>
      </div>
    </div>
  );
}
