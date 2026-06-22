import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1Intro } from './video_scenes/Scene1Intro';
import { Scene2Swipe } from './video_scenes/Scene2Swipe';
import { Scene3Pantry } from './video_scenes/Scene3Pantry';
import { Scene4AIChef } from './video_scenes/Scene4AIChef';
import { Scene5Party } from './video_scenes/Scene5Party';
import { Scene6Cook } from './video_scenes/Scene6Cook';
import { Scene7Outro } from './video_scenes/Scene7Outro';

export const SCENE_DURATIONS: Record<string, number> = {
  intro: 3500,
  swipe: 4500,
  pantry: 4500,
  aichef: 4000,
  party: 4500,
  cook: 4000,
  outro: 4000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  intro: Scene1Intro,
  swipe: Scene2Swipe,
  pantry: Scene3Pantry,
  aichef: Scene4AIChef,
  party: Scene5Party,
  cook: Scene6Cook,
  outro: Scene7Outro,
};

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  return (
    <div className="w-full h-screen overflow-hidden relative bg-[#141210]">
      {/* Global Background Layer */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute w-[80vw] h-[80vw] rounded-full blur-[120px] opacity-20"
          style={{ background: 'radial-gradient(circle, var(--color-primary), transparent)' }}
          animate={{
            x: ['-20%', '30%', '-10%'],
            y: ['-10%', '40%', '10%'],
            scale: [1, 1.2, 0.9]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[60vw] h-[60vw] rounded-full blur-[100px] opacity-15 right-0 bottom-0"
          style={{ background: 'radial-gradient(circle, var(--color-secondary), transparent)' }}
          animate={{
            x: ['10%', '-20%', '0%'],
            y: ['10%', '-30%', '20%'],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>
    </div>
  );
}
