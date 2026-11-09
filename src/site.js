(function () {
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  var UTM_STORAGE_KEY = "copyit_utm";
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var SUCCESS = "You're in. Check your inbox for the 10 free ideas.";

  function track(name, params) {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", name, params || {});
  }

  function readStorage(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (error) {
      /* Private mode and full storage can reject writes. The submit still works. */
    }
  }

  function captureUtms() {
    var stored = {};
    var raw = readStorage(UTM_STORAGE_KEY);
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") stored = parsed;
      } catch (error) {
        stored = {};
      }
    }

    var params = new URLSearchParams(window.location.search);
    UTM_KEYS.forEach(function (key) {
      var value = params.get(key);
      if (!value) return;
      var clean = value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 120);
      if (clean) stored[key] = clean;
    });

    writeStorage(UTM_STORAGE_KEY, JSON.stringify(stored));
    return stored;
  }

  function setStatus(status, message, isError) {
    status.textContent = message;
    status.classList.toggle("text-danger", Boolean(isError) && Boolean(message));
    status.classList.toggle("text-ink", Boolean(message) && !isError);
  }

  function bindForm(form) {
    var input = form.querySelector("input[type='email']");
    var button = form.querySelector("button[type='submit']");
    var status = form.querySelector("[data-status]");
    var sourceInput = form.elements.source;
    if (!input || !button || !status || !sourceInput) return;

    var defaultLabel = button.textContent;

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var email = input.value.trim();

      if (!EMAIL_RE.test(email) || email.length > 254) {
        input.setAttribute("aria-invalid", "true");
        setStatus(status, "Enter a valid email address.", true);
        input.focus();
        return;
      }

      input.removeAttribute("aria-invalid");
      setStatus(status, "", false);
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Sending…";

      var payload = {
        email: email,
        source: sourceInput.value,
      };
      var utm = captureUtms();
      UTM_KEYS.forEach(function (key) {
        if (utm[key]) payload[key] = utm[key];
      });
      payload.page_url = window.location.origin + window.location.pathname;

      var sent = false;

      fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then(function (response) {
          return response.json().catch(function () {
            return {};
          }).then(function (data) {
            return { ok: response.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok || !result.data || result.data.ok !== true) {
            var message =
              (result.data && result.data.error) || "Something went wrong. Please try again.";
            setStatus(status, message, true);
            return;
          }

          track(sourceInput.value === "footer" ? "form_submit_footer" : "form_submit_hero");

          if (result.data.redirect === "/thank-you") {
            sent = true;
            window.location.assign("/thank-you");
            return;
          }

          setStatus(status, SUCCESS, false);
          form.reset();
        })
        .catch(function () {
          setStatus(status, "Something went wrong. Please try again.", true);
        })
        .then(function () {
          if (sent) return;
          button.disabled = false;
          button.removeAttribute("aria-busy");
          button.textContent = defaultLabel;
        });
    });
  }

  function bindScroll() {
    var triggers = document.querySelectorAll("[data-scroll-join]");
    triggers.forEach(function (trigger) {
      trigger.addEventListener("click", function (event) {
        var target = document.getElementById("join");
        var input = document.getElementById("email-footer");
        if (!target) return;
        event.preventDefault();
        var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        if (input) input.focus({ preventScroll: true });
      });
    });
  }

  function bindSocial() {
    document.addEventListener("click", function (event) {
      var link = event.target.closest("[data-social]");
      if (!link) return;
      track("social_click", {
        platform: link.getAttribute("data-social") || "",
        location: link.getAttribute("data-location") || "unknown",
      });
    });
  }

  captureUtms();
  document.querySelectorAll("form[data-subscribe]").forEach(bindForm);
  bindScroll();
  bindSocial();
})();
