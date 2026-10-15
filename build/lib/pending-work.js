"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var pending_work_exports = {};
__export(pending_work_exports, {
  acquireExclusiveWork: () => acquireExclusiveWork,
  drainPendingWork: () => drainPendingWork,
  enqueueSerializedWork: () => enqueueSerializedWork,
  settleIndependentTasks: () => settleIndependentTasks
});
module.exports = __toCommonJS(pending_work_exports);
async function drainPendingWork(pending) {
  while (pending.size > 0) {
    await Promise.all([...pending]);
  }
}
function enqueueSerializedWork(queues, key, task) {
  var _a;
  const previous = (_a = queues.get(key)) != null ? _a : Promise.resolve();
  const current = previous.then(task, task);
  queues.set(key, current);
  void current.then(
    () => {
      if (queues.get(key) === current) {
        queues.delete(key);
      }
    },
    () => {
      if (queues.get(key) === current) {
        queues.delete(key);
      }
    }
  );
  return current;
}
async function settleIndependentTasks(tasks) {
  return Promise.allSettled(tasks);
}
function acquireExclusiveWork(active, key) {
  if (active.has(key)) {
    return void 0;
  }
  active.add(key);
  let released = false;
  return () => {
    if (!released) {
      released = true;
      active.delete(key);
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  acquireExclusiveWork,
  drainPendingWork,
  enqueueSerializedWork,
  settleIndependentTasks
});
//# sourceMappingURL=pending-work.js.map
