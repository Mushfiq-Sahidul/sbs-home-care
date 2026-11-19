/*
  SBS Home Care: shared 3D / "4D" effects (loaded on every page)
  - Depth reveal with stagger (sections glide forward as they appear)
  - Card tilt + moving light glare on hover (mouse devices only)
  - Gentle scroll parallax on decorative layers and photo banners
  - Gold scroll-progress bar
  - Video deck (Why section): autoplay in a 3D stack, advances when a video ends, tabs, tilt, graceful placeholder if a file is missing
  Everything respects "reduce motion" settings and switches off on touch screens where noted.
*/
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };

  /* ---------------------------------------------------------- 1. Depth reveal */
  (function () {
    var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!items.length) return;

    // stagger siblings (max 6 steps) so grids cascade instead of popping in together
    var counts = new Map();
    items.forEach(function (el) {
      var parent = el.parentElement;
      var i = counts.get(parent) || 0;
      counts.set(parent, i + 1);
      el.style.setProperty('--d', Math.min(i, 6) * 90 + 'ms');
    });

    // once an element has appeared, hand control back to the component's own hover styles
    function finish(el) {
      setTimeout(function () {
        el.classList.remove('reveal', 'is-visible');
        el.style.removeProperty('--d');
      }, 1700);
    }

    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); finish(el); });
      return;
    }

    var pending = items.slice();
    function show(el) {
      if (el.classList.contains('is-visible')) return;
      el.classList.add('is-visible');
      io.unobserve(el);
      finish(el);
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) show(entry.target); });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });

    // Safety net: if a very fast scroll skips an element, never leave it invisible.
    // Anything the visitor has already reached or scrolled past is revealed.
    var sweeping = false;
    function sweep() {
      sweeping = false;
      var limit = window.innerHeight * 0.92;
      pending = pending.filter(function (el) {
        if (el.classList.contains('is-visible')) return false;
        if (el.getBoundingClientRect().top < limit) { show(el); return false; }
        return true;
      });
    }
    function onScroll() { if (!sweeping && pending.length) { sweeping = true; raf(sweep); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  })();

  /* ---------------------------------------------------------- 2. Card tilt + glare */
  if (finePointer && !reduce) {
    var tiltSelector = '.tile, .blog-card, .related-card, .who-card, .panel, .why-glass, .process-step, .photo-frame';
    Array.prototype.forEach.call(document.querySelectorAll(tiltSelector), function (el) {
      var large = el.classList.contains('photo-frame');
      var max = parseFloat(el.getAttribute('data-tilt')) || (large ? 5 : 8);
      var pose = parseFloat(el.getAttribute('data-pose')) || 0;          // resting angle (video cards face inward)
      var lifts = el.classList.contains('tile') || el.classList.contains('blog-card') || el.classList.contains('related-card');
      var lift = lifts ? -6 : (large ? 0 : -3);
      var frame = null;
      var lastEvent = null;

      el.setAttribute('data-tilt-on', '');
      var glare = document.createElement('span');
      glare.className = 'tilt-glare';
      glare.setAttribute('aria-hidden', 'true');
      el.appendChild(glare);

      function update() {
        frame = null;
        var r = el.getBoundingClientRect();
        var px = (lastEvent.clientX - r.left) / r.width;
        var py = (lastEvent.clientY - r.top) / r.height;
        var ry = (px - 0.5) * 2 * max;
        var rx = -(py - 0.5) * 2 * max;
        el.style.transform = 'perspective(1000px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + (ry + pose).toFixed(2) +
          'deg) translateY(' + lift + 'px)';
        el.style.setProperty('--mx', ((px - 0.5) * 2).toFixed(3));
        el.style.setProperty('--my', ((py - 0.5) * 2).toFixed(3));
        el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      }

      el.addEventListener('pointerenter', function () { el.classList.add('is-tilting'); });
      el.addEventListener('pointermove', function (e) {
        lastEvent = e;
        if (!frame) frame = raf(update);
      });
      el.addEventListener('pointerleave', function () {
        el.classList.remove('is-tilting');
        el.style.transform = pose ? 'perspective(1000px) rotateY(' + pose + 'deg)' : '';
        el.style.setProperty('--mx', 0);
        el.style.setProperty('--my', 0);
      });
    });
  }

  /* ---------------------------------------------------------- 3. Scroll parallax (the "4th dimension") */
  (function () {
    var layers = [['.photo-wrap', 0.08], ['.why-3d-bg', 0.1], ['.photo-cta-bg', 0.1]];
    var targets = [];
    layers.forEach(function (l) {
      Array.prototype.forEach.call(document.querySelectorAll(l[0]), function (el) { targets.push({ el: el, f: l[1] }); });
    });

    var bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    var ticking = false;
    function update() {
      ticking = false;
      var vh = window.innerHeight;
      var max = document.documentElement.scrollHeight - vh;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
      if (reduce) return;
      targets.forEach(function (t) {
        var r = t.el.getBoundingClientRect();
        if (r.bottom < -120 || r.top > vh + 120) return;
        var offset = (r.top + r.height / 2 - vh / 2) * -t.f;
        offset = Math.max(-45, Math.min(45, offset));
        t.el.style.setProperty('--py', offset.toFixed(1) + 'px');
      });
    }
    function onScroll() { if (!ticking) { ticking = true; raf(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  })();

  /* ---------------------------------------------------------- 4. Video deck (Why section) */
  (function () {
    var deck = document.getElementById('vdeck');
    if (!deck) return;
    var wrap = deck.parentElement;
    var cards = Array.prototype.slice.call(deck.querySelectorAll('.vcard3d'));
    var tabs = Array.prototype.slice.call(wrap.querySelectorAll('.vtab'));
    var n = cards.length;
    var current = 0, userPaused = false, visible = false;
    var conn = navigator.connection || {};
    var autoplayOK = !reduce && !conn.saveData;      // respects "reduce motion" and data-saver

    function video(i) { return cards[i].querySelector('video'); }
    function hit(i) { return cards[i].querySelector('.vhit'); }
    function label(i) { return cards[i].getAttribute('data-label') || 'video'; }

    function sync() {
      cards.forEach(function (card, i) {
        var pos = (i - current + n) % n;
        card.setAttribute('data-pos', pos);
        var v = video(i), b = hit(i);
        if (b) b.setAttribute('aria-label', (pos === 0 ? (v && !v.paused ? 'Pause video: ' : 'Play video: ') : 'Show video: ') + label(i));
      });
      tabs.forEach(function (t, i) { t.setAttribute('aria-current', i === current ? 'true' : 'false'); });
    }
    function play(i) {
      var v = video(i);
      if (!v || cards[i].classList.contains('is-empty')) return;
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    }
    function go(i) {
      current = ((i % n) + n) % n;
      cards.forEach(function (card, k) {
        var v = video(k);
        if (k !== current && v) { v.pause(); try { v.currentTime = 0; } catch (e) {} card.style.setProperty('--p', 0); }
      });
      sync();
      if (visible && autoplayOK && !userPaused) play(current);
    }

    cards.forEach(function (card, i) {
      var v = video(i);
      if (!v) return;
      v.muted = true;
      v.removeAttribute('loop');
      v.addEventListener('timeupdate', function () {
        if (i === current && v.duration) card.style.setProperty('--p', (v.currentTime / v.duration).toFixed(3));
      });
      v.addEventListener('ended', function () {
        if (i !== current) return;
        card.style.setProperty('--p', 1);
        if (n > 1) go(current + 1); else { v.currentTime = 0; play(i); }
      });
      v.addEventListener('play', sync);
      v.addEventListener('pause', sync);

      function empty() { card.classList.add('is-empty'); }
      var source = v.querySelector('source');
      if (source) source.addEventListener('error', empty);
      v.addEventListener('error', empty);
      // A video that is genuinely missing reports an error. (Do not trust networkState right at page start:
      // the browser has not begun fetching yet, so it briefly reads "no source" even for good files.)
      function check() { if (v.error || (v.networkState === 3 && v.readyState === 0)) empty(); }
      window.addEventListener('load', function () { setTimeout(check, 600); });
      setTimeout(check, 2500);
      v.addEventListener('loadedmetadata', function () { card.classList.remove('is-empty'); });   // proof it loaded

      var b = hit(i);
      if (b) b.addEventListener('click', function () {
        if (i !== current) { userPaused = false; go(i); play(i); return; }       // back card: bring it forward
        if (v.paused) { userPaused = false; play(i); } else { userPaused = true; v.pause(); }
      });
    });
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { userPaused = false; go(i); play(i); });
    });

    // play only while the section is on screen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          visible = entry.isIntersecting;
          if (visible) { if (autoplayOK && !userPaused) play(current); }
          else { var v = video(current); if (v) v.pause(); }
        });
      }, { threshold: 0.35 }).observe(wrap);
    }

    // gentle 3D tilt that follows the mouse (desktop only)
    if (finePointer && !reduce) {
      var frame = null, ev = null;
      wrap.addEventListener('pointermove', function (e) {
        ev = e;
        if (frame) return;
        frame = raf(function () {
          frame = null;
          var r = wrap.getBoundingClientRect();
          var px = (ev.clientX - r.left) / r.width, py = (ev.clientY - r.top) / r.height;
          deck.style.setProperty('--ry', (7 - (px - 0.5) * 12).toFixed(2) + 'deg');
          deck.style.setProperty('--rx', (3 + (py - 0.5) * 8).toFixed(2) + 'deg');
        });
      });
      wrap.addEventListener('pointerleave', function () {
        deck.style.removeProperty('--ry');
        deck.style.removeProperty('--rx');
      });
    }
    sync();
  })();
})();
