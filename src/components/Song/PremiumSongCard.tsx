import React from 'react';
import { motion } from 'framer-motion';
import { Play, Clock, Award, BarChart3 } from 'lucide-react';
import { Song } from '../../types';

interface Props {
  song: Song;
  onSelect: () => void;
}

/**
 * Premium şarkı kartı bileşeni
 * Glassmorphism ve hover efektleri içerir
 */
export const PremiumSongCard: React.FC<Props> = ({ song, onSelect }) => {
  const difficultyColors: Record<string, string> = {
    Easy: 'text-green-400 bg-green-400/10',
    Medium: 'text-yellow-400 bg-yellow-400/10',
    Hard: 'text-red-400 bg-red-400/10',
  };

  const difficulty = song.difficulty || 'Medium';

  return (
    <motion.div
      whileHover={{ 
        scale: 1.05, 
        y: -10,
        boxShadow: '0 25px 50px rgba(124, 58, 237, 0.3)'
      }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 100 }}
      className="group relative cursor-pointer"
      onClick={onSelect}
    >
      {/* Glassmorphism Kart */}
      <div className="relative overflow-hidden bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6 transition-all">
        {/* Üst Gradient Çizgi */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* Kapak */}
        <div className="relative mb-3 sm:mb-4 overflow-hidden rounded-lg sm:rounded-xl">
          {song.cover ? (
            <img 
              src={song.cover} 
              alt={song.title}
              className="w-full h-32 sm:h-40 md:h-48 object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-32 sm:h-40 md:h-48 bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Play className="w-12 h-12 sm:w-16 sm:h-16 text-white/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              className="w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/20"
            >
              <Play className="w-5 h-5 text-white ml-1" />
            </motion.button>
          </div>
        </div>

        {/* İçerik */}
        <div className="space-y-2 sm:space-y-3">
          <div>
            <h3 className="text-base sm:text-lg md:text-xl font-bold text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-400 transition-all truncate">
              {song.title}
            </h3>
            <p className="text-gray-400 text-xs sm:text-sm truncate">{song.artist}</p>
          </div>

          {/* Meta Bilgiler */}
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${difficultyColors[difficulty]}`}>
              {difficulty}
            </span>
            {song.duration && (
              <div className="flex items-center gap-1 text-gray-400 text-xs">
                <Clock className="w-3 h-3" />
                {song.duration}
              </div>
            )}
          </div>

          {/* İstatistikler */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <Award className="w-4 h-4" />
              <span>%98.5</span>
            </div>
            <div className="flex items-center gap-2 text-purple-400 text-sm">
              <BarChart3 className="w-4 h-4" />
              <span>156K</span>
            </div>
          </div>
        </div>

        {/* Hover Glow Efekti */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
      </div>
    </motion.div>
  );
};

