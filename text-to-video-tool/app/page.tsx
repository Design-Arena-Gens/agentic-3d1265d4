"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StylePreset = {
  id: string;
  name: string;
  description: string;
  baseHue: number;
  hueCycle: number;
  overlayStrength: number;
};

const STYLE_PRESETS: StylePreset[] = [
  {
    id: "aurora",
    name: "Aurora Lights",
    description: "Cool blues with luminous waves and light flares.",
    baseHue: 210,
    hueCycle: 90,
    overlayStrength: 0.22,
  },
  {
    id: "sunset",
    name: "Golden Hour",
    description: "Warm cinematic gradient with glowing highlights.",
    baseHue: 28,
    hueCycle: 45,
    overlayStrength: 0.27,
  },
  {
    id: "forest",
    name: "Emerald Forest",
    description: "Deep greens with emerald light rays and depth.",
    baseHue: 140,
    hueCycle: 60,
    overlayStrength: 0.25,
  },
];

const DEFAULT_SCRIPT = `Welcome to the future of text-to-video.
Every word comes to life with cinematic motion.
Craft captivating stories in seconds.`;

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const pickSupportedMimeType = () => {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return null;
  }

  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];

  return candidates.find((candidate) =>
    MediaRecorder.isTypeSupported(candidate),
  );
};

const wrapScriptIntoLines = (script: string) => {
  const normalized = script
    .split(/\r?\n/)
    .flatMap((line) =>
      line
        .trim()
        .split(/(?<=[.!?])\s+/)
        .map((part) => part.trim()),
    )
    .filter(Boolean);

  const lines: string[] = [];

  normalized.forEach((entry) => {
    if (entry.length <= 42) {
      lines.push(entry);
      return;
    }

    const words = entry.split(/\s+/);
    let current = "";

    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;

      if (candidate.length > 42) {
        if (current) {
          lines.push(current);
        }
        current = word;
      } else {
        current = candidate;
      }
    });

    if (current) {
      lines.push(current);
    }
  });

  return lines.length > 0 ? lines : ["Your story starts here."];
};

const drawVisualFrame = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  lines: string[],
  style: StylePreset,
) => {
  const huePrimary = (style.baseHue + progress * style.hueCycle) % 360;
  const hueSecondary = (huePrimary + style.hueCycle * 0.6) % 360;

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `hsl(${huePrimary} 78% 58%)`);
  gradient.addColorStop(1, `hsl(${hueSecondary} 72% 32%)`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const waveStrength = Math.sin(progress * Math.PI * 2);
  ctx.fillStyle = `hsla(${(huePrimary + 24) % 360}, 90%, 68%, ${
    style.overlayStrength
  })`;
  ctx.beginPath();
  ctx.ellipse(
    width * 0.45,
    height * 0.42,
    width * (0.8 + waveStrength * 0.05),
    height * (0.55 + waveStrength * 0.04),
    progress * Math.PI,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.save();
  const radialGlow = ctx.createRadialGradient(
    width * 0.52,
    height * (0.28 + waveStrength * 0.02),
    width * 0.08,
    width * 0.5,
    height * 0.5,
    width * 0.7,
  );
  radialGlow.addColorStop(0, "rgba(255, 255, 255, 0.28)");
  radialGlow.addColorStop(0.55, "rgba(255, 255, 255, 0.08)");
  radialGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = radialGlow;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const trailCount = 12;
  for (let index = 0; index < trailCount; index += 1) {
    const localProgress = clamp(progress - index * 0.015, 0, 1);
    const opacity = 0.06 * (1 - index / trailCount);
    ctx.strokeStyle = `hsla(${(hueSecondary + 12) % 360}, 80%, 60%, ${opacity})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.1, height * (0.65 + localProgress * 0.05));
    ctx.bezierCurveTo(
      width * 0.3,
      height * (0.45 + waveStrength * 0.05),
      width * 0.7,
      height * (0.75 - waveStrength * 0.04),
      width * 0.9,
      height * (0.62 + localProgress * 0.03),
    );
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(15, 23, 42, 0.16)";
  ctx.fillRect(0, height * 0.78, width, height * 0.22);

  const fontSize = Math.round(height * 0.09);
  const lineHeight = Math.round(fontSize * 1.18);
  const centerY = height * 0.48;
  const startY = centerY - ((lines.length - 1) / 2) * lineHeight;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";

  lines.forEach((line, index) => {
    const segmentStart = index / lines.length;
    const segmentEnd = (index + 1) / lines.length;
    const segmentProgress = clamp(
      (progress - segmentStart) / Math.max(segmentEnd - segmentStart, 0.0001),
    );
    const eased = easeInOutCubic(segmentProgress);
    const y = startY + index * lineHeight;

    ctx.save();
    ctx.globalAlpha = eased;
    const scale = 1 + Math.sin(progress * Math.PI * 2 + index) * 0.015;
    ctx.translate(width / 2, y);
    ctx.scale(scale, scale);
    ctx.shadowColor = "rgba(15, 23, 42, 0.45)";
    ctx.shadowBlur = 48;
    ctx.font = `600 ${fontSize}px "Inter", "Segoe UI", sans-serif`;
    ctx.fillText(line, 0, 0);
    ctx.restore();
  });

  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  const progressWidth = width * 0.6;
  const progressHeight = 10;
  const progressX = (width - progressWidth) / 2;
  const progressY = height * 0.84;
  ctx.fillRect(progressX, progressY, progressWidth, progressHeight);

  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.fillRect(progressX, progressY, progressWidth * progress, progressHeight);
  ctx.restore();
};

export default function Home() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [durationSeconds, setDurationSeconds] = useState(8);
  const [styleId, setStyleId] = useState<string>(STYLE_PRESETS[0]?.id ?? "aurora");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<"idle" | "recording" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preparedLines = useMemo(() => wrapScriptIntoLines(script), [script]);
  const selectedStyle =
    useMemo(
      () => STYLE_PRESETS.find((preset) => preset.id === styleId) ?? STYLE_PRESETS[0],
      [styleId],
    ) ?? STYLE_PRESETS[0];

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const generateVideo = useCallback(async () => {
    if (isGenerating) {
      return;
    }

    const canvas = canvasRef.current;
    const mimeType = pickSupportedMimeType();

    if (!canvas) {
      setError("Canvas is not ready. Please reload and try again.");
      return;
    }

    if (!mimeType) {
      setError(
        "This browser does not support the required WebM video codecs. Try Chrome or Edge.",
      );
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      setError("Unable to access the canvas drawing context.");
      return;
    }

    const fps = 30;
    const width = 1280;
    const height = 720;

    canvas.width = width;
    canvas.height = height;

    const previousUrl = videoUrl;
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
    }

    let animationFrame = 0;
    let activeStream: MediaStream | null = null;

    try {
      activeStream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(activeStream, {
        mimeType,
        videoBitsPerSecond: 6_000_000,
      });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const stopPromise = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: mimeType }));
        };
        recorder.onerror = (event) => {
          reject(
            event.error ?? new Error("Recording failed. Please try again."),
          );
        };
      });

      setIsGenerating(true);
      setError(null);
      setStatus("recording");
      setProgress(0);

      recorder.start();

      const totalDuration = durationSeconds * 1000;
      const startStamp = performance.now();
      let stopped = false;

      const requestStop = () => {
        if (stopped) {
          return;
        }
        stopped = true;
        setStatus("processing");
        recorder.stop();
      };

      const renderFrame = (now: number) => {
        const elapsed = now - startStamp;
        const normalized = clamp(elapsed / totalDuration, 0, 1);

        drawVisualFrame(
          context,
          width,
          height,
          normalized,
          preparedLines,
          selectedStyle,
        );

        const nextProgress = Math.round(normalized * 100);
        setProgress((current) =>
          nextProgress > current ? nextProgress : current,
        );

        if (normalized < 1) {
          animationFrame = requestAnimationFrame(renderFrame);
        } else {
          requestStop();
        }
      };

      animationFrame = requestAnimationFrame(renderFrame);

      const blob = await stopPromise;
      const objectUrl = URL.createObjectURL(blob);

      setVideoUrl(objectUrl);
      setStatus("idle");
      setProgress(100);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong while generating the video.";
      setError(message);
      setStatus("idle");
    } finally {
      cancelAnimationFrame(animationFrame);
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      setIsGenerating(false);
    }
  }, [
    durationSeconds,
    isGenerating,
    preparedLines,
    selectedStyle,
    videoUrl,
  ]);

  const resetToSample = useCallback(() => {
    setScript(DEFAULT_SCRIPT);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <div className="relative isolate flex w-full grow flex-col overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950" />
        <div className="absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-b from-cyan-500/10 via-slate-900/0 to-transparent blur-3xl" />

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-8 lg:py-16">
          <header className="flex flex-col gap-4">
            <p className="inline-flex max-w-fit items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-200">
              Text to Video Studio
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              Turn words into cinematic motion in just a click.
            </h1>
            <p className="max-w-2xl text-base text-slate-300 sm:text-lg">
              Describe the story or message you want to share. We animate your
              words with rich gradients, motion trails, and a modern aesthetic
              video ready for social media, product launches, and storytelling.
            </p>
          </header>

          <main className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <section className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">
                    Script
                  </h2>
                  <button
                    className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-white/30 hover:text-white"
                    onClick={resetToSample}
                    type="button"
                    disabled={isGenerating}
                  >
                    Use Sample Script
                  </button>
                </div>
                <textarea
                  className="min-h-[180px] w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-base leading-relaxed text-white outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                  value={script}
                  onChange={(event) => setScript(event.target.value)}
                  placeholder="Write a short narrative, product announcement, or inspirational message..."
                  disabled={isGenerating}
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <label className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Duration
                  </span>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={4}
                      max={14}
                      value={durationSeconds}
                      onChange={(event) =>
                        setDurationSeconds(Number(event.target.value))
                      }
                      disabled={isGenerating}
                      className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-cyan-400"
                    />
                    <span className="w-12 text-sm font-semibold text-white">
                      {durationSeconds}s
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Ideal between 6 and 10 seconds for social-ready clips.
                  </p>
                </label>

                <fieldset className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Visual Style
                  </legend>
                  <div className="flex flex-wrap gap-3">
                    {STYLE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setStyleId(preset.id)}
                        disabled={isGenerating}
                        className={`flex flex-col gap-1 rounded-2xl border px-3 py-2 text-left text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                          styleId === preset.id
                            ? "border-cyan-400/70 bg-cyan-500/10 text-cyan-100"
                            : "border-white/5 bg-white/5 text-slate-300 hover:border-cyan-300/40 hover:text-white"
                        }`}
                      >
                        <span className="font-semibold">{preset.name}</span>
                        <span className="text-[11px] text-slate-400">
                          {preset.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={generateVideo}
                    disabled={isGenerating}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-600/40 disabled:text-slate-300"
                  >
                    {isGenerating ? "Rendering..." : "Generate Video"}
                  </button>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    {status === "recording"
                      ? "Illustrating motion"
                      : status === "processing"
                        ? "Encoding video"
                        : "Ready to render"}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="font-semibold text-white">Progress</span>
                  <div className="relative h-1 w-40 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-cyan-400 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="font-mono text-sm text-white">
                    {progress.toString().padStart(3, " ")}%
                  </span>
                </div>
              </div>

              {error ? (
                <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </p>
              ) : null}
            </section>

            <section className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-slate-900/40 p-6 shadow-[0_40px_120px_-48px_rgba(14,165,233,0.4)] backdrop-blur-2xl sm:p-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Preview</h2>
                <span className="text-xs uppercase tracking-wide text-slate-400">
                  1280 × 720 · {durationSeconds}s
                </span>
              </div>
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80">
                {videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    playsInline
                    className="h-full w-full bg-black object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-400">
                    <span className="text-4xl">🎬</span>
                    <p className="text-sm">
                      Render a video to preview and download instantly.
                    </p>
                  </div>
                )}
                <canvas
                  ref={canvasRef}
                  className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                />
              </div>
              {videoUrl ? (
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={videoUrl}
                    download="text-to-video.webm"
                    className="inline-flex items-center gap-2 rounded-full border border-cyan-400/50 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-400/20"
                  >
                    Download WebM
                  </a>
                  <p className="text-xs text-slate-400">
                    Tip: Upload to your editor or convert to MP4 for platforms
                    that require it.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Need inspiration? Use the sample script and generate a vibrant
                  opener in seconds.
                </p>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
