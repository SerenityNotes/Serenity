import { ApolloServer } from "apollo-server-express";
import {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageDisabled,
} from "apollo-server-core";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { createServer as httpCreateServer } from "http";
import { schema } from "./schema";
import { addUpdate, addConnection, removeConnection } from "./store";
import { getDocument } from "./database/getDocument";
import { createSnapshot } from "./database/createSnapshot";
import { createUpdate } from "./database/createUpdate";
import { getUpdatesForDocument } from "./database/getUpdatesForDocument";
import { retryAsyncFunction } from "./retryAsyncFunction";
import {
  NaishoSnapshotMissesUpdatesError,
  NaishoSnapshotBasedOnOutdatedSnapshotError,
  UpdateWithServerData,
} from "@naisho/core";
import { getSessionIncludingUser } from "./database/authentication/getSessionIncludingUser";

export default async function createServer() {
  const apolloServer = new ApolloServer({
    schema,
    plugins: [
      process.env.NODE_ENV === "production"
        ? ApolloServerPluginLandingPageDisabled()
        : ApolloServerPluginLandingPageGraphQLPlayground(),
    ],
    context: async (request) => {
      if (request.req.headers.authorization) {
        const session = await getSessionIncludingUser({
          sessionKey: request.req.headers.authorization,
        });
        if (session && session.user) {
          return {
            session,
            user: session.user,
          };
        }
      }
      return {};
    },
    mocks: process.env.MOCK_GRAPHQL
      ? {
          // should be unique for all the IDs and keys
          String: () => (Math.random() + 1).toString(36).substring(2),
        }
      : false,
  });
  await apolloServer.start();

  // on staging we also want the dev setup to be able to connect
  const allowedList = [
    "http://localhost:19006",
    "https://www.serenity.li",
    "http://localhost:4000",
  ];
  const allowedOrigin = (origin, callback) => {
    console.log({ origin });
    if (allowedList.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  };
  const corsOptions = { credentials: true, origin: allowedOrigin };
  const app = express();
  app.use(cors(corsOptions));
  apolloServer.applyMiddleware({ app, cors: corsOptions });

  const server = httpCreateServer(app);

  const webSocketServer = new WebSocketServer({ noServer: true });
  webSocketServer.on(
    "connection",
    async function connection(connection, request) {
      // unique id for each client connection

      console.log("connected");

      const documentId = request.url?.slice(1)?.split("?")[0] || "";

      let doc = await getDocument(documentId);
      if (!doc) {
        // TODO close connection properly
        connection.send(JSON.stringify({ type: "documentNotFound" }));
        connection.close();
        return;
      }
      addConnection(documentId, connection);
      connection.send(JSON.stringify({ type: "document", ...doc }));

      connection.on("message", async function message(messageContent) {
        const data = JSON.parse(messageContent.toString());

        if (data?.publicData?.snapshotId) {
          try {
            const activeSnapshotInfo =
              data.lastKnownSnapshotId && data.latestServerVersion
                ? {
                    latestVersion: data.latestServerVersion,
                    snapshotId: data.lastKnownSnapshotId,
                  }
                : undefined;
            const snapshot = await createSnapshot(data, activeSnapshotInfo);
            console.log("addUpdate snapshot");
            connection.send(
              JSON.stringify({
                type: "snapshotSaved",
                snapshotId: snapshot.id,
                docId: snapshot.documentId,
              })
            );
            addUpdate(
              documentId,
              {
                ...data,
                type: "snapshot",
                serverData: {
                  latestVersion: snapshot.latestVersion,
                },
              },
              connection
            );
          } catch (error) {
            if (error instanceof NaishoSnapshotBasedOnOutdatedSnapshotError) {
              let doc = await getDocument(documentId);
              if (!doc) return; // should never be the case?
              connection.send(
                JSON.stringify({
                  type: "snapshotFailed",
                  docId: data.publicData.docId,
                  snapshot: doc.snapshot,
                  updates: doc.updates,
                })
              );
            } else if (error instanceof NaishoSnapshotMissesUpdatesError) {
              const result = await getUpdatesForDocument(
                documentId,
                data.lastKnownSnapshotId,
                data.latestServerVersion
              );
              connection.send(
                JSON.stringify({
                  type: "snapshotFailed",
                  docId: data.publicData.docId,
                  updates: result.updates,
                })
              );
            } else {
              console.error(error);
              connection.send(
                JSON.stringify({
                  type: "snapshotFailed",
                })
              );
            }
          }
        } else if (data?.publicData?.refSnapshotId) {
          let savedUpdate: undefined | UpdateWithServerData = undefined;
          try {
            // const random = Math.floor(Math.random() * 10);
            // if (random < 8) {
            //   throw new Error("CUSTOM ERROR");
            // }

            // TODO add a smart queue to create an offset based on the version?
            savedUpdate = await retryAsyncFunction(() => createUpdate(data));
            if (savedUpdate === undefined) {
              throw new Error("Update could not be saved.");
            }

            connection.send(
              JSON.stringify({
                type: "updateSaved",
                docId: data.publicData.docId,
                snapshotId: data.publicData.refSnapshotId,
                clock: data.publicData.clock,
                // @ts-expect-error not sure why savedUpdate is "never"
                serverVersion: savedUpdate.version,
              })
            );
            console.log("addUpdate update");
            addUpdate(
              documentId,
              // @ts-expect-error not sure why savedUpdate is "never"
              { ...savedUpdate, type: "update" },
              connection
            );
          } catch (err) {
            if (savedUpdate === null || savedUpdate === undefined) {
              connection.send(
                JSON.stringify({
                  type: "updateFailed",
                  docId: data.publicData.docId,
                  snapshotId: data.publicData.refSnapshotId,
                  clock: data.publicData.clock,
                })
              );
            }
          }
        } else {
          console.log("addUpdate awarenessUpdate");
          addUpdate(
            documentId,
            { ...data, type: "awarenessUpdate" },
            connection
          );
        }
      });

      connection.on("close", function () {
        console.log("close connection");
        removeConnection(documentId, connection);
      });
    }
  );

  server.on("upgrade", (request, socket, head) => {
    // @ts-ignore
    webSocketServer.handleUpgrade(request, socket, head, (ws) => {
      webSocketServer.emit("connection", ws, request);
    });
  });

  return server;
}
