import sodium from "react-native-libsodium";
import { createCommentKey } from "../createCommentKey/createCommentKey";
import { recreateCommentKey } from "./recreateCommentKey";

beforeAll(async () => {
  await sodium.ready;
});

test("recreate commentKey", () => {
  const kdfKey = "3NmUk0ywlom5Re-ShkR_nE3lKLxq5FSJxm56YdbOJto";
  const commentKey = createCommentKey({ documentNameKey: kdfKey });
  const result = recreateCommentKey({
    documentNameKey: kdfKey,
    subkeyId: commentKey.subkeyId,
  });
  expect(result.key).toBe(commentKey.key);
});
