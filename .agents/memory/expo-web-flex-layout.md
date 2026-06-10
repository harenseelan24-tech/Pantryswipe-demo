---
name: Expo web flex layout
description: Why flex:1 containers with absolute-only children collapse on Expo web, and how to fix it.
---

## The rule
Never rely on `flex: 1` to expand a container on Expo web when ALL its children are `position: absolute`. Use an explicit, calculated height instead.

**Why:** On Expo web (React Native Web / CSS flexbox), a container whose only children are `position: absolute` has no in-flow children to drive its natural height. Even with `flex: 1`, CSS flex-grow requires the parent to have a defined height through the layout chain. When that chain is broken (e.g. Expo Router screen containers on web don't always propagate an explicit pixel height), the container collapses to 0 — and `onLayout` reports height 0, so the cards never render.

**How to apply:**
1. Calculate deck height from `Dimensions.get('window').height` minus the known heights of all sibling elements (header, search, chips, banner, action buttons, tab bar).
2. Create a normal-flow **wrapper** View with explicit `width` and `height` (the cardStack). Set it to `position: 'relative'`.
3. Inside the wrapper, render cards as `position: absolute, top: 0`. The wrapper IS the in-flow element that gives the parent its height.
4. The outer deckWrapper only needs `alignItems: 'center'` — no `flex: 1` needed.

```tsx
const deckHeight = Math.max(280, SCREEN_HEIGHT - HEADER_H - SEARCH_H - MOOD_H - BANNER_H - ACTION_H - TAB_BAR_H);

<View style={styles.deckWrapper}>           {/* alignItems: center */}
  <View style={{ width: CARD_WIDTH, height: deckHeight, position: 'relative' }}>
    {cards.map(...)}                         {/* position: absolute, top: 0 */}
  </View>
</View>
```
