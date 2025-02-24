/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_DOMAIN_A = "example.com";
const TEST_DOMAIN_B = "example.org";
const TEST_DOMAIN_C = "example.net";

const TEST_ORIGIN_A = "https://" + TEST_DOMAIN_A;
const TEST_ORIGIN_B = "https://" + TEST_DOMAIN_B;
const TEST_ORIGIN_C = "https://" + TEST_DOMAIN_C;

const TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  ""
);

const TEST_PAGE_A = TEST_ORIGIN_A + TEST_PATH + "file_banner.html";
const TEST_PAGE_B = TEST_ORIGIN_B + TEST_PATH + "file_banner.html";

/**
 * A helper function returns a promise which resolves when the banner clicking
 * is finished for the given domain.
 *
 * @param {String} domain the domain that should run the banner clicking.
 */
function promiseBannerClickingFinish(domain) {
  return new Promise(resolve => {
    Services.obs.addObserver(function observer(subject, topic, data) {
      if (data != domain) {
        return;
      }

      Services.obs.removeObserver(
        observer,
        "cookie-banner-test-clicking-finish"
      );
      resolve();
    }, "cookie-banner-test-clicking-finish");
  });
}

/**
 * A helper function to verify the banner state of the given browsingContext.
 *
 * @param {BrowsingContext} bc - the browsing context
 * @param {boolean} visible - if the banner should be visible.
 * @param {boolean} expected - the expected banner click state.
 */
async function verifyBannerState(bc, visible, expected) {
  info("Verify the cookie banner state.");

  await SpecialPowers.spawn(bc, [visible, expected], (visible, expected) => {
    let banner = content.document.getElementById("banner");

    is(
      banner.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
      }),
      visible,
      `The banner element should be ${visible ? "visible" : "hidden"}`
    );

    let result = content.document.getElementById("result");

    is(result.textContent, expected, "The build click state is correct.");
  });
}

/**
 * A helper function to open the test page and verify the banner state.
 *
 * @param {Window} win - the chrome window object.
 * @param {String} domain - the domain of the testing page.
 * @param {String} testURL - the url of the testing page.
 * @param {boolean} visible - if the banner should be visible.
 * @param {boolean} expected - the expected banner click state.
 */
async function openPageAndVerify({ win, domain, testURL, visible, expected }) {
  info(`Opening ${testURL}`);
  let promise = promiseBannerClickingFinish(domain);

  let tab = await BrowserTestUtils.openNewForegroundTab(win.gBrowser, testURL);

  await promise;

  await verifyBannerState(tab.linkedBrowser, visible, expected);

  BrowserTestUtils.removeTab(tab);
}

/**
 * A helper function to open the test page in an iframe and verify the banner
 * state in the iframe.
 *
 * @param {Window} win - the chrome window object.
 * @param {String} domain - the domain of the testing iframe page.
 * @param {String} testURL - the url of the testing iframe page.
 * @param {boolean} visible - if the banner should be visible.
 * @param {boolean} expected - the expected banner click state.
 */
async function openIframeAndVerify({
  win,
  domain,
  testURL,
  visible,
  expected,
}) {
  let tab = await BrowserTestUtils.openNewForegroundTab(
    win.gBrowser,
    TEST_ORIGIN_C
  );

  let promise = promiseBannerClickingFinish(domain);

  let iframeBC = await SpecialPowers.spawn(
    tab.linkedBrowser,
    [testURL],
    async testURL => {
      let iframe = content.document.createElement("iframe");
      iframe.src = testURL;
      content.document.body.appendChild(iframe);
      await ContentTaskUtils.waitForEvent(iframe, "load");

      return iframe.browsingContext;
    }
  );

  await promise;
  await verifyBannerState(iframeBC, visible, expected);

  BrowserTestUtils.removeTab(tab);
}

/**
 * A helper function to insert testing rules.
 */
function insertTestRules() {
  info("Clearing existing rules");
  Services.cookieBanners.resetRules(false);

  info("Inserting test rules.");

  let ruleA = Cc["@mozilla.org/cookie-banner-rule;1"].createInstance(
    Ci.nsICookieBannerRule
  );
  ruleA.domain = TEST_DOMAIN_A;

  ruleA.addClickRule("div#banner", null, "button#optOut", "button#optIn");
  Services.cookieBanners.insertRule(ruleA);

  // An opt-in click rule for DOMAIN_B.
  let ruleB = Cc["@mozilla.org/cookie-banner-rule;1"].createInstance(
    Ci.nsICookieBannerRule
  );
  ruleB.domain = TEST_DOMAIN_B;

  ruleB.addClickRule("div#banner", null, null, "button#optIn");
  Services.cookieBanners.insertRule(ruleB);
}

add_setup(async function() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["cookiebanners.bannerClicking.testing", true],
      ["cookiebanners.bannerClicking.timeout", 500],
      ["cookiebanners.bannerClicking.enabled", true],
    ],
  });

  registerCleanupFunction(() => {
    Services.prefs.clearUserPref("cookiebanners.service.mode");
    if (
      Services.prefs.getIntPref("cookiebanners.service.mode") !=
      Ci.nsICookieBannerService.MODE_DISABLED
    ) {
      // Restore original rules.
      Services.cookieBanners.resetRules(true);
    }
  });
});

/**
 * Test that the banner clicking won't click banner if the service is disabled.
 */
add_task(async function test_cookie_banner_service_disabled() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["cookiebanners.service.mode", Ci.nsICookieBannerService.MODE_DISABLED],
    ],
  });

  await openPageAndVerify({
    win: window,
    domain: TEST_DOMAIN_A,
    testURL: TEST_PAGE_A,
    visible: true,
    expected: "NoClick",
  });
});

/**
 * Test that the banner clicking won't click banner if there is no rule.
 */
add_task(async function test_no_rules() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["cookiebanners.service.mode", Ci.nsICookieBannerService.MODE_REJECT],
    ],
  });

  info("Clearing existing rules");
  Services.cookieBanners.resetRules(false);

  await openPageAndVerify({
    win: window,
    domain: TEST_DOMAIN_A,
    testURL: TEST_PAGE_A,
    visible: true,
    expected: "NoClick",
  });
});

/**
 * Test the banner clicking with MODE_REJECT.
 */
add_task(async function test_clicking_mode_reject() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["cookiebanners.service.mode", Ci.nsICookieBannerService.MODE_REJECT],
    ],
  });

  insertTestRules();

  await openPageAndVerify({
    win: window,
    domain: TEST_DOMAIN_A,
    testURL: TEST_PAGE_A,
    visible: false,
    expected: "OptOut",
  });

  // No opt out rule for the example.org, the banner shouldn't be clicked.
  await openPageAndVerify({
    win: window,
    domain: TEST_DOMAIN_B,
    testURL: TEST_PAGE_B,
    visible: true,
    expected: "NoClick",
  });
});

/**
 * Test the banner clicking with MODE_REJECT_OR_ACCEPT.
 */
add_task(async function test_clicking_mode_reject_or_accept() {
  await SpecialPowers.pushPrefEnv({
    set: [
      [
        "cookiebanners.service.mode",
        Ci.nsICookieBannerService.MODE_REJECT_OR_ACCEPT,
      ],
    ],
  });

  insertTestRules();

  await openPageAndVerify({
    win: window,
    domain: TEST_DOMAIN_A,
    testURL: TEST_PAGE_A,
    visible: false,
    expected: "OptOut",
  });

  await openPageAndVerify({
    win: window,
    domain: TEST_DOMAIN_B,
    testURL: TEST_PAGE_B,
    visible: false,
    expected: "OptIn",
  });
});

/**
 * Test the banner clicking with the case where the banner is added after
 * page loads and with a short amount of delay.
 */
add_task(async function test_clicking_with_delayed_banner() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["cookiebanners.service.mode", Ci.nsICookieBannerService.MODE_REJECT],
    ],
  });

  insertTestRules();

  let TEST_PAGE =
    TEST_ORIGIN_A + TEST_PATH + "file_delayed_banner.html?delay=100";
  await openPageAndVerify({
    win: window,
    domain: TEST_DOMAIN_A,
    testURL: TEST_PAGE,
    visible: false,
    expected: "OptOut",
  });
});

/**
 * Test that the banner clicking in an iframe.
 */
add_task(async function test_embedded_iframe() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["cookiebanners.service.mode", Ci.nsICookieBannerService.MODE_REJECT],
    ],
  });

  insertTestRules();

  await openIframeAndVerify({
    win: window,
    domain: TEST_DOMAIN_A,
    testURL: TEST_PAGE_A,
    visible: false,
    expected: "OptOut",
  });
});

/**
 * Test banner clicking with the private browsing window.
 */
add_task(async function test_pbm() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["cookiebanners.service.mode", Ci.nsICookieBannerService.MODE_REJECT],
    ],
  });

  insertTestRules();

  let pbmWindow = await BrowserTestUtils.openNewBrowserWindow({
    private: true,
  });

  await openPageAndVerify({
    win: pbmWindow,
    domain: TEST_DOMAIN_A,
    testURL: TEST_PAGE_A,
    visible: false,
    expected: "OptOut",
  });

  await BrowserTestUtils.closeWindow(pbmWindow);
});

/**
 * Test that the banner clicking in an iframe with the private browsing window.
 */
add_task(async function test_embedded_iframe_pbm() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["cookiebanners.service.mode", Ci.nsICookieBannerService.MODE_REJECT],
    ],
  });

  insertTestRules();

  let pbmWindow = await BrowserTestUtils.openNewBrowserWindow({
    private: true,
  });

  await openIframeAndVerify({
    win: pbmWindow,
    domain: TEST_DOMAIN_A,
    testURL: TEST_PAGE_A,
    visible: false,
    expected: "OptOut",
  });

  await BrowserTestUtils.closeWindow(pbmWindow);
});
