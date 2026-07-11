"use client";

import { supabase } from "@/src/lib/supabase";
import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { useTranslation } from "react-i18next";
import { initI18n } from "@/lib/i18n/config";
import "@/lib/i18n/config";
import ShapeGrid from "@/components/ShapeGrid"; // ✅ Import du composant installé

const slides = [
  {
    image: "/slides/slide1.jpeg",
    comment: "Gérez vos ventes en toute simplicité",
  },
  {
    image: "/slides/slide2.jpeg",
    comment: "Une caisse rapide, intuitive et fiable",
  },
  {
    image: "/slides/slide3.jpeg",
    comment: "Encaissez vos clients en quelques secondes",
  },
  {
    image: "/slides/slide4.jpeg",
    comment: "Gardez une trace de chaque transaction",
  },
];

const langs = [
  { code: "FR", flag: "https://flagcdn.com/w20/fr.png" },
  { code: "EN", flag: "https://flagcdn.com/w20/gb.png" },
  { code: "AR", flag: "https://flagcdn.com/w20/ma.png" },
];

// ─── Couleurs ──────────────────────────────────────────────────────
const BLUE = "#38BDF8";
const BLUE_SOFT = "#7DD3FC";

type AuthState = "checking" | "needs-login";

function getRedirectUrl(): string {
  const platform = Capacitor.getPlatform();
  if (platform === "android" || platform === "ios") {
    return "barkahflow://auth-callback";
  }
  return window.location.origin + "/dashboard";
}

function getStoredLang(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("barkahflow-language");
    if (stored && ["fr", "en", "ar"].includes(stored)) {
      return stored;
    }
  }
  return "fr";
}

export default function LoginPage() {
  const { t, i18n } = useTranslation();

  const [current, setCurrent] = useState(0);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [isVisible, setIsVisible] = useState(false);

  const [langIndex, setLangIndex] = useState(() => {
    const lang = getStoredLang();
    const index = langs.findIndex((l) => l.code.toLowerCase() === lang);
    return index !== -1 ? index : 0;
  });

  useEffect(() => {
    const storedLang = getStoredLang();
    const index = langs.findIndex((l) => l.code.toLowerCase() === storedLang);
    if (index !== -1) {
      setLangIndex(index);
    }
    if (storedLang) {
      initI18n(storedLang);
    }
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "barkahflow-language" && e.newValue) {
        const index = langs.findIndex(
          (l) => l.code.toLowerCase() === e.newValue,
        );
        if (index !== -1) {
          setLangIndex(index);
          initI18n(e.newValue);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const cycleLang = () => {
    const nextIndex = (langIndex + 1) % langs.length;
    setLangIndex(nextIndex);
    const langCode = langs[nextIndex].code.toLowerCase();
    localStorage.setItem("barkahflow-language", langCode);
    initI18n(langCode);
  };

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const setChecked = useCallback(() => {
    setTimeout(() => setIsVisible(true), 250);
  }, []);

  const checkSession = async () => {
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      setAuthState("needs-login");
      setChecked();
      return;
    }

    window.location.href = "/dashboard";
  };

  const handleGoogleLogin = async () => {
    const isPlaceholder =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");
    if (isPlaceholder) {
      window.location.href = "/dashboard";
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getRedirectUrl() },
    });
  };

  const lang = langs[langIndex];

  if (authState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: BLUE, borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* LEFT — Slideshow */}
      <div className="hidden md:flex flex-1 relative overflow-hidden">
        {slides.map((slide, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-all duration-700 ease-in-out"
            style={{ transform: `translateX(${(i - current) * 100}%)` }}
          >
            <img
              src={slide.image}
              alt=""
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)",
              }}
            />
            <div className="absolute bottom-16 left-0 right-0 px-12">
              <p className="text-white text-2xl font-semibold drop-shadow-lg mb-1">
                {slide.comment}
              </p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                {t("login.subtitle")}
              </p>
            </div>
          </div>
        ))}
        <div className="absolute bottom-8 left-12 flex gap-2 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === current ? "28px" : "6px",
                height: "6px",
                backgroundColor: i === current ? BLUE : "rgba(255,255,255,0.4)",
              }}
            />
          ))}
        </div>
      </div>

      {/* RIGHT — Auth Panel avec ShapeGrid en fond */}
      <div className="w-full md:w-[480px] flex flex-col relative bg-white/60 backdrop-blur-sm overflow-hidden">
        {/* ─── ShapeGrid Background ────────────────────────────────── */}
        <div className="absolute inset-0 z-0">
          <ShapeGrid
            speed={0.42}
            squareSize={28}
            direction="diagonal"
            borderColor="#32587b"
            hoverFillColor="#0e363c"
            shape="hexagon"
            hoverTrailAmount={0}
            className="w-full h-full"
          />
        </div>

        {/* Lang button */}
        <div className="absolute top-5 right-5 z-10">
          <button
            onClick={cycleLang}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold
                       transition-all duration-200 hover:bg-muted border border-gray-200 bg-white/80"
          >
            <img
              src={lang.flag}
              alt={lang.code}
              className="w-5 h-3.5 object-cover rounded-sm"
            />
            <span className="text-foreground">{lang.code}</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-12 gap-6 relative z-10">
          {/* Logo */}
          <div
            className={`flex flex-col items-center gap-4 transition-all duration-700 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          >
            <div
              className="w-[88px] h-[88px] rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #0b252b, #0a1628)",
                border: `2px solid ${BLUE}55`,
                boxShadow: `0 8px 32px ${BLUE}33`,
              }}
            >
              <img
                src="/slides/logo.png"
                alt="Logo"
                className="w-[70px] h-[70px] rounded-full object-cover"
              />
            </div>
            <h1 className="text-[28px] font-bold tracking-tight">
              <span className="text-foreground">Barkah</span>
              <span style={{ color: BLUE, textShadow: `0 0 20px ${BLUE}55` }}>
                Flow
              </span>
            </h1>
          </div>

          {/* Login Google */}
          {authState === "needs-login" && (
            <>
              <div className="text-center">
                <h2 className="text-xl font-bold text-foreground">
                  {t("login.welcome")}
                </h2>
              </div>
              <div
                className={`w-full transition-all duration-700 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              >
                <ShimmerButton
                  onClick={handleGoogleLogin}
                  shimmerColor={BLUE}
                  shimmerSize="0.08em"
                  borderRadius="12px"
                  background="linear-gradient(135deg, #0b252b 0%, #0a1628 100%)"
                  className="w-full py-3.5 text-sm font-semibold"
                >
                  <span className="flex items-center justify-center gap-3">
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span style={{ color: "#ffffff" }}>
                      {t("login.google")}
                    </span>
                  </span>
                </ShimmerButton>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 pb-6 relative z-10">
          <p className="text-xs text-muted-foreground">© BarkahFlow 2026</p>
          <span className="text-border">•</span>
          <p className="text-xs text-muted-foreground">
            {t("login.version", { version: "1.0.0" })}
          </p>
        </div>
      </div>
    </div>
  );
}