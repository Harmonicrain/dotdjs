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
    <div className="absolute inset-0 z-50 overflow-hidden select-none pointer-events-auto">
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
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, transparent 30%, rgba(0, 0, 0, 0.6) 100%)',
          zIndex: 5,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
          zIndex: 6,
        }}
      />

      {/* ── Logo ──────────────────────────────────────────────── */}
      {showLogo && (
        <div
          className="absolute pointer-events-none"
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
            style={{
              width: isCompactHeight
                ? 'clamp(250px, 34vw, 360px)'
                : 'clamp(390px, 39vw, 600px)',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.9))',
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
