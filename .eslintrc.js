/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const xpcshellTestConfig = require("eslint-plugin-mozilla/lib/configs/xpcshell-test.js");
const browserTestConfig = require("eslint-plugin-mozilla/lib/configs/browser-test.js");
const mochitestTestConfig = require("eslint-plugin-mozilla/lib/configs/mochitest-test.js");
const chromeTestConfig = require("eslint-plugin-mozilla/lib/configs/chrome-test.js");
const { testPaths } = require("./.eslintrc-test-paths.js");
const fs = require("fs");
const path = require("path");

/**
 * Some configurations have overrides, which can't be specified within overrides,
 * so we need to remove them.
 */
function removeOverrides(config) {
  config = { ...config };
  delete config.overrides;
  return config;
}

const ignorePatterns = [
  ...fs
    .readFileSync(
      path.join(__dirname, "tools", "rewriting", "ThirdPartyPaths.txt")
    )
    .toString("utf-8")
    .split("\n"),
  ...fs
    .readFileSync(
      path.join(
        __dirname,
        "devtools",
        "client",
        "debugger",
        "src",
        ".eslintignore"
      )
    )
    .toString("utf-8")
    .split("\n")
    .filter(p => p && !p.startsWith("#"))
    .map(p => `devtools/client/debugger/src/${p}`),
];

module.exports = {
  parser: "@babel/eslint-parser",
  parserOptions: {
    sourceType: "script",
    babelOptions: {
      configFile: path.join(__dirname, ".babel-eslint.rc.js"),
    },
  },
  settings: {
    "import/extensions": [".mjs"],
  },
  ignorePatterns,
  // Ignore eslint configurations in parent directories.
  root: true,
  // New rules and configurations should generally be added in
  // tools/lint/eslint/eslint-plugin-mozilla/lib/configs/recommended.js to
  // allow external repositories that use the plugin to pick them up as well.
  extends: ["plugin:mozilla/recommended"],
  plugins: ["mozilla", "import"],
  overrides: [
    {
      // All .eslintrc.js files are in the node environment, so turn that
      // on here.
      // https://github.com/eslint/eslint/issues/13008
      files: [".eslintrc.js"],
      env: {
        node: true,
        browser: false,
      },
    },
    {
      files: ["*.mjs"],
      rules: {
        "import/default": "error",
        "import/export": "error",
        "import/named": "error",
        "import/namespace": "error",
        "import/newline-after-import": "error",
        "import/no-anonymous-default-export": "error",
        "import/no-duplicates": "error",
        "import/no-absolute-path": "error",
        "import/no-named-default": "error",
        "import/no-named-as-default": "error",
        "import/no-named-as-default-member": "error",
        "import/no-self-import": "error",
        "import/no-unassigned-import": "error",
        "import/no-unresolved": [
          "error",
          // Bug 1773473 - Ignore resolver URLs for chrome and resource as we
          // do not yet have a resolver for them.
          { ignore: ["chrome://", "resource://"] },
        ],
        "import/no-useless-path-segments": "error",
      },
    },
    {
      files: [
        // Bug 1773475 - For now, turn off no-unresolved on some paths where we import
        // from node_modules, as the ESLint setup only installs modules at the
        // top-level.
        "devtools/shared/compatibility/**",
      ],
      rules: {
        "import/no-unresolved": "off",
      },
    },
    {
      files: ["*.html", "*.xhtml", "*.xml"],
      rules: {
        // Curly brackets are required for all the tree via recommended.js,
        // however these files aren't auto-fixable at the moment.
        curly: "off",
      },
    },
    {
      // TODO: Bug 1515949. Enable no-undef for gfx/
      files: "gfx/layers/apz/test/mochitest/**",
      rules: {
        "no-undef": "off",
      },
    },
    {
      ...removeOverrides(xpcshellTestConfig),
      files: testPaths.xpcshell.map(path => `${path}**`),
    },
    {
      // If it is an xpcshell head file, we turn off global unused variable checks, as it
      // would require searching the other test files to know if they are used or not.
      // This would be expensive and slow, and it isn't worth it for head files.
      // We could get developers to declare as exported, but that doesn't seem worth it.
      files: testPaths.xpcshell.map(path => `${path}head*.js`),
      rules: {
        "no-unused-vars": [
          "error",
          {
            args: "none",
            vars: "local",
          },
        ],
      },
    },
    {
      // This section enables warning of no-unused-vars globally for all test*.js
      // files in xpcshell test paths.
      // These are turned into errors with selected exclusions in the next
      // section.
      // Bug 1612907: This section should go away once the exclusions are removed
      // from the following section.
      files: testPaths.xpcshell.map(path => `${path}test*.js`),
      rules: {
        // No declaring variables that are never used
        "no-unused-vars": [
          "warn",
          {
            args: "none",
            vars: "all",
          },
        ],
      },
    },
    {
      // This section makes global issues with no-unused-vars be reported as
      // errors - except for the excluded lists which are being fixed in the
      // dependencies of bug 1612907.
      files: testPaths.xpcshell.map(path => `${path}test*.js`),
      excludedFiles: [
        // These are suitable as good first bugs, take one or two related lines
        // per bug.
        "extensions/permissions/**",
        "image/test/unit/**",
        "modules/libjar/test/unit/test_empty_jar_telemetry.js",
        "modules/libjar/zipwriter/test/unit/test_alignment.js",
        "modules/libjar/zipwriter/test/unit/test_bug419769_2.js",
        "modules/libjar/zipwriter/test/unit/test_storedata.js",
        "modules/libjar/zipwriter/test/unit/test_zippermissions.js",
        "modules/libpref/test/unit/test_dirtyPrefs.js",
        "toolkit/crashreporter/test/unit/test_crash_AsyncShutdown.js",
        "toolkit/mozapps/update/tests/unit_aus_update/testConstants.js",

        // These are more complicated bugs which may require some in-depth
        // investigation or different solutions. They are also likely to be
        // a reasonable size.
        "dom/indexedDB/**",
      ],
      rules: {
        // No declaring variables that are never used
        "no-unused-vars": [
          "error",
          {
            args: "none",
            vars: "all",
          },
        ],
      },
    },
    {
      ...browserTestConfig,
      files: testPaths.browser.map(path => `${path}**`),
    },
    {
      ...removeOverrides(mochitestTestConfig),
      files: testPaths.mochitest.map(path => `${path}**`),
      excludedFiles: ["security/manager/ssl/tests/mochitest/browser/**"],
    },
    {
      ...removeOverrides(chromeTestConfig),
      files: testPaths.chrome.map(path => `${path}**`),
    },
    {
      env: {
        // Ideally we wouldn't be using the simpletest env here, but our uses of
        // js files mean we pick up everything from the global scope, which could
        // be any one of a number of html files. So we just allow the basics...
        "mozilla/simpletest": true,
      },
      files: [
        ...testPaths.mochitest.map(path => `${path}/**/*.js`),
        ...testPaths.chrome.map(path => `${path}/**/*.js`),
      ],
    },
    {
      files: ["netwerk/test/mochitests/**", "netwerk/test/unit*/**"],
      rules: {
        "no-shadow": "warn",
      },
    },
    {
      files: ["layout/**"],
      rules: {
        "object-shorthand": "off",
        "mozilla/avoid-removeChild": "off",
        "mozilla/consistent-if-bracing": "off",
        "mozilla/reject-importGlobalProperties": "off",
        "mozilla/no-arbitrary-setTimeout": "off",
        "mozilla/no-define-cc-etc": "off",
        "mozilla/prefer-boolean-length-check": "off",
        "mozilla/use-chromeutils-generateqi": "off",
        "mozilla/use-default-preference-values": "off",
        "mozilla/use-includes-instead-of-indexOf": "off",
        "mozilla/use-services": "off",
        "mozilla/use-ownerGlobal": "off",
        complexity: "off",
        "consistent-return": "off",
        "no-array-constructor": "off",
        "no-caller": "off",
        "no-cond-assign": "off",
        "no-extra-boolean-cast": "off",
        "no-eval": "off",
        "no-func-assign": "off",
        "no-global-assign": "off",
        "no-implied-eval": "off",
        "no-lonely-if": "off",
        "no-nested-ternary": "off",
        "no-new-wrappers": "off",
        "no-redeclare": "off",
        "no-restricted-globals": "off",
        "no-return-await": "off",
        "no-sequences": "off",
        "no-throw-literal": "off",
        "no-useless-concat": "off",
        "no-undef": "off",
        "no-unreachable": "off",
        "no-unsanitized/method": "off",
        "no-unsanitized/property": "off",
        "no-unsafe-negation": "off",
        "no-unused-vars": "off",
        "no-useless-return": "off",
      },
    },
    {
      files: [
        "dom/animation/test/**",
        "dom/base/test/*.*",
        "dom/base/test/unit/test_serializers_entities*.js",
        "dom/base/test/unit_ipc/**",
        "dom/base/test/jsmodules/**",
        "dom/canvas/test/**",
        "dom/encoding/test/**",
        "dom/events/test/**",
        "dom/fetch/tests/**",
        "dom/file/ipc/tests/**",
        "dom/file/tests/**",
        "dom/html/test/**",
        "dom/jsurl/test/**",
        "dom/media/tests/**",
        "dom/media/webaudio/test/**",
        "dom/media/webrtc/tests/**",
        "dom/media/webspeech/recognition/test/**",
        "dom/media/webspeech/synth/test/**",
        "dom/messagechannel/tests/**",
        "dom/midi/tests/**",
        "dom/network/tests/**",
        "dom/payments/test/**",
        "dom/performance/tests/**",
        "dom/quota/test/browser/**",
        "dom/quota/test/common/**",
        "dom/quota/test/mochitest/**",
        "dom/quota/test/xpcshell/**",
        "dom/security/test/cors/**",
        "dom/security/test/csp/**",
        "dom/security/test/mixedcontentblocker/**",
        "dom/serviceworkers/test/**",
        "dom/smil/test/**",
        "dom/tests/mochitest/**",
        "dom/u2f/tests/**",
        "dom/vr/test/**",
        "dom/webauthn/tests/**",
        "dom/webgpu/mochitest/**",
        "dom/websocket/tests/**",
        "dom/workers/test/**",
        "dom/worklet/tests/**",
        "dom/xml/test/**",
        "dom/xslt/tests/**",
        "dom/xul/test/**",
        "dom/ipc/test.xhtml",
      ],
      rules: {
        "consistent-return": "off",
        "mozilla/avoid-removeChild": "off",
        "mozilla/consistent-if-bracing": "off",
        "mozilla/no-arbitrary-setTimeout": "off",
        "mozilla/no-compare-against-boolean-literals": "off",
        "mozilla/no-define-cc-etc": "off",
        "mozilla/reject-importGlobalProperties": "off",
        "mozilla/use-cc-etc": "off",
        "mozilla/use-chromeutils-generateqi": "off",
        "mozilla/use-includes-instead-of-indexOf": "off",
        "mozilla/use-ownerGlobal": "off",
        "mozilla/use-services": "off",
        "no-array-constructor": "off",
        "no-caller": "off",
        "no-cond-assign": "off",
        "no-control-regex": "off",
        "no-debugger": "off",
        "no-else-return": "off",
        "no-empty": "off",
        "no-eval": "off",
        "no-func-assign": "off",
        "no-global-assign": "off",
        "no-implied-eval": "off",
        "no-lone-blocks": "off",
        "no-lonely-if": "off",
        "no-nested-ternary": "off",
        "no-new-object": "off",
        "no-new-wrappers": "off",
        "no-redeclare": "off",
        "no-return-await": "off",
        "no-restricted-globals": "off",
        "no-self-assign": "off",
        "no-self-compare": "off",
        "no-sequences": "off",
        "no-shadow": "off",
        "no-shadow-restricted-names": "off",
        "no-sparse-arrays": "off",
        "no-throw-literal": "off",
        "no-unreachable": "off",
        "no-unsanitized/method": "off",
        "no-unsanitized/property": "off",
        "no-undef": "off",
        "no-unused-vars": "off",
        "no-useless-call": "off",
        "no-useless-concat": "off",
        "no-useless-return": "off",
        "no-with": "off",
      },
    },
    {
      files: [
        "testing/mochitest/browser-harness.xhtml",
        "testing/mochitest/chrome/test_chromeGetTestFile.xhtml",
        "testing/mochitest/chrome/test_sanityEventUtils.xhtml",
        "testing/mochitest/chrome/test_sanityException.xhtml",
        "testing/mochitest/chrome/test_sanityException2.xhtml",
        "testing/mochitest/harness.xhtml",
      ],
      rules: {
        "dot-notation": "off",
        "object-shorthand": "off",
        "mozilla/use-services": "off",
        "mozilla/no-compare-against-boolean-literals": "off",
        "mozilla/no-useless-parameters": "off",
        "mozilla/no-useless-removeEventListener": "off",
        "mozilla/use-cc-etc": "off",
        "consistent-return": "off",
        "no-fallthrough": "off",
        "no-nested-ternary": "off",
        "no-redeclare": "off",
        "no-sequences": "off",
        "no-shadow": "off",
        "no-throw-literal": "off",
        "no-undef": "off",
        "no-unsanitized/property": "off",
        "no-unused-vars": "off",
        "no-useless-call": "off",
      },
    },
    {
      files: [
        "dom/base/test/chrome/file_bug1139964.xhtml",
        "dom/base/test/chrome/file_bug549682.xhtml",
        "dom/base/test/chrome/file_bug616841.xhtml",
        "dom/base/test/chrome/file_bug990812-1.xhtml",
        "dom/base/test/chrome/file_bug990812-2.xhtml",
        "dom/base/test/chrome/file_bug990812-3.xhtml",
        "dom/base/test/chrome/file_bug990812-4.xhtml",
        "dom/base/test/chrome/file_bug990812-5.xhtml",
        "dom/base/test/chrome/file_bug990812.xhtml",
        "dom/base/test/chrome/test_bug1098074_throw_from_ReceiveMessage.xhtml",
        "dom/base/test/chrome/test_bug339494.xhtml",
        "dom/base/test/chrome/test_bug429785.xhtml",
        "dom/base/test/chrome/test_bug467123.xhtml",
        "dom/base/test/chrome/test_bug683852.xhtml",
        "dom/base/test/chrome/test_bug780529.xhtml",
        "dom/base/test/chrome/test_bug800386.xhtml",
        "dom/base/test/chrome/test_bug884693.xhtml",
        "dom/base/test/chrome/test_document-element-inserted.xhtml",
        "dom/base/test/chrome/test_domparsing.xhtml",
        "dom/base/test/chrome/title_window.xhtml",
        "dom/base/test/chrome/window_nsITextInputProcessor.xhtml",
        "dom/base/test/chrome/window_swapFrameLoaders.xhtml",
        "dom/base/test/test_domrequesthelper.xhtml",
        "dom/bindings/test/test_bug1123516_maplikesetlikechrome.xhtml",
        "dom/console/tests/test_jsm.xhtml",
        "dom/events/test/test_bug1412775.xhtml",
        "dom/events/test/test_bug336682_2.xhtml",
        "dom/events/test/test_bug415498.xhtml",
        "dom/events/test/test_bug602962.xhtml",
        "dom/events/test/test_bug617528.xhtml",
        "dom/events/test/test_bug679494.xhtml",
        "dom/indexedDB/test/test_globalObjects_chrome.xhtml",
        "dom/indexedDB/test/test_wrappedArray.xhtml",
        "dom/ipc/test.xhtml",
        "dom/ipc/tests/test_process_error.xhtml",
        "dom/notification/test/chrome/test_notification_system_principal.xhtml",
        "dom/security/test/general/test_bug1277803.xhtml",
        "dom/serviceworkers/test/test_serviceworkerinfo.xhtml",
        "dom/serviceworkers/test/test_serviceworkermanager.xhtml",
        "dom/system/tests/test_constants.xhtml",
        "dom/tests/mochitest/chrome/DOMWindowCreated_chrome.xhtml",
        "dom/tests/mochitest/chrome/MozDomFullscreen_chrome.xhtml",
        "dom/tests/mochitest/chrome/sizemode_attribute.xhtml",
        "dom/tests/mochitest/chrome/test_cyclecollector.xhtml",
        "dom/tests/mochitest/chrome/test_docshell_swap.xhtml",
        "dom/tests/mochitest/chrome/window_focus.xhtml",
        "dom/url/tests/test_bug883784.xhtml",
        "dom/workers/test/test_WorkerDebugger.xhtml",
        "dom/workers/test/test_WorkerDebugger_console.xhtml",
        "dom/workers/test/test_fileReadSlice.xhtml",
        "dom/workers/test/test_fileReaderSync.xhtml",
        "dom/workers/test/test_fileSlice.xhtml",
      ],
      rules: {
        "mozilla/no-useless-parameters": "off",
        "mozilla/no-useless-removeEventListener": "off",
        "mozilla/use-chromeutils-generateqi": "off",
        "mozilla/use-services": "off",
        complexity: "off",
        "no-array-constructor": "off",
        "no-caller": "off",
        "no-empty": "off",
        "no-eval": "off",
        "no-lone-blocks": "off",
        "no-redeclare": "off",
        "no-shadow": "off",
        "no-throw-literal": "off",
        "no-unsanitized/method": "off",
        "no-useless-return": "off",
        "object-shorthand": "off",
      },
    },
    {
      files: ["netwerk/**"],
      rules: {
        "mozilla/prefer-boolean-length-check": "off",
      },
    },
    {
      // Rules of Hooks broadly checks for camelCase "use" identifiers, so
      // enable only for paths actually using React to avoid false positives.
      extends: ["plugin:react-hooks/recommended"],
      files: [
        "browser/components/newtab/**",
        "browser/components/pocket/**",
        "devtools/**",
      ],
    },
    {
      // Turn off the osfile rule for osfile.
      files: ["toolkit/components/osfile/**"],
      rules: {
        "mozilla/reject-osfile": "off",
      },
    },
  ],
};
