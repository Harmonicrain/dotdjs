import React, { useState, useEffect } from 'react';
import { BackHeader } from './MenuPrimitives';

interface MenuShellProps {
  children: React.ReactNode;
  showLogo?: boolean;
  bottomRightText?: string;
  onBack?: () => void;
  breadcrumb?: string;
  backLabel?: string;
  pinBackHeaderTop?: boolean;
}

export const MenuShell = ({
  children,
  showLogo = true,
  bottomRightText = '[↑↓] NAVIGATE  [ENTER] SELECT',
  onBack,
  breadcrumb,
  backLabel,
  pinBackHeaderTop = false,
}: MenuShellProps) => {
  const [ready, setReady] = useState(false);
  const [isCompactHeight, setIsCompactHeight] = useState(
    typeof window !== 'undefined' && window.innerHeight <= 560,
  );

  const shouldPinBackHeaderTop = pinBackHeaderTop || !showLogo || isCompactHeight;

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onResize = () => {
      setIsCompactHeight(window.innerHeight <= 560);
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="absolute inset-0 z-50 overflow-hidden select-none pointer-events-auto menu-screen-flicker">
      {/* ── Background Image ──────────────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'url("/background.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#000',
        }}
      />

      {/* ── Cinematic Overlays ────────────────────────────────── */}
      {/* Vignette - deeper and more oppressive */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.85) 100%)',
          zIndex: 5,
        }}
      />
      {/* Dark breathing overlay */}
      <div
        className="absolute inset-0 pointer-events-none menu-dark-breathe"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.4) 100%)',
          zIndex: 5,
        }}
      />
      {/* CRT scan lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
          zIndex: 6,
        }}
      />
      {/* Grunge / dirt overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 15% 85%, rgba(80,0,0,0.12) 0%, transparent 30%),' +
            'radial-gradient(circle at 85% 15%, rgba(80,0,0,0.08) 0%, transparent 25%),' +
            'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.15) 0%, transparent 60%)',
          zIndex: 6,
        }}
      />
      {/* Film grain noise */}
      <div className="menu-grain" />
      {/* VHS scanline bar */}
      <div className="menu-vhs-bar" />

      {/* ── Logo ──────────────────────────────────────────────── */}
      {showLogo && (
        <div
          className="absolute pointer-events-none menu-chroma-shift"
          style={{
            top: '12%',
            left: '7%',
            opacity: ready ? 1 : 0,
            transform: ready ? 'translateY(0px)' : 'translateY(-20px)',
            transition: 'opacity 0.9s cubic-bezier(0.16,1,0.3,1), transform 0.9s cubic-bezier(0.16,1,0.3,1)',
            zIndex: 10,
          }}
        >
          <img
            src="/logo.png"
            alt="DOM OF THE DEAD"
            className="animate-title-glow"
            style={{
              width: isCompactHeight
                ? 'clamp(250px, 34vw, 360px)'
                : 'clamp(390px, 39vw, 600px)',
              filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.95)) drop-shadow(0 0 30px rgba(139,0,0,0.3))',
            }}
            draggable={false}
          />
        </div>
      )}

      {/* ── Back Header ────────────────────────────────────────── */}
      {onBack && (
        <div
          className="absolute"
          style={{
            top: shouldPinBackHeaderTop ? 'max(12px, env(safe-area-inset-top))' : '12%',
            left: '7%',
            marginTop: shouldPinBackHeaderTop
              ? '0'
              : showLogo
              ? 'calc(clamp(390px, 39vw, 600px) * 0.45 + 18px)'
              : '0',
            zIndex: 30,
            opacity: ready ? 1 : 0,
            transition: 'opacity 0.5s ease 0.2s',
          }}
        >
          <BackHeader onBack={onBack} label={backLabel} breadcrumb={breadcrumb} />
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────── */}
      {children}

      {/* ── Bottom bar ────────────────────────────────────────── */}
      <div
        className="absolute bottom-4 left-5"
        style={{
          color: '#444',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '11px',
          letterSpacing: '0.18em',
          opacity: ready ? 1 : 0,
          transition: 'opacity 0.6s ease 1s',
          zIndex: 10,
        }}
      >
        BUILD 2024.1 • CLASSIFIED
      </div>
      <div
        className="absolute bottom-4 right-5"
        style={{
          color: '#444',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '11px',
          letterSpacing: '0.12em',
          opacity: ready ? 1 : 0,
          transition: 'opacity 0.6s ease 1s',
          zIndex: 10,
        }}
      >
        {bottomRightText}
      </div>

      <style>{`
        @keyframes text-pulse {
          0%, 100% { letter-spacing: 0.02em; filter: brightness(1); }
          50%      { letter-spacing: 0.035em; filter: brightness(1.2); }
        }
      `}</style>
    </div>
  );
};
