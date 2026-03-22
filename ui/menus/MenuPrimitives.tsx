import React, { useEffect, useRef } from 'react';

// ── BackHeader ─────────────────────────────────────────────────────
// Standardized back-navigation row with ESC key support.
// Input-focus guard: if an input is focused, ESC blurs it first;
// only navigates back on a second press.

interface BackHeaderProps {
  onBack: () => void;
  label?: string;
  breadcrumb?: string;
}

export const BackHeader = ({ onBack, label = 'BACK', breadcrumb }: BackHeaderProps) => {
  const justBlurred = useRef(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();

      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        (active as HTMLElement).blur();
        justBlurred.current = true;
        return;
      }

      if (justBlurred.current) {
        justBlurred.current = false;
        return;
      }

      onBack();
    };

    const resetBlur = () => {
      justBlurred.current = false;
    };

    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', resetBlur);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', resetBlur);
    };
  }, [onBack]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        zIndex: 10,
      }}
    >
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '11px',
          letterSpacing: '0.2em',
          color: '#888',
          textTransform: 'uppercase',
          padding: 0,
          textAlign: 'left',
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#FF8C00')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#888')}
      >
        ← {label}
      </button>
      {breadcrumb && (
        <span
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '10px',
            letterSpacing: '0.2em',
            color: '#666',
            textTransform: 'uppercase',
          }}
        >
          {breadcrumb}
        </span>
      )}
    </div>
  );
};

// ── MenuPanel ──────────────────────────────────────────────────────
// Dark framed panel with corner bracket accents and optional title bar.

interface MenuPanelProps {
  children: React.ReactNode;
  title?: string;
  titleRight?: React.ReactNode;
  maxWidth?: string;
  height?: string;
  minHeight?: string;
}

export const MenuPanel = ({
  children,
  title,
  titleRight,
  maxWidth = '560px',
  height,
  minHeight,
}: MenuPanelProps) => (
  <div
    style={{
      position: 'relative',
      width: '100%',
      maxWidth,
      height,
      minHeight,
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid rgba(139,0,0,0.45)',
      boxShadow:
        '0 0 0 1px rgba(80,0,0,0.25), 0 0 60px rgba(120,0,0,0.2), inset 0 0 60px rgba(0,0,0,0.5)',
      background: 'rgba(6,4,4,0.97)',
    }}
  >
    {/* Corner bracket accents */}
    {[
      { top: '-1px', left: '-1px', borderTop: '2px solid rgba(139,0,0,0.6)', borderLeft: '2px solid rgba(139,0,0,0.6)' },
      { top: '-1px', right: '-1px', borderTop: '2px solid rgba(139,0,0,0.6)', borderRight: '2px solid rgba(139,0,0,0.6)' },
      { bottom: '-1px', left: '-1px', borderBottom: '2px solid rgba(139,0,0,0.6)', borderLeft: '2px solid rgba(139,0,0,0.6)' },
      { bottom: '-1px', right: '-1px', borderBottom: '2px solid rgba(139,0,0,0.6)', borderRight: '2px solid rgba(139,0,0,0.6)' },
    ].map((style, i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          width: '60px',
          height: '60px',
          pointerEvents: 'none',
          ...style,
        }}
      />
    ))}

    {/* Title bar */}
    {title && (
      <div
        style={{
          padding: '18px 28px',
          borderBottom: '1px solid rgba(139,0,0,0.3)',
          background:
            'linear-gradient(90deg, rgba(80,0,0,0.3) 0%, rgba(20,0,0,0.5) 50%, rgba(80,0,0,0.3) 100%)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <div
          style={{
            width: '3px',
            height: '22px',
            background: 'linear-gradient(to bottom, #FF8C00, #cc5500)',
            flexShrink: 0,
          }}
        />
        <h2
          style={{
            fontFamily: "'Oswald', 'Bebas Neue', Georgia, serif",
            fontSize: '22px',
            fontWeight: 700,
            letterSpacing: '0.25em',
            color: '#D0D0D0',
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </h2>
        {titleRight && (
          <span style={{ marginLeft: 'auto' }}>{titleRight}</span>
        )}
      </div>
    )}

    {/* Content */}
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px', flex: 1, minHeight: 0 }}>
      {children}
    </div>
  </div>
);

// ── ActionButton ───────────────────────────────────────────────────
// Red gradient confirm/action button with hover glow and disabled state.

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'green';
}

export const ActionButton = ({
  label,
  onClick,
  disabled = false,
  variant = 'primary',
}: ActionButtonProps) => {
  const gradients = {
    primary: {
      bg: 'linear-gradient(180deg, rgba(180,30,0,0.85) 0%, rgba(100,10,0,0.95) 100%)',
      hoverBg: 'linear-gradient(180deg, rgba(220,50,0,0.9) 0%, rgba(140,20,0,1) 100%)',
      border: '1px solid rgba(200,40,0,0.5)',
      shadow: '0 0 20px rgba(180,30,0,0.2)',
      hoverShadow: '0 0 30px rgba(220,60,0,0.4)',
    },
    green: {
      bg: 'linear-gradient(180deg, rgba(22,101,52,0.85) 0%, rgba(10,60,30,0.95) 100%)',
      hoverBg: 'linear-gradient(180deg, rgba(34,130,70,0.9) 0%, rgba(16,80,40,1) 100%)',
      border: '1px solid rgba(34,197,94,0.4)',
      shadow: '0 0 20px rgba(22,101,52,0.2)',
      hoverShadow: '0 0 30px rgba(34,197,94,0.3)',
    },
  };

  const g = gradients[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        background: disabled ? 'rgba(30,30,30,0.8)' : g.bg,
        border: disabled ? '1px solid rgba(60,60,60,0.4)' : g.border,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: "'Oswald', Georgia, serif",
        fontSize: '16px',
        fontWeight: 700,
        letterSpacing: '0.2em',
        color: disabled ? '#555' : '#F0F0F0',
        textTransform: 'uppercase',
        padding: '14px 30px',
        transition: 'background 0.15s ease, box-shadow 0.15s ease',
        boxShadow: disabled ? 'none' : g.shadow,
        width: '100%',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        const el = e.currentTarget as HTMLElement;
        el.style.background = g.hoverBg;
        el.style.boxShadow = g.hoverShadow;
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        const el = e.currentTarget as HTMLElement;
        el.style.background = g.bg;
        el.style.boxShadow = g.shadow;
      }}
    >
      {label}
    </button>
  );
};
