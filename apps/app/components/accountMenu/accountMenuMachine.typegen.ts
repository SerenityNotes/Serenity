// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  "@@xstate/typegen": true;
  internalEvents: {
    "xstate.init": { type: "xstate.init" };
  };
  invokeSrcNameMap: {};
  missingImplementations: {
    actions: never;
    delays: never;
    guards: never;
    services: never;
  };
  eventsCausingActions: {
    showErrorToast:
      | "MeQuery.ERROR"
      | "WorkspaceQuery.ERROR"
      | "WorkspacesQuery.ERROR";
    spawnActors: "xstate.init";
  };
  eventsCausingDelays: {};
  eventsCausingGuards: {};
  eventsCausingServices: {};
  matchesStates: "idle";
  tags: never;
}
