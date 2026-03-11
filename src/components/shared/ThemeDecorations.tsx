'use client';

import { useTheme, allDecorations } from '@/lib/theme-provider';
import { useEffect, useState } from 'react';

interface Particle {
    id: number;
    emoji: string;
    left: number;
    delay: number;
    duration: number;
    size: number;
    drift: number;
}

export default function ThemeDecorations() {
    const { decorationId } = useTheme();
    const [particles, setParticles] = useState<Particle[]>([]);

    const decoration = allDecorations.find(d => d.id === decorationId);

    useEffect(() => {
        if (!decoration || decoration.id === 'none' || decoration.particles.length === 0) {
            setParticles([]);
            return;
        }

        // Generate particles
        const count = 18;
        const newParticles: Particle[] = [];
        for (let i = 0; i < count; i++) {
            newParticles.push({
                id: i,
                emoji: decoration.particles[i % decoration.particles.length],
                left: Math.random() * 100,
                delay: Math.random() * 12,
                duration: 8 + Math.random() * 10,
                size: 14 + Math.random() * 14,
                drift: -30 + Math.random() * 60,
            });
        }
        setParticles(newParticles);
    }, [decorationId, decoration]);

    if (!decoration || decoration.id === 'none' || particles.length === 0) return null;

    return (
        <>
            {/* Global keyframes */}
            <style jsx global>{`
                @keyframes theme-fall {
                    0% {
                        transform: translateY(-60px) translateX(0px) rotate(0deg);
                        opacity: 0;
                    }
                    10% {
                        opacity: 0.7;
                    }
                    90% {
                        opacity: 0.5;
                    }
                    100% {
                        transform: translateY(calc(100vh + 60px)) translateX(var(--drift)) rotate(360deg);
                        opacity: 0;
                    }
                }
                @keyframes theme-float {
                    0%, 100% {
                        transform: translateY(0px) rotate(0deg);
                        opacity: 0.5;
                    }
                    25% {
                        transform: translateY(-15px) rotate(5deg);
                        opacity: 0.7;
                    }
                    50% {
                        transform: translateY(-25px) rotate(-3deg);
                        opacity: 0.6;
                    }
                    75% {
                        transform: translateY(-10px) rotate(4deg);
                        opacity: 0.7;
                    }
                }
                @keyframes theme-sparkle {
                    0%, 100% {
                        opacity: 0;
                        transform: scale(0.5) rotate(0deg);
                    }
                    50% {
                        opacity: 0.8;
                        transform: scale(1.2) rotate(180deg);
                    }
                }
            `}</style>

            {/* Particle container */}
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 9999,
                    overflow: 'hidden',
                }}
            >
                {particles.map(p => {
                    // Choose animation based on decoration type
                    const isFirework = ['newyear', 'summer'].includes(decorationId);
                    const isFloat = ['valentine', 'mid-autumn'].includes(decorationId);
                    const animation = isFirework
                        ? `theme-sparkle ${p.duration * 0.6}s ease-in-out ${p.delay}s infinite`
                        : isFloat
                            ? `theme-float ${p.duration}s ease-in-out ${p.delay}s infinite`
                            : `theme-fall ${p.duration}s linear ${p.delay}s infinite`;

                    return (
                        <span
                            key={p.id}
                            style={{
                                position: 'absolute',
                                left: `${p.left}%`,
                                top: isFloat ? `${20 + Math.random() * 60}%` : isFirework ? `${10 + Math.random() * 70}%` : '-60px',
                                fontSize: `${p.size}px`,
                                animation,
                                '--drift': `${p.drift}px`,
                                willChange: 'transform, opacity',
                                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
                                userSelect: 'none',
                            } as React.CSSProperties}
                        >
                            {p.emoji}
                        </span>
                    );
                })}
            </div>

            {/* Corner decorations for specific themes */}
            {decorationId === 'christmas' && (
                <>
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, height: '4px',
                        background: 'repeating-linear-gradient(90deg, #DC2626 0px, #DC2626 20px, #16A34A 20px, #16A34A 40px, #EAB308 40px, #EAB308 60px)',
                        zIndex: 9998, pointerEvents: 'none', opacity: 0.7,
                    }} />
                </>
            )}

            {decorationId === 'tet' && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, height: '4px',
                    background: 'linear-gradient(90deg, #DC2626, #F59E0B, #DC2626)',
                    zIndex: 9998, pointerEvents: 'none', opacity: 0.7,
                }} />
            )}

            {decorationId === 'halloween' && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, height: '4px',
                    background: 'linear-gradient(90deg, #F97316, #7C3AED, #F97316)',
                    zIndex: 9998, pointerEvents: 'none', opacity: 0.7,
                }} />
            )}
        </>
    );
}
