import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX, Play, Pause, Music } from 'lucide-react';
import { audioControlService } from '../../services/AudioControlService';
import toast from 'react-hot-toast';

interface Props {
  songFilePath: string | null;
}

export const AudioControlPanel: React.FC<Props> = ({ songFilePath }) => {
  const [volume, setVolume] = useState(75); // 0-100
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    // Audio servisini başlat
    audioControlService.setVolume(volume / 100);
    
    return () => {
      audioControlService.cleanup();
    };
  }, []);

  useEffect(() => {
    if (songFilePath) {
      loadSong();
    }
  }, [songFilePath]);

  const loadSong = async () => {
    if (!songFilePath) return;
    
    try {
      await audioControlService.loadSong(songFilePath);
      audioControlService.setVolume(volume / 100);
      toast.success('Müzik yüklendi');
    } catch (error) {
      toast.error('Müzik yüklenemedi');
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    const normalizedVolume = newVolume / 100;
    audioControlService.setVolume(normalizedVolume);
    
    if (newVolume === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      handleVolumeChange(75);
      setIsMuted(false);
    } else {
      handleVolumeChange(0);
      setIsMuted(true);
    }
    audioControlService.toggleMute();
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      audioControlService.pause();
      setIsPlaying(false);
    } else {
      try {
        audioControlService.play();
        setIsPlaying(true);
      } catch (error) {
        toast.error('Oynatma başlatılamadı');
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/10"
    >
      <h3 className="text-lg font-bold mb-4 sm:mb-6 flex items-center gap-2">
        <Music className="w-5 h-5 text-purple-400" />
        Ses Kontrolü
      </h3>

      <div className="space-y-4 sm:space-y-6">
        {/* Oynatma Kontrolü */}
        <div className="flex items-center justify-center">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handlePlayPause}
            disabled={!songFilePath}
            className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            ) : (
              <Play className="w-5 h-5 sm:w-6 sm:h-6 text-white ml-0.5 sm:ml-1" />
            )}
          </motion.button>
        </div>

        {/* Ses Seviyesi Slider */}
        <div>
          <div className="flex items-center gap-3 sm:gap-4 mb-3">
            <motion.button 
              whileHover={{ scale: 1.1 }} 
              onClick={toggleMute}
              className="flex-shrink-0"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              ) : (
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
              )}
            </motion.button>
            
            <div className="flex-1">
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer slider"
              />
            </div>
            
            <span className="text-xs sm:text-sm font-semibold text-white w-10 sm:w-12 text-right">{volume}%</span>
          </div>
        </div>

        {/* Ses Seviyesi Görsel Gösterge */}
        <div className="flex items-end justify-center gap-1 h-12 sm:h-16 bg-gray-900/50 rounded-lg p-2">
          {[...Array(20)].map((_, i) => {
            const barHeight = isMuted ? 10 : (volume / 100) * 50 + Math.random() * 10;
            return (
              <motion.div
                key={i}
                animate={{ height: `${barHeight}px` }}
                transition={{ duration: 0.2 }}
                className="w-0.5 sm:w-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-t-full"
              />
            );
          })}
        </div>

        <p className="text-xs text-gray-400 text-center">
          Karaoke sırasında müziğin sesini ayarlayın
        </p>
      </div>
    </motion.div>
  );
};


