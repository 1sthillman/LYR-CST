import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { GradientBackground } from './components/Background/GradientBackground';
import { PremiumHeader } from './components/Layout/PremiumHeader';
import { PremiumDashboard } from './components/Dashboard/PremiumDashboard';
import { SongManager } from './components/Song/SongManager';
import { PremiumKaraokePlayer } from './components/Player/PremiumKaraokePlayer';
import { dbAdapter } from './database/DatabaseAdapter';
import { Song } from './types';
import './styles/premium.css';

/**
 * Ana uygulama bileşeni
 * Premium tasarım ve tüm özellikleri içerir
 */
function App() {
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [activeTab, setActiveTab] = useState<'library' | 'player'>('library');

  // Veritabanını başlat
  useEffect(() => {
    const initDb = async (): Promise<void> => {
      try {
        await dbAdapter.initialize();
      } catch (error) {
        console.error('Veritabanı başlatılamadı:', error);
      }
    };
    initDb();
  }, []);

  // Şarkı seçildiğinde player'a geç
  useEffect(() => {
    if (selectedSong) {
      setActiveTab('player');
    }
  }, [selectedSong]);

  return (
    <div className="relative min-h-screen">
      <GradientBackground />
      <PremiumHeader />
      
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        {/* Dashboard */}
        <div className="hidden sm:block">
          <PremiumDashboard />
        </div>

        {/* Navigasyon */}
        <nav className="flex justify-center mb-4 sm:mb-6 md:mb-8">
          <div className="bg-gray-800 rounded-full p-1 flex w-full sm:w-auto">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setActiveTab('library');
              }}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-full font-semibold text-sm sm:text-base transition-all ${
                activeTab === 'library' 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-400'
              }`}
            >
              <span className="hidden sm:inline">Şarkı Kütüphanesi</span>
              <span className="sm:hidden">Kütüphane</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (selectedSong) {
                  setActiveTab('player');
                } else {
                  toast.error('Lütfen önce bir şarkı seçin');
                }
              }}
              disabled={!selectedSong}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-full font-semibold text-sm sm:text-base transition-all ${
                activeTab === 'player' 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-400'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="hidden sm:inline">Karaoke Modu</span>
              <span className="sm:hidden">Karaoke</span>
            </motion.button>
          </div>
        </nav>

        {/* İçerik */}
        <AnimatePresence mode="wait">
          {activeTab === 'library' ? (
            <motion.div
              key="library"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <SongManager onSelectSong={(song: Song) => setSelectedSong(song)} />
            </motion.div>
          ) : selectedSong ? (
            <motion.div
              key="player"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 100 }}
            >
              <div className="mb-6 text-center">
                <h2 className="text-3xl font-bold">{selectedSong.title}</h2>
                <p className="text-gray-400">{selectedSong.artist}</p>
              </div>
              <PremiumKaraokePlayer
                lyrics={selectedSong.lyrics}
                songId={selectedSong.id}
                songTitle={selectedSong.title}
                artist={selectedSong.artist}
                audioFilePath={selectedSong.audio_file_path || null}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(17, 24, 39, 0.9)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            color: 'white',
          },
          iconTheme: {
            primary: '#a855f7',
            secondary: 'white',
          },
        }}
      />
    </div>
  );
}

export default App;

