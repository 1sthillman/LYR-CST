import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, Grid, List } from 'lucide-react';
import { PremiumSongCard } from './PremiumSongCard';
import { AddSongModal } from './AddSongModal';
import { dbAdapter } from '../../database/DatabaseAdapter';
import { Song } from '../../types';
import toast from 'react-hot-toast';

interface Props {
  onSelectSong: (song: Song) => void;
}

/**
 * Şarkı yönetim bileşeni
 * Şarkı listesi, arama ve filtreleme içerir
 */
export const SongManager: React.FC<Props> = ({ onSelectSong }) => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // Şarkıları yükle
  const loadSongs = useCallback(async (): Promise<void> => {
    try {
      await dbAdapter.initialize();
      const allSongs = await dbAdapter.getAllSongs();
      setSongs(allSongs);
    } catch (error) {
      console.error('Şarkılar yüklenemedi:', error);
      toast.error('Şarkılar yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Şarkı eklendikten sonra listeyi yenile
  const handleSongAdded = useCallback((): void => {
    loadSongs();
  }, [loadSongs]);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  // Filtrelenmiş şarkılar
  const filteredSongs: Song[] = songs.filter((song: Song) => {
    const query = searchQuery.toLowerCase();
    return (
      song.title.toLowerCase().includes(query) ||
      song.artist.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Arama ve Filtre */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1, transition: { delay: 0.4 } }}
        className="flex items-center justify-between"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Şarkı veya sanatçı ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-3 text-sm sm:text-base bg-white/5 backdrop-blur rounded-xl sm:rounded-2xl border border-white/10 focus:border-purple-500/50 focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-purple-500/20 text-white placeholder-gray-400 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 ml-2 sm:ml-4 md:ml-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 sm:p-3 bg-white/5 rounded-xl sm:rounded-2xl border border-white/10 hover:bg-white/10 transition-all"
          >
            <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 sm:p-3 bg-white/5 rounded-xl sm:rounded-2xl border border-white/10 hover:bg-white/10 transition-all"
          >
            {viewMode === 'grid' ? <List className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" /> : <Grid className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />}
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl sm:rounded-2xl font-semibold flex items-center gap-1.5 sm:gap-2 shadow-2xl shadow-purple-600/40 hover:shadow-purple-600/60 transition-all text-sm sm:text-base"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Yeni Şarkı</span>
            <span className="sm:hidden">Ekle</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Şarkı Listesi */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Yükleniyor...</div>
      ) : filteredSongs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {searchQuery ? 'Arama sonucu bulunamadı' : 'Henüz şarkı eklenmemiş'}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={viewMode === 'grid' 
            ? 'grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' 
            : 'space-y-4'
          }
        >
          {filteredSongs.map((song: Song, index: number) => (
            <motion.div
              key={song.id}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.05, type: 'spring' }}
            >
              <PremiumSongCard song={song} onSelect={() => onSelectSong(song)} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Şarkı Ekleme Modal */}
      <AddSongModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSongAdded={handleSongAdded}
      />
    </div>
  );
};

