import React from 'react';
import { motion } from 'framer-motion';
import { Music, Trophy, Zap, User } from 'lucide-react';

/**
 * Premium header bileşeni
 * Glassmorphism efektli navigasyon barı
 */
export const PremiumHeader: React.FC = () => {
  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 80, damping: 20 }}
      className="relative z-50"
    >
      {/* Glassmorphism Efekti */}
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-xl border-b border-white/10" />
      
      <div className="relative container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-2 sm:gap-3"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30 flex-shrink-0">
              <Music className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent truncate">
                LYRİC-ST
              </h1>
              <p className="text-xs text-gray-400 hidden sm:block">Premium Edition v1.0</p>
            </div>
          </motion.div>

          {/* Navigasyon */}
          <nav className="flex items-center gap-2 sm:gap-4 md:gap-6">
            <motion.button
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 sm:p-3 bg-white/5 rounded-lg sm:rounded-xl border border-white/10 hover:bg-white/10 transition-all"
            >
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 sm:p-3 bg-white/5 rounded-lg sm:rounded-xl border border-white/10 hover:bg-white/10 transition-all"
            >
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 sm:p-3 bg-white/5 rounded-lg sm:rounded-xl border border-white/10 hover:bg-white/10 transition-all"
            >
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            </motion.button>
          </nav>
        </div>
      </div>
    </motion.header>
  );
};

