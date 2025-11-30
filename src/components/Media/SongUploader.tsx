import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Music, FileAudio, X, CheckCircle } from 'lucide-react';
import { mediaService, MusicFile } from '../../services/MediaService';
import { dbAdapter } from '../../database/DatabaseAdapter';
import toast from 'react-hot-toast';

interface Props {
  onSongUploaded?: (songId: number) => void;
  onClose?: () => void;
}

export const SongUploader: React.FC<Props> = ({ onSongUploaded, onClose }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [musicFile, setMusicFile] = useState<MusicFile | null>(null);
  const [songDetails, setSongDetails] = useState({
    title: '',
    artist: '',
    lyrics: '',
  });

  const handleFileSelect = async () => {
    try {
      setIsUploading(true);
      const file = await mediaService.pickMusicFile();
      
      if (!file) {
        toast.error('Dosya seçilmedi');
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
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!songDetails.title || !songDetails.artist || !songDetails.lyrics) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    try {
      setIsUploading(true);

      // Veritabanını başlat
      await dbAdapter.initialize();

      // Şarkıyı veritabanına ekle
      const songId = await dbAdapter.addSong(
        songDetails.title,
        songDetails.artist,
        songDetails.lyrics,
        musicFile?.uri || null,
        musicFile?.name || null,
        musicFile?.duration || 0
      );

      toast.success('Şarkı başarıyla eklendi!');
      onSongUploaded?.(songId);
      onClose?.();

      // Formu temizle
      setMusicFile(null);
      setSongDetails({ title: '', artist: '', lyrics: '' });
    } catch (error) {
      toast.error('Şarkı eklenemedi: ' + (error as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-gray-800/50 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/10"
    >
      {/* Close Button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      )}

      <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
        <Music className="w-6 h-6 text-purple-400" />
        Yeni Şarkı Ekle
      </h3>

      {/* Dosya Seçme Alanı */}
      <motion.div
        whileHover={{ scale: 1.02 }}
        onClick={handleFileSelect}
        className="relative border-2 border-dashed border-purple-500/50 rounded-2xl p-8 sm:p-12 text-center cursor-pointer hover:border-purple-500 transition-all"
      >
        <AnimatePresence mode="wait">
          {!musicFile ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Upload className="w-12 h-12 sm:w-16 sm:h-16 text-purple-400 mx-auto mb-4" />
              <p className="text-base sm:text-lg font-semibold text-white">Müzik Dosyası Seç</p>
              <p className="text-xs sm:text-sm text-gray-400 mt-2">MP3, WAV, M4A formatları desteklenir</p>
            </motion.div>
          ) : (
            <motion.div
              key="selected"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center justify-center gap-4"
            >
              <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-green-400" />
              <div className="text-left">
                <p className="font-semibold text-white text-sm sm:text-base">{musicFile.name}</p>
                <p className="text-xs sm:text-sm text-gray-400">
                  {Math.round(musicFile.size / 1024 / 1024 * 100) / 100} MB
                  {musicFile.duration > 0 && ` • ${Math.floor(musicFile.duration / 60)}:${String(Math.floor(musicFile.duration % 60)).padStart(2, '0')}`}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMusicFile(null);
                }}
                className="p-2 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-all"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Şarkı Bilgileri Formu */}
      <div className="mt-6 sm:mt-8 space-y-4 sm:space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Şarkı Adı</label>
          <input
            type="text"
            value={songDetails.title}
            onChange={(e) => setSongDetails({ ...songDetails, title: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all"
            placeholder="Örn: Lose Yourself"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Sanatçı</label>
          <input
            type="text"
            value={songDetails.artist}
            onChange={(e) => setSongDetails({ ...songDetails, artist: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all"
            placeholder="Örn: Eminem"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Şarkı Sözleri</label>
          <textarea
            value={songDetails.lyrics}
            onChange={(e) => setSongDetails({ ...songDetails, lyrics: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all resize-none h-32 sm:h-40"
            placeholder="Şarkı sözlerini buraya yapıştırın..."
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={isUploading || !songDetails.title || !songDetails.artist}
          className={`w-full py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center gap-2 sm:gap-3 ${
            isUploading || !songDetails.title || !songDetails.artist
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
          } transition-all`}
        >
          {isUploading ? (
            <>
              <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Yükleniyor...
            </>
          ) : (
            <>
              <FileAudio className="w-5 h-5 sm:w-6 sm:h-6" />
              Şarkıyı Kaydet
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};

