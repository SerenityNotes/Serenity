import { idArg, nonNull, queryField } from "nexus";
import { getDocuments } from "../../../database/document/getDocuments";
import { Document } from "../../types/document";

export const workspaces = queryField((t) => {
  // @ts-ignore sometimes the type is defined, sometimes not
  t.connectionField("documents", {
    type: Document,
    disableBackwardPagination: true,
    cursorFromNode: (node) => node?.id ?? "",
    additionalArgs: {
      parentFolderId: nonNull(idArg()),
    },
    async nodes(root, args, context) {
      if (args.first > 50) {
        throw new Error(
          "Requested too many documents. First value exceeds 50."
        );
      }
      if (!context.user) {
        throw new Error("Unauthorized");
      }
      const userId = context.user.id;
      const cursor = args.after ? { id: args.after } : undefined;
      // prisma will include the cursor if skip: 1 is not set
      // https://www.prisma.io/docs/concepts/components/prisma-client/pagination#do-i-always-have-to-skip-1
      const skip = cursor ? 1 : undefined;
      // include one extra project to set hasNextPage value
      const take: any = args.first ? args.first + 1 : undefined;
      const parentFolderId = args.parentFolderId;

      const folders = await getDocuments({
        userId,
        parentFolderId,
        cursor,
        skip,
        take,
      });
      return folders;
    },
  });
});
