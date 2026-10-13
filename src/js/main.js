import './menus.js';
import { initHero } from './hero.js';
import { initSettle, initGallery, initAmbient, initTune, initBehind, initFilm } from './sections.js';
import { initReveal } from './reveal.js';

const hero = initHero();
initSettle();
initGallery(hero);
initAmbient();
initTune();
initBehind();
initFilm();
initReveal();
