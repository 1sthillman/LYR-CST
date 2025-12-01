import React, { useCallback, useEffect } from 'react';
import { List, useListRef } from 'react-window';
import type { MatchResult } from '../../engine/UltimateLyricsMatcher';
import { motion } from 'framer-motion';
import { isMobileBrowser } from '../../utils/platform';

interface Props {
  words: string[];
  currentIndex: number;
  matchedWords: (MatchResult | null)[];
  onWordClick?: (index: number) => void;
}

const ROW_HEIGHT = 50;
const WORDS_PER_ROW = 12;

/**
 * Virtualized Lyrics Display - 10.000 Satır Destekli
 * Sadece görünen satırlar render edilir, DOM aşırı yüklenmez
 */
export const VirtualLyricsDisplay: React.FC<Props> = ({
  words,
  currentIndex,
  matchedWords,
  onWordClick,
}) => {
  const listRef = useListRef();
  const isMobile = isMobileBrowser();

  // Satır renderer (sadece görünen satırlar render edilir)
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const startWordIndex = index * WORDS_PER_ROW;
    const endWordIndex = Math.min(startWordIndex + WORDS_PER_ROW, words.length);
    const rowWords = words.slice(startWordIndex, endWordIndex);

    return (
      <div style={style} className="py-2">
        <div className="flex flex-wrap gap-2">
          {rowWords.map((word, i) => {
            const wordIndex = startWordIndex + i;
            const matched = matchedWords[wordIndex];
            const isCurrent = wordIndex === currentIndex;

            return (
              <motion.span
                key={wordIndex}
                data-index={wordIndex}
                onClick={() => onWordClick?.(wordIndex)}
                animate={isCurrent && !isMobile ? {
                  scale: [1, 1.15, 1],
                  textShadow: ['0 0 0px rgba(251, 191, 36, 0)', '0 0 20px rgba(251, 191, 36, 0.5)', '0 0 0px rgba(251, 191, 36, 0)'],
                } : isCurrent && isMobile ? {
                  scale: [1, 1.1, 1],
                } : {}}
                transition={{ duration: isMobile ? 0.2 : 0.3, ease: 'easeOut' }}
                style={{ willChange: isCurrent ? 'transform, opacity' : 'auto' }}
                className={`
                  inline-block px-2 py-1 rounded-lg border transition-all duration-200 select-none
                  ${onWordClick ? 'cursor-pointer hover:bg-white/5' : ''}
                  ${isCurrent ? 'text-yellow-400 bg-yellow-400/20 border-yellow-400/50 scale-110 shadow-lg shadow-yellow-400/20 font-bold' : ''}
                  ${matched && !isCurrent ? (
                    matched.isCorrect 
                      ? 'text-green-400 bg-green-400/10 border-green-400/30' 
                      : matched.isSkipped
                      ? 'text-orange-400 bg-orange-400/10 border-orange-400/30 line-through'
                      : 'text-red-400 bg-red-400/10 border-red-400/30 line-through'
                  ) : ''}
                  ${!matched && !isCurrent ? 'text-gray-400/60 border-transparent' : ''}
                `}
              >
                {word}
              </motion.span>
            );
          })}
        </div>
      </div>
    );
  }, [words, currentIndex, matchedWords, onWordClick]);

  // Otomatik scroll - mevcut kelimeyi ortala - SMOOTH VE YUMUŞAK
  useEffect(() => {
    const rowIndex = Math.floor(currentIndex / WORDS_PER_ROW);
    if (listRef.current) {
      // scrollToOffset kullan - smooth scroll için custom animasyon
      const targetOffset = rowIndex * ROW_HEIGHT - 300; // Ortala (600/2 = 300)
      const finalOffset = Math.max(0, targetOffset);
      
      // Smooth scroll için custom animasyon (react-window smooth scroll desteklemiyor)
      const listElement = (listRef.current as any)?._outerRef || (listRef.current as any)?.parentElement;
      if (listElement) {
        const start = listElement.scrollTop;
        const distance = finalOffset - start;
        const duration = 600; // 600ms smooth scroll
        const startTime = performance.now();
        
        const easeInOutCubic = (t: number): number => {
          return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        };
        
        const animateScroll = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = easeInOutCubic(progress);
          
          listElement.scrollTop = start + distance * eased;
          
          if (progress < 1) {
            requestAnimationFrame(animateScroll);
          } else {
            // Animasyon bittiğinde react-window'u güncelle
            (listRef.current as any).scrollToOffset(finalOffset);
          }
        };
        
        requestAnimationFrame(animateScroll);
      } else {
        // Fallback: normal scroll
        (listRef.current as any).scrollToOffset(finalOffset);
      }
    }
  }, [currentIndex]);

  const totalRows = Math.ceil(words.length / WORDS_PER_ROW);

  return (
    <div className="h-full w-full custom-scrollbar">
      <List
        ref={listRef}
        height={600}
        itemCount={totalRows}
        itemSize={ROW_HEIGHT}
        width="100%"
        overscanCount={5} // Önbellek - görünmeyen satırları da render et
        // @ts-expect-error - react-window children type issue
        children={Row}
      />
    </div>
  );
};

