// Runs in <head> before first paint to avoid a flash of the wrong theme.
(function () {
  try {
    var saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  } catch (e) { /* storage may be blocked; fall back to system theme */ }
})();
