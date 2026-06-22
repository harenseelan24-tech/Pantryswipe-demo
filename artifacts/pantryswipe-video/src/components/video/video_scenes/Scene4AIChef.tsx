import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';
import { Sparkles, Loader2 } from 'lucide-react';

export function Scene4AIChef() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2800),
      setTimeout(() => setPhase(4), 3800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center overflow-hidden bg-[#141210]"
      {...sceneTransitions.morphExpand}
    >
      <div className="absolute inset-0 z-0">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-[#5B8EF5]/10 rounded-full blur-[150px] pointer-events-none" />
      </div>

      <div className="w-1/2 h-full flex flex-col justify-center px-16 z-10 relative">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="flex items-center gap-4 mb-4 text-[#5B8EF5]">
             <Sparkles size={48} className="animate-pulse"/>
          </div>
          <h2 className="text-[7vw] font-black text-white leading-[0.9] font-display uppercase tracking-tight">
            AI Sous<br/>
            <span className="text-[#5B8EF5]">Chef</span>
          </h2>
          <p className="text-[2vw] text-white/70 mt-6 font-body leading-tight">
            Ask questions while cooking.<br/>
            It knows exactly what's in your pantry.
          </p>
        </motion.div>
      </div>

      <div className="w-1/2 h-full flex flex-col justify-center px-12 relative z-10">
        <motion.div 
            className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-10 flex flex-col gap-8 shadow-2xl relative overflow-hidden"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={phase >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.8, ease: 'circOut' }}
        >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#5B8EF5] to-transparent opacity-50" />

            {/* User Message */}
            <div className="flex justify-end">
                <motion.div 
                    className="bg-white/10 text-white border border-white/20 px-6 py-4 rounded-3xl rounded-tr-md text-[1.6vw] max-w-[85%] font-body"
                    initial={{ opacity: 0, y: 20 }}
                    animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ type: 'spring' }}
                >
                    I'm out of eggs for the pancakes. What else can I use?
                </motion.div>
            </div>
            
            {/* AI Typing Indicator */}
            {phase === 3 && (
                <motion.div 
                    className="flex justify-start"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <div className="bg-[#5B8EF5]/20 border border-[#5B8EF5]/30 px-6 py-4 rounded-3xl rounded-tl-md flex items-center gap-2">
                        <Loader2 className="animate-spin text-[#5B8EF5]" size={24} />
                        <span className="text-[#5B8EF5] font-bold text-[1.2vw]">Chef is typing...</span>
                    </div>
                </motion.div>
            )}

            {/* AI Message */}
            {phase >= 4 && (
                <motion.div 
                    className="flex justify-start"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                    <div className="bg-gradient-to-br from-[#5B8EF5]/20 to-[#5B8EF5]/5 border border-[#5B8EF5]/40 text-white px-8 py-6 rounded-3xl rounded-tl-md text-[1.6vw] max-w-[90%] font-body shadow-[0_0_30px_rgba(91,142,245,0.2)]">
                        <div className="flex items-center gap-3 mb-3 border-b border-white/10 pb-3">
                            <div className="w-8 h-8 bg-[#5B8EF5] rounded-full flex items-center justify-center text-white">
                                <Sparkles size={16} />
                            </div>
                            <span className="font-bold text-[#5B8EF5] text-[1.2vw] uppercase tracking-wider">AI Chef</span>
                        </div>
                        I see you have <span className="text-[#F5A623] font-bold bg-[#F5A623]/20 px-2 py-0.5 rounded">applesauce</span> and <span className="text-[#F5A623] font-bold bg-[#F5A623]/20 px-2 py-0.5 rounded">flaxseed</span>! You can substitute 1/4 cup of applesauce for each egg.
                    </div>
                </motion.div>
            )}
        </motion.div>
      </div>
    </motion.div>
  );
}
