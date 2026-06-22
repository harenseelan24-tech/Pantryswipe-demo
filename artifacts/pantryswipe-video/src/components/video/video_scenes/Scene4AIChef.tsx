import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene4AIChef() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex overflow-hidden bg-bg-dark"
      {...sceneTransitions.pushLeft}
    >
      <div className="w-1/2 h-full flex flex-col justify-center px-16 z-10 relative">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <h2 className="text-[6vw] font-black text-white leading-[0.9] font-display uppercase">
            MEET YOUR<br/>
            <span className="text-primary">AI CHEF</span>
          </h2>
          <p className="text-[2vw] text-white/70 mt-6 font-body">
            Real-time cooking help.<br/>
            Aware of your exact pantry.
          </p>
        </motion.div>
      </div>

      <div className="w-1/2 h-full flex flex-col justify-center px-12 relative z-10">
        <motion.div 
            className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6"
            initial={{ opacity: 0, x: 50 }}
            animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            transition={{ duration: 0.8, ease: 'circOut' }}
        >
            <div className="flex justify-end">
                <div className="bg-primary/20 text-primary border border-primary/30 px-6 py-4 rounded-2xl rounded-tr-sm text-[1.5vw] max-w-[80%] font-body">
                    I'm missing eggs for the pancakes. What can I use?
                </div>
            </div>
            
            {phase >= 3 && (
                <motion.div 
                    className="flex justify-start"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                    <div className="bg-white/10 text-white border border-white/20 px-6 py-4 rounded-2xl rounded-tl-sm text-[1.5vw] max-w-[80%] font-body flex items-start gap-4">
                        <div className="w-10 h-10 bg-primary rounded-full flex-shrink-0 flex items-center justify-center font-bold text-black text-lg">AI</div>
                        <div>I see you have <b>applesauce</b> and <b>flaxseed</b> in your pantry! You can substitute 1/4 cup of applesauce for each egg.</div>
                    </div>
                </motion.div>
            )}
        </motion.div>
      </div>
    </motion.div>
  );
}
