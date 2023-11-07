import * as userChainStore from "../store/userChainStore";
import * as userStore from "../store/userStore";
import * as workspaceChainStore from "../store/workspaceChainStore";
import * as workspaceMemberDevicesProofStore from "../store/workspaceMemberDevicesProofStore";
import * as workspaceStore from "../store/workspaceStore";
import * as sql from "./sql/sql";

export const createSqlTables = async () => {
  await sql.ready();

  workspaceStore.initialize();
  workspaceChainStore.initialize();
  workspaceMemberDevicesProofStore.initialize();
  userStore.initialize();
  userChainStore.initialize();
};
