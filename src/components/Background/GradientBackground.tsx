import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Premium gradient arkaplan bileşeni
 * Mouse takip eden parıltı ve partikül efektleri içerir
 */
export const GradientBackground: React.FC = () => {
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      setMousePosition({ 
        x: e.clientX / window.innerWidth, 
        y: e.clientY / window.innerHeight 
      });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Ana Gradient */}
      <motion.div
        animate={{
          background: [
            'radial-gradient(circle at 20% 80%, #4f46e5 0%, #111827 50%, #000000 100%)',
            'radial-gradient(circle at 80% 20%, #ec4899 0%, #111827 50%, #000000 100%)',
            'radial-gradient(circle at 50% 50%, #7c3aed 0%, #111827 50%, #000000 100%)',
          ],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-0"
      />

      {/* Mouse Takip Eden Parıltı */}
      <motion.div
        style={{
          left: `${mousePosition.x * 100}%`,
          top: `${mousePosition.y * 100}%`,
        }}
        className="absolute w-96 h-96 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      >
        <div className="w-full h-full bg-purple-500/20 rounded-full blur-3xl" />
      </motion.div>

      {/* Partikül Efekti */}
      <div className="absolute inset-0">
        {[...Array(50)].map((_, i: number) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              opacity: 0
            }}
            animate={{
              y: [null, -window.innerHeight - 100],
              opacity: [0, Math.random() * 0.5, 0],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              ease: 'linear',
              delay: Math.random() * 5,
            }}
            className="absolute w-1 h-1 bg-white/50 rounded-full"
          />
        ))}
      </div>
    </div>
  );
};


