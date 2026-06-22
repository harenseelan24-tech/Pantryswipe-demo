import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function Scene3Pantry() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const pantryItems = [
      { name: "Avocados", status: "expiring", days: "2 days", icon: "🥑" },
      { name: "Chicken Breast", status: "fresh", days: "4 days", icon: "🍗" },
      { name: "Garlic", status: "fresh", days: "14 days", icon: "🧄" },
      { name: "Oat Milk", status: "fresh", days: "7 days", icon: "🥛" },
      { name: "Spinach", status: "expiring", days: "1 day", icon: "🥬" },
      { name: "Tomatoes", status: "fresh", days: "5 days", icon: "🍅" },
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[#141210]"
      {...sceneTransitions.fadeBlur}
    >
      <div className="absolute inset-0 z-0">
        <div className="absolute bottom-0 left-0 w-[60vw] h-[60vw] bg-[#4CAF76]/10 rounded-full blur-[120px] pointer-events-none" />
      </div>

      <div className="relative z-10 w-full px-20 flex justify-between items-center h-full">
        
        <div className="w-[45%] flex flex-col">
            <motion.h2 
            className="text-[6.5vw] font-black text-white font-display uppercase leading-[0.9] tracking-tight"
            initial={{ opacity: 0, x: -50 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            >
            Smart<br/>
            <span className="text-[#4CAF76]">Pantry</span>
            </motion.h2>

            <motion.p
                className="mt-8 text-[2vw] text-white/70 font-body leading-tight"
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.8 }}
            >
                Tracks expiration dates automatically.<br/>
                Never waste food again.
            </motion.p>
        </div>

        <div className="w-[50%] relative h-[70vh]">
            <motion.div 
                className="absolute inset-0 grid grid-cols-2 gap-4 content-center"
                initial="hidden"
                animate={phase >= 2 ? "visible" : "hidden"}
                variants={{
                    visible: { transition: { staggerChildren: 0.1 } }
                }}
            >
                {pantryItems.map((item, i) => (
                    <motion.div 
                        key={item.name}
                        className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-3xl flex items-center justify-between"
                        variants={{
                            hidden: { opacity: 0, scale: 0.8, y: 20 },
                            visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300 } }
                        }}
                    >
                        <div className="flex items-center gap-4">
                            <div className="text-[2.5vw]">{item.icon}</div>
                            <div className="flex flex-col">
                                <span className="text-white font-bold text-[1.4vw]">{item.name}</span>
                                <span className={`text-[1vw] font-bold flex items-center gap-1 ${item.status === 'expiring' ? 'text-[#E84040]' : 'text-[#4CAF76]'}`}>
                                    {item.status === 'expiring' ? <AlertCircle size={14}/> : <CheckCircle2 size={14}/>}
                                    {item.days}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </motion.div>

            {phase >= 3 && (
                <motion.div
                    className="absolute top-[10%] -left-[15%] bg-[#F5A623] text-black font-black px-8 py-4 rounded-full text-[1.8vw] shadow-[0_20px_40px_rgba(245,166,35,0.4)] border-4 border-black rotate-[-10deg]"
                    initial={{ opacity: 0, scale: 0, rotate: -30 }}
                    animate={{ opacity: 1, scale: 1, rotate: -10 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                    100% MATCH
                </motion.div>
            )}
        </div>

      </div>
    </motion.div>
  );
}
