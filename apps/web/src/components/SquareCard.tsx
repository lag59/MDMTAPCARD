"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { getPaymentsConfig } from "@/lib/api";

export interface SquareCardHandle {
  available: boolean;
  tokenize: () => Promise<string | null>;
}

type SquareTokenResult = { status: string; token?: string };

interface SquareCardInstance {
  attach: (el: HTMLElement) => Promise<void>;
  tokenize: () => Promise<SquareTokenResult>;
  destroy?: () => Promise<void> | void;
}

interface SquarePayments {
  card: () => Promise<SquareCardInstance>;
}

interface SquareSdk {
  payments: (applicationId: string, locationId: string) => SquarePayments;
}

declare global {
  interface Window {
    Square?: SquareSdk;
  }
}

function loadSquareSdk(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("No document"));
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (window.Square) {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("Square SDK failed to load")));
      }
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Square SDK failed to load"));
    document.head.appendChild(script);
  });
}

interface SquareCardProps {
  onAvailability?: (available: boolean) => void;
}

const SquareCard = forwardRef<SquareCardHandle, SquareCardProps>(function SquareCard({ onAvailability }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<SquareCardInstance | null>(null);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      available,
      tokenize: async () => {
        if (!cardRef.current) return null;
        try {
          const result = await cardRef.current.tokenize();
          if (result.status === "OK" && result.token) {
            setError(null);
            return result.token;
          }
        } catch {
          // fall through to the error message below
        }
        setError("Please complete the card details.");
        return null;
      },
    }),
    [available],
  );

  useEffect(() => {
    let cancelled = false;
    let instance: SquareCardInstance | null = null;

    (async () => {
      const config = await getPaymentsConfig();
      if (!config.application_id || !config.location_id) {
        onAvailability?.(false);
        return;
      }
      const sdkUrl =
        config.environment === "production"
          ? "https://web.squarecdn.com/v1/square.js"
          : "https://sandbox.web.squarecdn.com/v1/square.js";
      await loadSquareSdk(sdkUrl);
      if (cancelled || !window.Square || !containerRef.current) return;
      const payments = window.Square.payments(config.application_id, config.location_id);
      instance = await payments.card();
      await instance.attach(containerRef.current);
      cardRef.current = instance;
      if (!cancelled) {
        setAvailable(true);
        onAvailability?.(true);
      }
    })().catch(() => {
      if (!cancelled) onAvailability?.(false);
    });

    return () => {
      cancelled = true;
      if (instance?.destroy) {
        void instance.destroy();
      }
      cardRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div ref={containerRef} className={available ? "rounded-xl border border-slate-300 bg-white p-3" : ""} />
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
});

export default SquareCard;
