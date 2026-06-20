/**
 * Layout constants — centralised magic numbers for animation, swipe, and card geometry.
 * Import from here instead of hardcoding values across the codebase.
 */
import { Dimensions } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export { SCREEN_WIDTH, SCREEN_HEIGHT };

// ── Swipe card geometry ──────────────────────────────────────────────────────
/** Fraction of screen width that triggers a horizontal swipe commit */
export const SWIPE_THRESHOLD_RATIO = 0.26;
export const SWIPE_THRESHOLD = SCREEN_WIDTH * SWIPE_THRESHOLD_RATIO;

/** Vertical distance (px, negative = up) that triggers a save swipe */
export const SWIPE_UP_THRESHOLD = -70;

/** Maximum card rotation angle in degrees */
export const MAX_ROTATION_DEG = 12;

/** Base card width = full screen minus a small margin */
export const CARD_BASE_WIDTH = SCREEN_WIDTH - 16;

/** Fraction of card height used for the image section */
export const CARD_IMAGE_HEIGHT_RATIO = 0.62;

// ── Stack card offsets ───────────────────────────────────────────────────────
export const STACK_SCALE    = [1,    0.94, 0.88] as const;
export const STACK_OFFSET_Y = [0,    10,   22  ] as const;
export const STACK_OPACITY  = [1,    0.75, 0.45] as const;
export const STACK_WIDTH_REDUCTION = [0, 20, 36] as const;

// ── Animation durations (ms) ─────────────────────────────────────────────────
export const ANIM_SWIPE_HORIZONTAL_MS  = 240;
export const ANIM_SWIPE_UP_MS          = 260;
export const ANIM_SPRING_RETURN_FRICTION = 7;
export const ANIM_SPRING_RETURN_TENSION  = 50;

/** Tutorial overlay fade duration */
export const ANIM_TUTORIAL_FADE_MS     = 300;
export const ANIM_TUTORIAL_SHOW_MS     = 350;

/** Save toast animation */
export const ANIM_TOAST_SHOW_SPEED     = 20;
export const ANIM_TOAST_BOUNCINESS     = 10;
export const ANIM_TOAST_HIDE_MS        = 250;

// ── Pantry match thresholds (%) ──────────────────────────────────────────────
export const PANTRY_MATCH_HIGH = 70;
export const PANTRY_MATCH_MED  = 40;

// ── Tab bar ──────────────────────────────────────────────────────────────────
export const TAB_BAR_HEIGHT_WEB = 84;

// ── Safe area fallbacks ──────────────────────────────────────────────────────
export const HEADER_TOP_PADDING_WEB    = 67;
export const BOTTOM_PADDING_WEB        = 34;
