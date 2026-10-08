import { initTheme } from './theme.js';
import { initHero } from './hero.js';
import { initSettle, initGallery, initAmbient, initTune, initBehind } from './sections.js';
import { initReveal } from './reveal.js';

initTheme();
const hero = initHero();
initSettle();
initGallery(hero);
initAmbient();
initTune();
initBehind();
initReveal();
