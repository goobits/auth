import 'BackupCodesModal.svelte.css';
import 'svelte/internal/disclose-version';
import * as $ from 'svelte/internal/client';
import { onMount, onDestroy } from 'svelte';
import 'AuthNotification.svelte.css';
import 'MigrationNotification.svelte.css';
import 'svelte/internal/flags/legacy';
import { derived, writable } from 'svelte/store';
import { browser } from '$app/environment';

// src/ui/BackupCodesModal.svelte
var root_2 = $.from_html(`<p class="warning-text svelte-kc44x5">Your previous backup codes have been invalidated.</p>`);
var root_3 = $.from_html(`<div class="backup-code svelte-kc44x5"><span class="code-number svelte-kc44x5"></span> <span class="code-value svelte-kc44x5"> </span></div>`);
var root_4 = $.from_html(`<p class="copy-status svelte-kc44x5"> </p>`);
var root_1 = $.from_html(`<div class="modal-overlay svelte-kc44x5" role="presentation"><div class="modal-content svelte-kc44x5" tabindex="-1" role="dialog" aria-modal="true"><div class="modal-header svelte-kc44x5"><h2 class="svelte-kc44x5"> </h2> <button type="button" class="close-button svelte-kc44x5" aria-label="Close dialog">\xD7</button></div> <div class="modal-body svelte-kc44x5"><div class="warning-box svelte-kc44x5"><div class="icon svelte-kc44x5">!</div> <div><strong>Important:</strong> <p>Save these backup codes in a secure location. Each code can only be used once.</p> <!></div></div> <div class="backup-codes-container svelte-kc44x5"></div> <div class="action-buttons svelte-kc44x5"><button type="button" class="secondary-button svelte-kc44x5">Download Codes</button> <button type="button" class="secondary-button svelte-kc44x5">Copy to Clipboard</button></div> <!> <div class="acknowledgment svelte-kc44x5"><label class="checkbox-label svelte-kc44x5"><input type="checkbox"/> <span>I have saved these backup codes in a secure location</span></label></div></div> <div class="modal-footer svelte-kc44x5"><button type="button" class="primary-button svelte-kc44x5">Continue</button></div></div></div>`);
function BackupCodesModal($$anchor, $$props) {
  $.push($$props, true);
  let visible = $.prop($$props, "visible", 15, false), backupCodes = $.prop($$props, "backupCodes", 19, () => []), isNewEnrollment = $.prop($$props, "isNewEnrollment", 3, false), onClose = $.prop($$props, "onClose", 3, () => {
  }), onAcknowledge = $.prop($$props, "onAcknowledge", 3, () => {
  });
  let acknowledged = $.state(false);
  let copyStatus = $.state("");
  let modalEl = $.state(null);
  function handleDownload() {
    if (!backupCodes() || backupCodes().length === 0) return;
    const content = `Auth Backup Codes
Generated: ${(/* @__PURE__ */ new Date()).toLocaleString()}

IMPORTANT: Keep these codes in a safe place!
Each code can only be used once.

${backupCodes().map((code, i) => `${i + 1}. ${code}`).join("\n")}

If you lose access to your authenticator app, you can use one of these
backup codes to sign in to your account.
`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  async function handleCopyToClipboard() {
    if (!backupCodes() || backupCodes().length === 0) return;
    try {
      await navigator.clipboard.writeText(backupCodes().join("\n"));
      $.set(copyStatus, "Copied to clipboard.");
    } catch {
      $.set(copyStatus, "Copy failed. Please download instead.");
    }
  }
  function handleAcknowledge() {
    if (!$.get(acknowledged)) return;
    visible(false);
    onAcknowledge()();
    onClose()();
  }
  function close() {
    visible(false);
    onClose()();
  }
  function handleKeydown(e) {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = $.get(modalEl)?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  onMount(() => {
    $.set(acknowledged, false);
    $.set(copyStatus, "");
    if (visible()) {
      setTimeout(
        () => {
          $.get(modalEl)?.focus();
        },
        0
      );
    }
    const onKey = (e) => handleKeydown(e);
    window.addEventListener("keydown", onKey);
    onDestroy(() => window.removeEventListener("keydown", onKey));
  });
  var fragment = $.comment();
  var node = $.first_child(fragment);
  {
    var consequent_2 = ($$anchor2) => {
      var div = root_1();
      var div_1 = $.child(div);
      var div_2 = $.child(div_1);
      var h2 = $.child(div_2);
      var text3 = $.child(h2, true);
      $.reset(h2);
      var button = $.sibling(h2, 2);
      $.reset(div_2);
      var div_3 = $.sibling(div_2, 2);
      var div_4 = $.child(div_3);
      var div_5 = $.sibling($.child(div_4), 2);
      var node_1 = $.sibling($.child(div_5), 4);
      {
        var consequent = ($$anchor3) => {
          var p = root_2();
          $.append($$anchor3, p);
        };
        $.if(node_1, ($$render) => {
          if (!isNewEnrollment()) $$render(consequent);
        });
      }
      $.reset(div_5);
      $.reset(div_4);
      var div_6 = $.sibling(div_4, 2);
      $.each(div_6, 21, backupCodes, $.index, ($$anchor3, code, index3) => {
        var div_7 = root_3();
        var span = $.child(div_7);
        span.textContent = `${index3 + 1}.`;
        var span_1 = $.sibling(span, 2);
        var text_1 = $.child(span_1, true);
        $.reset(span_1);
        $.reset(div_7);
        $.template_effect(() => $.set_text(text_1, $.get(code)));
        $.append($$anchor3, div_7);
      });
      $.reset(div_6);
      var div_8 = $.sibling(div_6, 2);
      var button_1 = $.child(div_8);
      var button_2 = $.sibling(button_1, 2);
      $.reset(div_8);
      var node_2 = $.sibling(div_8, 2);
      {
        var consequent_1 = ($$anchor3) => {
          var p_1 = root_4();
          var text_2 = $.child(p_1, true);
          $.reset(p_1);
          $.template_effect(() => $.set_text(text_2, $.get(copyStatus)));
          $.append($$anchor3, p_1);
        };
        $.if(node_2, ($$render) => {
          if ($.get(copyStatus)) $$render(consequent_1);
        });
      }
      var div_9 = $.sibling(node_2, 2);
      var label = $.child(div_9);
      var input = $.child(label);
      $.remove_input_defaults(input);
      $.next(2);
      $.reset(label);
      $.reset(div_9);
      $.reset(div_3);
      var div_10 = $.sibling(div_3, 2);
      var button_3 = $.child(div_10);
      $.reset(div_10);
      $.reset(div_1);
      $.bind_this(div_1, ($$value) => $.set(modalEl, $$value), () => $.get(modalEl));
      $.reset(div);
      $.template_effect(() => {
        $.set_text(text3, isNewEnrollment() ? "Save Your Backup Codes" : "New Backup Codes Generated");
        button_3.disabled = !$.get(acknowledged);
      });
      $.delegated("click", button, close);
      $.delegated("click", button_1, handleDownload);
      $.delegated("click", button_2, handleCopyToClipboard);
      $.bind_checked(input, () => $.get(acknowledged), ($$value) => $.set(acknowledged, $$value));
      $.delegated("click", button_3, handleAcknowledge);
      $.append($$anchor2, div);
    };
    $.if(node, ($$render) => {
      if (visible()) $$render(consequent_2);
    });
  }
  $.append($$anchor, fragment);
  $.pop();
}
$.delegate(["click"]);
var root_22 = $.from_html(`<button type="button" class="cta-button svelte-z3i0j9"> </button>`);
var root_12 = $.from_html(`<div class="auth-notification svelte-z3i0j9" role="alert"><div class="notification-content svelte-z3i0j9"><div class="notification-icon svelte-z3i0j9"><span>\u2713</span></div> <div class="notification-body svelte-z3i0j9"><h3 class="svelte-z3i0j9"> </h3> <p class="svelte-z3i0j9"> </p> <!></div> <button type="button" class="close-button svelte-z3i0j9" aria-label="Close notification">\xD7</button></div></div>`);
function AuthNotification($$anchor, $$props) {
  $.push($$props, true);
  let visible = $.prop($$props, "visible", 15, false), title = $.prop($$props, "title", 3, "Notice"), message = $.prop($$props, "message", 3, ""), onClose = $.prop($$props, "onClose", 3, () => {
  }), ctaLabel = $.prop($$props, "ctaLabel", 3, null), onCta = $.prop($$props, "onCta", 3, () => {
  });
  function close() {
    visible(false);
    onClose()();
  }
  var fragment = $.comment();
  var node = $.first_child(fragment);
  {
    var consequent_1 = ($$anchor2) => {
      var div = root_12();
      var div_1 = $.child(div);
      var div_2 = $.sibling($.child(div_1), 2);
      var h3 = $.child(div_2);
      var text3 = $.child(h3, true);
      $.reset(h3);
      var p = $.sibling(h3, 2);
      var text_1 = $.child(p, true);
      $.reset(p);
      var node_1 = $.sibling(p, 2);
      {
        var consequent = ($$anchor3) => {
          var button = root_22();
          var text_2 = $.child(button, true);
          $.reset(button);
          $.template_effect(() => $.set_text(text_2, ctaLabel()));
          $.delegated("click", button, function(...$$args) {
            onCta()?.apply(this, $$args);
          });
          $.append($$anchor3, button);
        };
        $.if(node_1, ($$render) => {
          if (ctaLabel()) $$render(consequent);
        });
      }
      $.reset(div_2);
      var button_1 = $.sibling(div_2, 2);
      $.reset(div_1);
      $.reset(div);
      $.template_effect(() => {
        $.set_text(text3, title());
        $.set_text(text_1, message());
      });
      $.delegated("click", button_1, close);
      $.append($$anchor2, div);
    };
    $.if(node, ($$render) => {
      if (visible()) $$render(consequent_1);
    });
  }
  $.append($$anchor, fragment);
  $.pop();
}
$.delegate(["click"]);
var root_32 = $.from_html(`<div class="backup-codes-notice svelte-1ds9m61"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="svelte-1ds9m61"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> <div><strong class="svelte-1ds9m61">Important:</strong> New backup codes have been generated. <button type="button" class="download-button svelte-1ds9m61">Download Backup Codes</button></div></div>`);
var root_13 = $.from_html(`<div class="auth-migration-notification svelte-1ds9m61" role="alert"><div class="notification-content svelte-1ds9m61"><div class="notification-icon success svelte-1ds9m61"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div> <div class="notification-body svelte-1ds9m61"><h3 class="svelte-1ds9m61">Account Upgraded</h3> <p class="svelte-1ds9m61">Your account has been successfully upgraded to our new authentication system. <!></p> <!></div> <button type="button" class="close-button svelte-1ds9m61" aria-label="Close notification"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div></div>`);
function MigrationNotification($$anchor, $$props) {
  $.push($$props, true);
  let visible = $.prop($$props, "visible", 15, false), migrationSuccess = $.prop($$props, "migrationSuccess", 3, false), backupCodesRegenerated = $.prop($$props, "backupCodesRegenerated", 3, false), newBackupCodes = $.prop($$props, "newBackupCodes", 3, null), onAcknowledge = $.prop($$props, "onAcknowledge", 3, () => {
  }), onDownloadBackupCodes = $.prop($$props, "onDownloadBackupCodes", 3, () => {
  });
  function handleAcknowledge() {
    visible(false);
    onAcknowledge()();
  }
  function handleDownloadCodes() {
    if (newBackupCodes() && newBackupCodes().length > 0) {
      onDownloadBackupCodes()(newBackupCodes());
    }
  }
  var fragment = $.comment();
  var node = $.first_child(fragment);
  {
    var consequent_2 = ($$anchor2) => {
      var div = root_13();
      var div_1 = $.child(div);
      var div_2 = $.sibling($.child(div_1), 2);
      var p = $.sibling($.child(div_2), 2);
      var node_1 = $.sibling($.child(p));
      {
        var consequent = ($$anchor3) => {
          var text3 = $.text("Your MFA backup codes have been regenerated.");
          $.append($$anchor3, text3);
        };
        $.if(node_1, ($$render) => {
          if (backupCodesRegenerated()) $$render(consequent);
        });
      }
      $.reset(p);
      var node_2 = $.sibling(p, 2);
      {
        var consequent_1 = ($$anchor3) => {
          var div_3 = root_32();
          var div_4 = $.sibling($.child(div_3), 2);
          var button = $.sibling($.child(div_4), 2);
          $.reset(div_4);
          $.reset(div_3);
          $.delegated("click", button, handleDownloadCodes);
          $.append($$anchor3, div_3);
        };
        $.if(node_2, ($$render) => {
          if (backupCodesRegenerated() && newBackupCodes() && newBackupCodes().length > 0) $$render(consequent_1);
        });
      }
      $.reset(div_2);
      var button_1 = $.sibling(div_2, 2);
      $.reset(div_1);
      $.reset(div);
      $.delegated("click", button_1, handleAcknowledge);
      $.append($$anchor2, div);
    };
    $.if(node, ($$render) => {
      if (visible() && migrationSuccess()) $$render(consequent_2);
    });
  }
  $.append($$anchor, fragment);
  $.pop();
}
$.delegate(["click"]);
var DEFAULT_ENDPOINTS = {
  login: "/auth/login",
  register: "/auth/register",
  logout: "/auth/logout",
  session: "/auth/session",
  updateProfile: "/auth/profile"
};
var mergeHeaders = (base, extra) => ({
  ...base,
  ...extra || {}
});
function createAuthStore(options = {}) {
  const {
    baseUrl = "",
    endpoints = {},
    publishableApiKey = null,
    fetcher = fetch,
    autoCheck = true
  } = options;
  const resolvedEndpoints = { ...DEFAULT_ENDPOINTS, ...endpoints };
  const { subscribe, set: set4, update } = writable({
    user: null,
    session: null,
    isAuthenticated: false,
    loading: false,
    error: null
  });
  const buildHeaders = (extra) => {
    const base = publishableApiKey ? { "x-publishable-api-key": publishableApiKey } : {};
    return mergeHeaders(base, extra);
  };
  const applyAuthSuccess = (result) => {
    const user2 = result["customer"] || result["user"] || null;
    update((state2) => ({
      ...state2,
      user: user2,
      session: result["session"] || null,
      isAuthenticated: true,
      loading: false
    }));
    return { success: true, user: user2 };
  };
  const applyAuthFailure = (error) => {
    const message = typeof error === "string" ? error : error?.message || "Request failed";
    update((state2) => ({ ...state2, loading: false, error: message }));
    return { success: false, error: message };
  };
  const postAuth = async (path, payload) => {
    const response = await fetcher(`${baseUrl}${path}`, {
      method: "POST",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
      body: payload ? JSON.stringify(payload) : null
    });
    try {
      return await response.json();
    } catch {
      return { success: response.ok };
    }
  };
  const api = {
    subscribe,
    async login(email, password) {
      update((state2) => ({ ...state2, loading: true, error: null }));
      try {
        const result = await postAuth(resolvedEndpoints.login, { email, password });
        if (result.twoFactorRequired) {
          update((state2) => ({ ...state2, loading: false }));
          return { success: true, mfaRequired: true };
        }
        if (!result.success) {
          return applyAuthFailure(result.error || "Login failed");
        }
        return applyAuthSuccess(result);
      } catch (error) {
        return applyAuthFailure(error?.message || "Login failed");
      }
    },
    async register(data) {
      update((state2) => ({ ...state2, loading: true, error: null }));
      try {
        let registrationData;
        if (typeof data === "object" && !data["name"]) {
          const { first_name, last_name, email, password, phone } = data;
          registrationData = { email, password, first_name, last_name, phone };
        } else if (typeof data === "object") {
          registrationData = data;
        } else {
          const email = arguments[0];
          const password = arguments[1];
          const name = arguments[2];
          registrationData = { email, password, name };
        }
        const result = await postAuth(resolvedEndpoints.register, registrationData);
        if (!result.success) {
          return applyAuthFailure(result.error || "Registration failed");
        }
        return applyAuthSuccess(result);
      } catch (error) {
        return applyAuthFailure(error?.message || "Registration failed");
      }
    },
    async logout() {
      update((state2) => ({ ...state2, loading: true, error: null }));
      try {
        const result = await postAuth(resolvedEndpoints.logout);
        set4({
          user: null,
          session: null,
          isAuthenticated: false,
          loading: false,
          error: null
        });
        return { success: result.success || true };
      } catch {
        set4({
          user: null,
          session: null,
          isAuthenticated: false,
          loading: false,
          error: null
        });
        return { success: true };
      }
    },
    async checkSession() {
      if (!browser) return;
      update((state2) => ({ ...state2, loading: true }));
      try {
        const response = await fetcher(`${baseUrl}${resolvedEndpoints.session}`, {
          method: "GET",
          headers: buildHeaders(),
          credentials: "include"
        });
        if (response.status === 204 || !response.ok) {
          update((state2) => ({ ...state2, loading: false }));
          return;
        }
        const result = await response.json();
        if (result["success"] && result["user"]) {
          update((state2) => ({
            ...state2,
            user: result["user"],
            session: result["session"] || null,
            isAuthenticated: true,
            loading: false
          }));
        } else {
          update((state2) => ({ ...state2, loading: false }));
        }
      } catch {
        update((state2) => ({ ...state2, loading: false }));
      }
    },
    async updateProfile(data) {
      update((state2) => ({ ...state2, loading: true, error: null }));
      try {
        const response = await fetcher(`${baseUrl}${resolvedEndpoints.updateProfile}`, {
          method: "POST",
          headers: buildHeaders({ "Content-Type": "application/json" }),
          credentials: "include",
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!result["success"]) {
          update((state2) => ({
            ...state2,
            loading: false,
            error: result["error"] || "Profile update failed"
          }));
          return { success: false, error: result["error"] || "Profile update failed" };
        }
        update((state2) => ({
          ...state2,
          user: { ...state2["user"] ?? {}, ...result["user"] },
          loading: false
        }));
        return { success: true, user: result["user"] };
      } catch (error) {
        const message = error?.message || "Profile update failed";
        update((state2) => ({ ...state2, loading: false, error: message }));
        return { success: false, error: message };
      }
    },
    async refreshSession() {
      return this.checkSession();
    }
  };
  if (browser && autoCheck) {
    api.checkSession();
  }
  return api;
}
var auth = createAuthStore();
var isAuthenticated = derived(auth, ($auth) => $auth.isAuthenticated);
var user = derived(auth, ($auth) => $auth.user);

// src/ui/AuthGate.svelte
function AuthGate($$anchor, $$props) {
  $.push($$props, false);
  const $auth = () => $.store_get(auth, "$auth", $$stores);
  const [$$stores, $$cleanup] = $.setup_stores();
  const resolvedUser = $.mutable_source();
  const resolvedLoading = $.mutable_source();
  let user2 = $.prop($$props, "user", 8, void 0);
  let loading = $.prop($$props, "loading", 8, void 0);
  let onUnauthenticated = $.prop($$props, "onUnauthenticated", 8, null);
  $.legacy_pre_effect(() => ($.deep_read_state(user2()), $auth()), () => {
    $.set(resolvedUser, user2() ?? $auth().user ?? null);
  });
  $.legacy_pre_effect(() => ($.deep_read_state(loading()), $auth()), () => {
    $.set(resolvedLoading, loading() ?? $auth().loading ?? false);
  });
  $.legacy_pre_effect(
    () => ($.get(resolvedLoading), $.get(resolvedUser), $.deep_read_state(onUnauthenticated())),
    () => {
      if (!$.get(resolvedLoading) && !$.get(resolvedUser) && typeof onUnauthenticated() === "function") {
        onUnauthenticated()();
      }
    }
  );
  $.legacy_pre_effect_reset();
  $.init();
  var fragment = $.comment();
  var node = $.first_child(fragment);
  {
    var consequent = ($$anchor2) => {
      var fragment_1 = $.comment();
      var node_1 = $.first_child(fragment_1);
      $.slot(node_1, $$props, "loading", {}, ($$anchor3) => {
        var text3 = $.text("Loading\u2026");
        $.append($$anchor3, text3);
      });
      $.append($$anchor2, fragment_1);
    };
    var consequent_1 = ($$anchor2) => {
      var fragment_2 = $.comment();
      var node_2 = $.first_child(fragment_2);
      $.slot(node_2, $$props, "default", {}, null);
      $.append($$anchor2, fragment_2);
    };
    var alternate = ($$anchor2) => {
      var fragment_3 = $.comment();
      var node_3 = $.first_child(fragment_3);
      $.slot(node_3, $$props, "unauthenticated", {}, ($$anchor3) => {
        var text_1 = $.text("Sign in required.");
        $.append($$anchor3, text_1);
      });
      $.append($$anchor2, fragment_3);
    };
    $.if(node, ($$render) => {
      if ($.get(resolvedLoading)) $$render(consequent);
      else if ($.get(resolvedUser)) $$render(consequent_1, 1);
      else $$render(alternate, false);
    });
  }
  $.append($$anchor, fragment);
  $.pop();
  $$cleanup();
}
var root_14 = $.from_html(`<p class="auth-session-error"> </p>`);
var root_23 = $.from_html(`<p class="auth-session-loading">Loading sessions\u2026</p>`);
var root_5 = $.from_html(`<button class="auth-session-revoke" type="button"> </button>`);
var root_42 = $.from_html(`<li class="auth-session-item"><div><p class="auth-session-meta"> </p> <p class="auth-session-sub"> </p></div> <!></li>`);
var root_33 = $.from_html(`<ul class="auth-session-list" aria-label="Active sessions"></ul>`);
var root_6 = $.from_html(`<p class="auth-session-empty">No sessions found.</p>`);
var root = $.from_html(`<div class="auth-session-manager"><!> <!></div>`);
function SessionManager($$anchor, $$props) {
  $.push($$props, false);
  let listEndpoint = $.prop($$props, "listEndpoint", 8, "/auth/sessions");
  let revokeEndpoint = $.prop($$props, "revokeEndpoint", 8, "/auth/sessions");
  let fetcher = $.prop($$props, "fetcher", 8, fetch);
  let headers = $.prop($$props, "headers", 24, () => ({}));
  let sessions = $.prop($$props, "sessions", 12, null);
  let loading = $.mutable_source(false);
  let revokingId = $.mutable_source(null);
  let error = $.mutable_source(null);
  async function loadSessions() {
    $.set(loading, true);
    $.set(error, null);
    try {
      const response = await fetcher()(listEndpoint(), { headers: headers() });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load sessions");
      }
      sessions(data.sessions);
    } catch (err) {
      $.set(error, err.message);
    } finally {
      $.set(loading, false);
    }
  }
  async function revoke(sessionId) {
    $.set(revokingId, sessionId);
    $.set(error, null);
    try {
      const response = await fetcher()(revokeEndpoint(), {
        method: "POST",
        headers: { "content-type": "application/json", ...headers() },
        body: JSON.stringify({ sessionId })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to revoke session");
      }
      await loadSessions();
    } catch (err) {
      $.set(error, err.message);
    } finally {
      $.set(revokingId, null);
    }
  }
  if (!sessions()) {
    loadSessions();
  }
  $.init();
  var div = root();
  var node = $.child(div);
  {
    var consequent = ($$anchor2) => {
      var p = root_14();
      var text3 = $.child(p, true);
      $.reset(p);
      $.template_effect(() => $.set_text(text3, $.get(error)));
      $.append($$anchor2, p);
    };
    $.if(node, ($$render) => {
      if ($.get(error)) $$render(consequent);
    });
  }
  var node_1 = $.sibling(node, 2);
  {
    var consequent_1 = ($$anchor2) => {
      var p_1 = root_23();
      $.append($$anchor2, p_1);
    };
    var consequent_3 = ($$anchor2) => {
      var ul = root_33();
      $.each(ul, 5, sessions, $.index, ($$anchor3, session) => {
        var li = root_42();
        var div_1 = $.child(li);
        var p_2 = $.child(div_1);
        var text_1 = $.child(p_2);
        $.reset(p_2);
        var p_3 = $.sibling(p_2, 2);
        var text_2 = $.child(p_3);
        $.reset(p_3);
        $.reset(div_1);
        var node_2 = $.sibling(div_1, 2);
        {
          var consequent_2 = ($$anchor4) => {
            var button = root_5();
            var text_3 = $.child(button, true);
            $.reset(button);
            $.template_effect(() => {
              button.disabled = ($.get(revokingId), $.get(session), $.untrack(() => $.get(revokingId) === $.get(session).id));
              $.set_attribute(button, "aria-label", `Revoke session ${($.get(session), $.untrack(() => $.get(session).ip || "Unknown IP")) ?? ""}`);
              $.set_text(text_3, ($.get(revokingId), $.get(session), $.untrack(() => $.get(revokingId) === $.get(session).id ? "Revoking\u2026" : "Revoke")));
            });
            $.event("click", button, () => revoke($.get(session).id));
            $.append($$anchor4, button);
          };
          $.if(node_2, ($$render) => {
            if ($.get(session), $.untrack(() => !$.get(session).current)) $$render(consequent_2);
          });
        }
        $.reset(li);
        $.template_effect(
          ($0) => {
            $.set_text(text_1, `${($.get(session), $.untrack(() => $.get(session).current ? "Current session" : "Session")) ?? ""} \xB7
							${($.get(session), $.untrack(() => $.get(session).ip || "Unknown IP")) ?? ""}`);
            $.set_text(text_2, `Expires ${$0 ?? ""}`);
          },
          [
            () => ($.get(session), $.untrack(() => new Date($.get(session).expiresAt).toLocaleString()))
          ]
        );
        $.append($$anchor3, li);
      });
      $.reset(ul);
      $.append($$anchor2, ul);
    };
    var alternate = ($$anchor2) => {
      var p_4 = root_6();
      $.append($$anchor2, p_4);
    };
    $.if(node_1, ($$render) => {
      if ($.get(loading) && !sessions()) $$render(consequent_1);
      else if ($.deep_read_state(sessions()), $.untrack(() => sessions() && sessions().length > 0)) $$render(consequent_3, 1);
      else $$render(alternate, false);
    });
  }
  $.reset(div);
  $.append($$anchor, div);
  $.pop();
}

export { AuthGate, AuthNotification, BackupCodesModal, MigrationNotification, SessionManager, auth, createAuthStore, isAuthenticated, user };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map