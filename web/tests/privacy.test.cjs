const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { create, act } = require("react-test-renderer");

// Exercise the real dashboard hooks and API client; replace only visual primitives
// and the host's browser integration. No real credentials or conversation data.
function compile(relative, replacements = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, "../src", relative);
  if (cache.has(filename)) return cache.get(filename);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = mod.require.bind(mod);
  mod.require = (id) => {
    if (id in replacements) return replacements[id];
    if (id.startsWith("@/components/ui/") || id === "lucide-react")
      return new Proxy(
        {},
        {
          get: (_, name) => {
            if (name === "__esModule") return true;
            return (props) => {
              if ((name === "Dialog" || name === "AlertDialog") && !props.open)
                return null;
              const tag =
                name === "Textarea"
                  ? "textarea"
                  : name === "Button"
                    ? "button"
                    : "div";
              return React.createElement(
                tag,
                { ...props, "data-ui": String(name) },
                props.children,
              );
            };
          },
        },
      );
    if (id.startsWith(".") || id.startsWith("@/")) {
      const base = id.startsWith("@/")
        ? path.resolve(__dirname, "../src", id.slice(2))
        : path.resolve(path.dirname(filename), id);
      const target = [".ts", ".tsx"]
        .map((ext) => base + ext)
        .find((file) => fs.existsSync(file));
      if (target)
        return compile(
          path.relative(path.resolve(__dirname, "../src"), target),
          replacements,
          cache,
        );
    }
    return originalRequire(id);
  };
  mod._compile(compiled, filename);
  cache.set(filename, mod.exports);
  return mod.exports;
}

const row = {
  id: "synthetic-id",
  content: "PRIVATE_MESSAGE",
  scheduledAt: "2099-01-01T00:00:00Z",
  status: "pending",
  createdBy: { id: 1, name: "PRIVATE_AUTHOR" },
  updatedBy: { id: 1, name: "PRIVATE_AUTHOR" },
  cancelIfContactReplies: true,
  cancelIfNotOpen: true,
  version: 1,
};
const context = (id) => ({
  accountId: 1,
  inboxId: 2,
  conversationId: id,
  contactId: 3,
  contactName: "Synthetic Contact",
});
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

async function harness(run) {
  const original = {
    window: global.window,
    document: global.document,
    fetch: global.fetch,
  };
  const events = new Map();
  let interval;
  let notify;
  let auth = { uid: "agent@example.invalid", client: "synthetic-client" };
  let responder = async () => ({ status: 200, messages: [row] });
  const requests = [];
  const host = {
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: (name) => events.delete(name),
  };
  global.window = {
    ...host,
    location: { pathname: "/later/" },
    setInterval: (fn) => {
      interval = fn;
      return 1;
    },
    clearInterval() {},
  };
  global.document = { ...host, visibilityState: "visible" };
  global.fetch = async (url, init) => {
    requests.push({ url, init });
    const result = await responder(url, init);
    return new Response(
      JSON.stringify(
        result.status === 200
          ? { messages: result.messages }
          : { error: "chatwoot_auth_rejected" },
      ),
      { status: result.status },
    );
  };
  const api = compile("lib/api.ts");
  const { ScheduledReplies } = compile(
    "components/messages/ScheduledReplies.tsx",
    {
      "@/lib/api": api,
      "@/lib/chatwoot": {
        getChatwootAuthHeaders: () => auth,
        subscribeToDashboardContext: (fn) => {
          notify = fn;
          fn(context(10));
          return () => {};
        },
      },
    },
  );
  let view;
  try {
    await act(async () => {
      view = create(React.createElement(ScheduledReplies));
      await flush();
    });
    const state = {
      view,
      requests,
      text: () => JSON.stringify(view.toJSON()),
      async refresh() {
        await act(async () => {
          interval();
          await flush();
        });
      },
      async event(name) {
        await act(async () => {
          events.get(name)();
          await flush();
        });
      },
      async switch(id) {
        await act(async () => {
          notify(context(id));
          await flush();
        });
      },
      setResponder: (fn) => {
        responder = fn;
      },
      setAuth: (value) => {
        auth = value;
      },
    };
    await run(state);
  } finally {
    if (view) await act(async () => view.unmount());
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
  }
}

for (const status of [401, 403])
  test(`clears messages, author names, drafts and dialogs on ${status}`, async () =>
    harness(async (h) => {
      assert.match(h.text(), /PRIVATE_MESSAGE/);
      await act(async () => {
        h.view.root
          .findByType("textarea")
          .props.onChange({ target: { value: "PRIVATE_DRAFT" } });
        h.view.root
          .find((node) => node.props.role === "button")
          .props.onClick();
      });
      await act(async () =>
        h.view.root
          .findAllByType("button")
          .find((node) => node.children.join("") === "Удалить")
          .props.onClick(),
      );
      h.setResponder(async () => ({ status }));
      await h.refresh();
      assert.doesNotMatch(
        h.text(),
        /PRIVATE_MESSAGE|PRIVATE_AUTHOR|PRIVATE_DRAFT/,
      );
      assert.equal(
        h.view.root.findAll((node) => node.props["data-ui"] === "DialogContent")
          .length,
        0,
      );
      assert.equal(
        h.view.root.findAll(
          (node) => node.props["data-ui"] === "AlertDialogContent",
        ).length,
        0,
      );
      assert.equal(h.view.root.findByType("fieldset").props.disabled, true);
      assert.ok(
        h.requests.every((request) => request.init.cache === "no-store"),
      );
    }));

test("discards delayed data from the previous conversation", async () =>
  harness(async (h) => {
    let resolveOld;
    h.setResponder(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    await h.refresh();
    h.setResponder(async () => ({
      status: 200,
      messages: [{ ...row, content: "NEW_CONVERSATION" }],
    }));
    await h.switch(11);
    await act(async () => {
      resolveOld({ status: 200, messages: [row] });
      await flush();
    });
    assert.match(h.text(), /NEW_CONVERSATION/);
    assert.doesNotMatch(h.text(), /PRIVATE_MESSAGE/);
  }));

test("split components retain create, edit, reschedule and delete wiring", async () =>
  harness(async (h) => {
    let messages = [row];
    h.setResponder(async (_url, init) => {
      if (init.method === "PUT") messages = [{ ...row, ...JSON.parse(init.body) }];
      if (init.method === "DELETE") messages = [];
      return { status: 200, messages };
    });
    await act(async () => {
      h.view.root.findByType("textarea").props.onChange({ target: { value: "NEW_REPLY" } });
    });
    await act(async () => {
      h.view.root.findByType("form").props.onSubmit({ preventDefault() {} });
      await flush();
    });
    assert.equal(JSON.parse(h.requests.find(r => r.init.method === "POST").init.body).content, "NEW_REPLY");
    assert.equal(h.view.root.findByType("textarea").props.value, "");
    await act(async () => h.view.root.find(node => node.props.role === "button").props.onClick());
    await act(async () => {
      h.view.root.findAllByType("textarea")[1].props.onChange({ target: { value: "UPDATED_REPLY" } });
    });
    await act(async () => {
      h.view.root.findAll(node => node.props["data-ui"] === "DateTimePicker")[1].props.onChange("2099-01-02T15:30");
    });
    await act(async () => {
      h.view.root.findAllByType("form")[1].props.onSubmit({ preventDefault() {} });
      await flush();
    });
    const updated = JSON.parse(h.requests.find(r => r.init.method === "PUT").init.body);
    assert.equal(updated.content, "UPDATED_REPLY");
    assert.equal(updated.scheduledAt, new Date("2099-01-02T15:30").toISOString());
    assert.equal(updated.version, 1);
    assert.match(h.text(), /UPDATED_REPLY/);
    await act(async () => h.view.root.find(node => node.props.role === "button").props.onClick());
    await act(async () => h.view.root.findAllByType("button").find(node => node.children.join("") === "Удалить").props.onClick());
    await act(async () => {
      h.view.root.findAllByType("button").find(node => node.children.join("") === "Удалить сообщение").props.onClick({ preventDefault() {} });
      await flush();
    });
    assert.ok(h.requests.some(r => r.init.method === "DELETE" && r.url.includes("version=1")));
    assert.doesNotMatch(h.text(), /UPDATED_REPLY/);
  }));

test("revalidates on restoration and discards data after the session changes", async () =>
  harness(async (h) => {
    let resolveOld;
    h.setResponder(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    await h.refresh();
    h.setAuth(null);
    await act(async () => {
      resolveOld({ status: 200, messages: [row] });
      await flush();
    });
    assert.doesNotMatch(h.text(), /PRIVATE_MESSAGE|PRIVATE_AUTHOR/);
    await h.event("pageshow");
    assert.equal(h.view.root.findByType("fieldset").props.disabled, true);
  }));
