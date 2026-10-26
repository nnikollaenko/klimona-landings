/* Klimona landing — language, analytics, lead form */
(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // CONFIG — fill in before going live
  // ---------------------------------------------------------------------------
  var CONFIG = {
    pixelId: "",            // Meta Pixel ID, e.g. "1234567890". Empty = pixel disabled.
    crmWebhookUrl: "",      // Client CRM webhook (POST JSON).
    backupWebhookUrl: "",   // Backup channel: e-mail forwarder / Telegram bot endpoint (POST JSON).
    thankYouPage: ""        // e.g. "thanks.html". Empty = inline success message + Lead here.
  };

  var STORE_LANG = "klimona_lang";
  var STORE_UTM = "klimona_utm";
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];
  var dict = window.I18N;
  var lang = "en";

  // ---------------------------------------------------------------------------
  // Meta Pixel
  // ---------------------------------------------------------------------------
  if (CONFIG.pixelId) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", CONFIG.pixelId);
    window.fbq("track", "PageView");
  }

  function track(event, contentName) {
    if (window.fbq) window.fbq("track", event, contentName ? { content_name: contentName } : {});
  }

  // ViewContent once per product per page view (on block impression or "Get details" click)
  var viewed = {};
  function viewContent(name) {
    if (viewed[name]) return;
    viewed[name] = true;
    track("ViewContent", name);
  }

  // ---------------------------------------------------------------------------
  // i18n
  // ---------------------------------------------------------------------------
  // Glue short Russian words and numbers to the next word so they never hang at line end
  function nbsp(s) {
    for (var i = 0; i < 2; i++) s = s.replace(/(^|[\s(«—-])([А-Яа-яЁё]{1,3}) /g, "$1$2 ");
    return s
      .replace(/(\d) (?=\d{3})/g, "$1 ")
      .replace(/(\d) (м²|км|мин|млн|кв\.|спал|km|min|m²)/g, "$1 $2")
      .replace(/ \+ /g, " + ")
      .replace(/ —/g, " —")
      .replace(/ - /g, " - ");
  }

  function detectLang() {
    try {
      var saved = localStorage.getItem(STORE_LANG);
      if (saved && dict[saved]) return saved;
    } catch (e) {}
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
    return /^(ru|uk|be|kk)/i.test(nav) ? "ru" : "en";
  }

  function applyLang(next) {
    lang = dict[next] ? next : "en";
    var t = dict[lang];
    var fix = lang === "ru" ? nbsp : function (s) { return s; };
    document.documentElement.lang = lang;
    document.title = t[document.body.getAttribute("data-title-key") || "meta.title"];
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = t[el.getAttribute("data-i18n")];
      if (v != null) el.textContent = fix(v);
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      var v = t[el.getAttribute("data-i18n-ph")];
      if (v != null) el.setAttribute("placeholder", v);
    });
    document.querySelectorAll("[data-lang]").forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-lang") === lang);
      b.setAttribute("aria-pressed", b.getAttribute("data-lang") === lang);
    });
    var langField = document.querySelector('input[name="lang"]');
    if (langField) langField.value = lang;
    langHooks.forEach(function (fn) { fn(); });
  }
  var langHooks = [];

  document.querySelectorAll("[data-lang]").forEach(function (b) {
    b.addEventListener("click", function () {
      var l = b.getAttribute("data-lang");
      try { localStorage.setItem(STORE_LANG, l); } catch (e) {}
      applyLang(l);
    });
  });

  applyLang(detectLang());

  // ---------------------------------------------------------------------------
  // UTM → hidden fields (kept for the session, so in-page anchors don't lose them)
  // ---------------------------------------------------------------------------
  var params = new URLSearchParams(location.search);
  var utm = {};
  try { utm = JSON.parse(sessionStorage.getItem(STORE_UTM) || "{}"); } catch (e) {}
  UTM_KEYS.forEach(function (k) { if (params.get(k)) utm[k] = params.get(k); });
  try { sessionStorage.setItem(STORE_UTM, JSON.stringify(utm)); } catch (e) {}

  var form = document.getElementById("leadForm");
  UTM_KEYS.forEach(function (k) { form.elements[k].value = utm[k] || ""; });

  // ---------------------------------------------------------------------------
  // "Get details" → preselect product (and project, on the penthouse page) + ViewContent
  // ---------------------------------------------------------------------------
  function setField(name, value) {
    var el = form.elements[name];
    if (!el || value == null) return;
    el.value = value;
    if (el.tagName === "SELECT") {
      el.classList.remove("is-flash");
      void el.offsetWidth;
      el.classList.add("is-flash");
    }
  }

  document.querySelectorAll("[data-product], [data-project]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setField("product", btn.getAttribute("data-product"));
      setField("project", btn.getAttribute("data-project"));
      viewContent(btn.getAttribute("data-product") || form.elements.product.value);
    });
  });

  // Ad deep link (#river, #villa, …): the target section's data-hash-* preselects the form
  var target = location.hash && document.getElementById(location.hash.slice(1));
  if (target) {
    setField("product", target.getAttribute("data-hash-product"));
    setField("project", target.getAttribute("data-hash-project"));
  }

  // ---------------------------------------------------------------------------
  // Impressions: ViewContent when a product block is half visible; reveal animation
  // ---------------------------------------------------------------------------
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { viewContent(e.target.getAttribute("data-track")); io.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    document.querySelectorAll("[data-track]").forEach(function (el) { io.observe(el); });

    var reveal = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); reveal.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll(".head, .card, .tiles, .timeline, .pay, .kfig, .gal, .split, .plan__wrap, .plans-cta, .formsec__row").forEach(function (el) {
      el.classList.add("reveal");
      reveal.observe(el);
    });
  }

  // ---------------------------------------------------------------------------
  // Lead form
  // ---------------------------------------------------------------------------
  // Contact field follows the chosen channel: WhatsApp / phone call → number with country mask,
  // Telegram → username. Default country comes from the visitor's time zone / browser language.
  var TZ_COUNTRY = {
    "Asia/Nicosia": "cy", "Asia/Famagusta": "cy", "Europe/Moscow": "ru", "Europe/Kaliningrad": "ru", "Europe/Samara": "ru",
    "Europe/Volgograd": "ru", "Asia/Yekaterinburg": "ru", "Asia/Omsk": "ru", "Asia/Novosibirsk": "ru", "Asia/Krasnoyarsk": "ru",
    "Asia/Irkutsk": "ru", "Asia/Vladivostok": "ru", "Europe/Kiev": "ua", "Europe/Kyiv": "ua", "Europe/Minsk": "by",
    "Asia/Almaty": "kz", "Asia/Aqtobe": "kz", "Asia/Qostanay": "kz", "Asia/Jerusalem": "il", "Asia/Tel_Aviv": "il",
    "Europe/London": "gb", "Europe/Dublin": "ie", "Europe/Berlin": "de", "Europe/Paris": "fr", "Europe/Athens": "gr",
    "Europe/Rome": "it", "Europe/Madrid": "es", "Europe/Amsterdam": "nl", "Europe/Zurich": "ch", "Europe/Vienna": "at",
    "Europe/Warsaw": "pl", "Europe/Prague": "cz", "Europe/Istanbul": "tr", "Europe/Bucharest": "ro", "Europe/Sofia": "bg",
    "Europe/Belgrade": "rs", "Europe/Chisinau": "md", "Europe/Riga": "lv", "Europe/Vilnius": "lt", "Europe/Tallinn": "ee",
    "Asia/Dubai": "ae", "Asia/Beirut": "lb", "Asia/Tbilisi": "ge", "Asia/Yerevan": "am", "Asia/Baku": "az",
    "Asia/Tashkent": "uz", "Asia/Bishkek": "kg", "America/New_York": "us", "America/Chicago": "us", "America/Denver": "us",
    "America/Los_Angeles": "us", "America/Toronto": "ca", "Asia/Shanghai": "cn", "Asia/Kolkata": "in"
  };
  var LANG_COUNTRY = { ru: "ru", uk: "ua", be: "by", kk: "kz", he: "il", el: "gr", de: "de", fr: "fr", it: "it", pl: "pl", tr: "tr" };
  function guessCountry() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
    } catch (e) {}
    var loc = (navigator.languages && navigator.languages[0]) || navigator.language || "";
    var region = loc.split("-")[1];
    if (region && region.length === 2) return region.toLowerCase();
    return LANG_COUNTRY[loc.slice(0, 2).toLowerCase()] || "cy";
  }

  var phoneInput = form.elements.phone;
  var tgInput = form.elements.telegram;
  var iti = window.intlTelInput ? window.intlTelInput(phoneInput, {
    initialCountry: guessCountry(),
    separateDialCode: true,
    strictMode: true,
    countrySearch: true,
    countryOrder: ["cy", "ru", "ua", "il", "gb", "de"],
    loadUtils: function () { return import("https://cdn.jsdelivr.net/npm/intl-tel-input@25.15.1/build/js/utils.js"); }
  }) : null;

  var CHANNEL = {
    whatsapp: { label: "form.waLabel", err: "err.phone", mode: "phone" },
    call: { label: "form.callLabel", err: "err.phone", mode: "phone" },
    telegram: { label: "form.tgLabel", err: "err.tg", mode: "telegram" }
  };
  function channel() { return form.querySelector('input[name="messenger"]:checked').value; }
  function updateContactField() {
    var c = CHANNEL[channel()];
    var label = document.getElementById("contactLabel");
    var err = document.getElementById("contactErr");
    label.setAttribute("data-i18n", c.label);
    label.setAttribute("for", c.mode);
    label.textContent = dict[lang][c.label];
    err.setAttribute("data-i18n", c.err);
    err.textContent = dict[lang][c.err];
    form.querySelectorAll(".contact-input").forEach(function (box) { box.hidden = box.getAttribute("data-mode") !== c.mode; });
    document.getElementById("contactField").classList.remove("is-invalid");
  }
  form.querySelectorAll('input[name="messenger"]').forEach(function (r) { r.addEventListener("change", updateContactField); });
  langHooks.push(updateContactField);
  updateContactField();

  function contactValue() {
    if (CHANNEL[channel()].mode === "telegram") {
      var u = tgInput.value.trim().replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "");
      return /^[A-Za-z0-9_]{5,32}$/.test(u) ? "@" + u : null;
    }
    if (iti) {
      var ok = window.intlTelInput.utils ? iti.isValidNumber() : phoneInput.value.replace(/\D/g, "").length >= 6;
      return ok ? iti.getNumber() : null;
    }
    var digits = phoneInput.value.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? "+" + digits : null;
  }

  function setInvalid(input, bad) {
    input.closest(".field").classList.toggle("is-invalid", bad);
    input.setAttribute("aria-invalid", bad);
  }

  [form.elements.name, phoneInput, tgInput].forEach(function (el) {
    el.addEventListener("input", function () { setInvalid(this, false); });
  });
  form.elements.consent.addEventListener("change", function () {
    form.querySelector(".field__err--consent").classList.remove("is-shown");
  });

  function post(url, data) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      keepalive: true
    }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r; });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = form.elements;
    var badName = f.name.value.trim().length < 2;
    var contact = contactValue();
    var contactInput = CHANNEL[channel()].mode === "telegram" ? tgInput : phoneInput;
    setInvalid(f.name, badName);
    setInvalid(contactInput, !contact);
    form.querySelector(".field__err--consent").classList.toggle("is-shown", !f.consent.checked);
    if (badName || !contact || !f.consent.checked) {
      (badName ? f.name : !contact ? contactInput : f.consent).focus();
      return;
    }
    // Honeypot filled → silently pretend success for bots
    if (f.company.value) { showSuccess(); return; }

    var data = {
      name: f.name.value.trim(),
      messenger: channel(),
      phone: CHANNEL[channel()].mode === "phone" ? contact : "",
      telegram: CHANNEL[channel()].mode === "telegram" ? contact : "",
      country: iti && CHANNEL[channel()].mode === "phone" ? iti.getSelectedCountryData().iso2 : "",
      product: f.product.value,
      lang: lang,
      comment: f.comment.value.trim(),
      page_url: location.href.split("#")[0],
      submitted_at: new Date().toISOString()
    };
    if (f.project) data.project = f.project.value;
    UTM_KEYS.forEach(function (k) { data[k] = f[k].value; });

    var btn = form.querySelector('button[type="submit"]');
    var label = btn.querySelector("span");
    btn.disabled = true;
    label.textContent = dict[lang]["form.sending"];
    form.querySelector(".form__error").hidden = true;

    var targets = [CONFIG.crmWebhookUrl, CONFIG.backupWebhookUrl].filter(Boolean);
    var sending = targets.length
      ? Promise.allSettled(targets.map(function (u) { return post(u, data); })).then(function (res) {
          // Success if at least one channel (CRM or backup) accepted the lead
          if (!res.some(function (r) { return r.status === "fulfilled"; })) throw new Error("all channels failed");
        })
      : Promise.resolve(console.warn("[klimona] No webhook configured — lead not sent:", data));

    sending.then(function () {
      if (CONFIG.thankYouPage) {
        location.href = CONFIG.thankYouPage + "?product=" + encodeURIComponent(data.product) + "&lang=" + lang;
        return;
      }
      track("Lead", data.product);
      showSuccess();
    }).catch(function () {
      form.querySelector(".form__error").hidden = false;
      btn.disabled = false;
      label.textContent = dict[lang]["form.submit"];
    });
  });

  function showSuccess() {
    form.hidden = true;
    document.getElementById("success").hidden = false;
  }

  // ---------------------------------------------------------------------------
  // Sticky header turns solid after the top of the hero; mobile CTA shows after the hero
  // and hides while the form is on screen
  // ---------------------------------------------------------------------------
  var siteHead = document.getElementById("siteHead");
  var stickyCta = document.getElementById("stickyCta");
  var hero = document.querySelector(".hero");
  var formSec = document.getElementById("form");
  var formVisible = false;
  function onScroll() {
    var y = window.scrollY;
    if (siteHead) siteHead.classList.toggle("is-solid", y > 40);
    if (stickyCta && hero) stickyCta.classList.toggle("is-shown", y > hero.offsetHeight * 0.6 && !formVisible);
  }
  if ("IntersectionObserver" in window && formSec) {
    new IntersectionObserver(function (entries) {
      formVisible = entries[0].isIntersecting;
      onScroll();
    }, { threshold: 0.15 }).observe(formSec);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---------------------------------------------------------------------------
  // Sliders: one slide at a time, arrows + counter (no swipe-scrolling)
  // ---------------------------------------------------------------------------
  document.querySelectorAll("[data-slider]").forEach(function (sl) {
    var track = sl.querySelector(".slider__track");
    var slides = track.children.length;
    var prev = sl.querySelector("[data-prev]"), next = sl.querySelector("[data-next]");
    var count = sl.querySelector(".slider__count");
    var i = 0;
    function go(n) {
      i = Math.max(0, Math.min(slides - 1, n));
      track.style.transform = "translateX(" + (-100 * i) + "%)";
      count.textContent = (i + 1) + " / " + slides;
      prev.disabled = i === 0;
      next.disabled = i === slides - 1;
    }
    prev.addEventListener("click", function () { go(i - 1); });
    next.addEventListener("click", function () { go(i + 1); });
    go(0);
  });
})();
