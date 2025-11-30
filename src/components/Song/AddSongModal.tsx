import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Music, User, FileText, Upload, CheckCircle } from 'lucide-react';
import { dbAdapter } from '../../database/DatabaseAdapter';
import { mediaService, MusicFile } from '../../services/MediaService';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSongAdded: () => void;
}

/**
 * Şarkı ekleme modal bileşeni
 * Premium glassmorphism tasarım ile
 */
export const AddSongModal: React.FC<Props> = ({ isOpen, onClose, onSongAdded }) => {
  const [title, setTitle] = useState<string>('');
  const [artist, setArtist] = useState<string>('');
  const [lyrics, setLyrics] = useState<string>('');
  const [musicFile, setMusicFile] = useState<MusicFile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Formu sıfırla
  const resetForm = useCallback((): void => {
    setTitle('');
    setArtist('');
    setLyrics('');
    setMusicFile(null);
  }, []);

  // Müzik dosyası seç
  const handleFileSelect = useCallback(async (): Promise<void> => {
    try {
      const file = await mediaService.pickMusicFile();
      
      if (!file) {
        return;
      }

      // Ses süresini al
      try {
        const duration = await mediaService.getAudioDuration(file.uri);
        file.duration = Math.round(duration);
      } catch {
        // Süre alınamazsa 0 kalır
      }

      setMusicFile(file);
      toast.success('Müzik dosyası yüklendi');
    } catch (error) {
      toast.error('Dosya yüklenemedi: ' + (error as Error).message);
    }
  }, []);

  // Modal kapat
  const handleClose = useCallback((): void => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  // Şarkı ekle
  const handleSubmit = useCallback(async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    // Validasyon
    if (!title.trim() || !artist.trim() || !lyrics.trim()) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    if (lyrics.trim().split(/\s+/).length < 5) {
      toast.error('Şarkı sözleri en az 5 kelime olmalıdır');
      return;
    }

    setIsSubmitting(true);

    try {
      await dbAdapter.initialize();
      await dbAdapter.addSong(
        title.trim(), 
        artist.trim(), 
        lyrics.trim(),
        musicFile?.uri || null,
        musicFile?.name || null,
        musicFile?.duration || 0
      );
      toast.success('Şarkı başarıyla eklendi!');
      resetForm();
      onSongAdded();
      handleClose();
    } catch (error) {
      console.error('Şarkı eklenirken hata:', error);
      toast.error('Şarkı eklenirken bir hata oluştu');
    } finally {
      setIsSubmitting(false);
    }
  }, [title, artist, lyrics, musicFile, onSongAdded, handleClose, resetForm]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="relative max-w-2xl w-full bg-gray-900/90 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-white/10 shadow-2xl my-auto"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Yeni Şarkı Ekle
              </h2>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleClose}
                className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all flex-shrink-0"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              </motion.button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {/* Müzik Dosyası Seçme */}
              <div>
                <label className="flex items-center gap-2 mb-2 text-xs sm:text-sm font-semibold text-gray-300">
                  <Upload className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400" />
                  Müzik Dosyası (Opsiyonel)
                </label>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  onClick={handleFileSelect}
                  className="relative border-2 border-dashed border-purple-500/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center cursor-pointer hover:border-purple-500 transition-all"
                >
                  <AnimatePresence mode="wait">
                    {!musicFile ? (
                      <motion.div
                        key="upload"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400 mx-auto mb-2" />
                        <p className="text-xs sm:text-sm font-semibold text-white">Müzik Dosyası Seç</p>
                        <p className="text-xs text-gray-400 mt-1">MP3, WAV, M4A</p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="selected"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex items-center justify-center gap-3"
                      >
                        <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-400" />
                        <div className="text-left">
                          <p className="font-semibold text-white text-xs sm:text-sm">{musicFile.name}</p>
                          <p className="text-xs text-gray-400">
                            {Math.round(musicFile.size / 1024 / 1024 * 100) / 100} MB
                            {musicFile.duration > 0 && ` • ${Math.floor(musicFile.duration / 60)}:${String(Math.floor(musicFile.duration % 60)).padStart(2, '0')}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMusicFile(null);
                          }}
                          className="p-1.5 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-all"
                        >
                          <X className="w-4 h-4 text-red-400" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>

              {/* Başlık */}
              <div>
                <label className="flex items-center gap-2 mb-2 text-xs sm:text-sm font-semibold text-gray-300">
                  <Music className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400" />
                  Şarkı Başlığı
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn: Lose Yourself"
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-white/5 backdrop-blur rounded-xl sm:rounded-2xl border border-white/10 focus:border-purple-500/50 focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-purple-500/20 text-white placeholder-gray-400 transition-all"
                  required
                />
              </div>

              {/* Sanatçı */}
              <div>
                <label className="flex items-center gap-2 mb-2 text-xs sm:text-sm font-semibold text-gray-300">
                  <User className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400" />
                  Sanatçı
                </label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="Örn: Eminem"
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-white/5 backdrop-blur rounded-xl sm:rounded-2xl border border-white/10 focus:border-purple-500/50 focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-purple-500/20 text-white placeholder-gray-400 transition-all"
                  required
                />
              </div>

              {/* Şarkı Sözleri */}
              <div>
                <label className="flex items-center gap-2 mb-2 text-xs sm:text-sm font-semibold text-gray-300">
                  <FileText className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400" />
                  Şarkı Sözleri
                </label>
                <textarea
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  placeholder="Şarkı sözlerini buraya yazın... (En az 5 kelime)"
                  rows={8}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-white/5 backdrop-blur rounded-xl sm:rounded-2xl border border-white/10 focus:border-purple-500/50 focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-purple-500/20 text-white placeholder-gray-400 transition-all resize-none custom-scrollbar"
                  required
                />
                <p className="mt-2 text-xs text-gray-400">
                  Kelime sayısı: {lyrics.trim().split(/\s+/).filter((w: string) => w.length > 0).length}
                </p>
              </div>

              {/* Butonlar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4 pt-4">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClose}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-white/10 rounded-xl sm:rounded-2xl border border-white/20 hover:bg-white/20 transition-all font-semibold text-sm sm:text-base"
                >
                  İptal
                </motion.button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl sm:rounded-2xl font-bold flex items-center justify-center gap-2 shadow-2xl shadow-purple-600/40 hover:shadow-purple-600/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Ekleniyor...</span>
                    </>
                  ) : (
                    <>
                      <Music className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>Şarkı Ekle</span>
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

