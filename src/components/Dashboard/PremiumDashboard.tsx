import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Calendar, Award, Users, Globe } from 'lucide-react';

interface Stat {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}

const stats: Stat[] = [
  { icon: Trophy, label: 'Toplam Puan', value: '2,847', color: 'from-yellow-400 to-orange-500' },
  { icon: TrendingUp, label: 'Ortalama Doğruluk', value: '%94.2', color: 'from-green-400 to-emerald-500' },
  { icon: Calendar, label: 'Günlük Süre', value: '2.4 Sa', color: 'from-blue-400 to-cyan-500' },
  { icon: Award, label: 'Başarım', value: '12/15', color: 'from-purple-400 to-pink-500' },
  { icon: Users, label: 'Sıralama', value: '#42', color: 'from-red-400 to-pink-500' },
  { icon: Globe, label: 'Şarkı Sayısı', value: '156', color: 'from-indigo-400 to-purple-500' },
];

/**
 * Premium dashboard bileşeni
 * 3D kartlar ve animasyonlar içerir
 */
export const PremiumDashboard: React.FC = () => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4 mb-6 sm:mb-8">
      {stats.map((stat: Stat, index: number) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={index}
            initial={{ y: 50, opacity: 0, rotateY: -90 }}
            animate={{ y: 0, opacity: 1, rotateY: 0 }}
            transition={{ 
              type: 'spring', 
              stiffness: 100, 
              delay: index * 0.1,
              rotateY: { duration: 0.6 }
            }}
            whileHover={{ 
              scale: 1.05, 
              y: -10,
              rotateY: 10,
              transition: { type: 'spring', stiffness: 200 }
            }}
            className="relative"
          >
            {/* 3D Kart */}
            <div className="relative bg-gray-800/50 backdrop-blur rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 border border-white/10 overflow-hidden transform-gpu">
              {/* Gradient Arka Plan */}
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-20 transition-opacity`} />
              
              {/* Ikon */}
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 mb-3"
              >
                <div className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br ${stat.color} rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
                </div>
              </motion.div>
              
              {/* Değer */}
              <motion.p 
                className="relative z-10 text-lg sm:text-xl md:text-2xl font-bold text-white mb-1"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
              >
                {stat.value}
              </motion.p>
              
              {/* Label */}
              <p className="relative z-10 text-xs text-gray-400 truncate">{stat.label}</p>
              
              {/* Glow Efekti */}
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} blur-xl opacity-0 group-hover:opacity-40 transition-opacity`} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

