// Runs before first paint (a classic script in <head>, allowed by script-src 'self'):
// applies the saved colour scheme and the motion preference so nothing flashes.
(function () {
  var d = document.documentElement;
  d.classList.remove('no-js');
  d.classList.add('js');
  try {
    var t = localStorage.getItem('sw-theme');
    if (t === 'light' || t === 'dark') d.setAttribute('data-theme', t);
  } catch (e) { /* storage blocked: follow the system */ }
  if (/[?&]motion=reduced/.test(location.search) || matchMedia('(prefers-reduced-motion: reduce)').matches) d.classList.add('rm');
})();
