import * as userChain from "@serenity-kit/user-chain";
import {
  arg,
  inputObjectType,
  mutationField,
  nonNull,
  objectType,
} from "nexus";
import { finalizeRegistration } from "../../../database/authentication/finalizeRegistration";

export const FinishRegistrationDeviceInput = inputObjectType({
  name: "FinishRegistrationDeviceInput",
  definition(t) {
    t.nonNull.string("ciphertext");
    t.nonNull.string("nonce");
    t.nonNull.string("signingPublicKey");
    t.nonNull.string("encryptionPublicKey");
    t.nonNull.string("encryptionPublicKeySignature");
  },
});

export const FinishRegistrationInput = inputObjectType({
  name: "FinishRegistrationInput",
  definition(t) {
    t.nonNull.string("registrationRecord");
    t.nonNull.field("mainDevice", { type: FinishRegistrationDeviceInput });
    t.string("pendingWorkspaceInvitationId");
    t.int("pendingWorkspaceInvitationKeySubkeyId");
    t.string("pendingWorkspaceInvitationKeyCiphertext");
    t.string("pendingWorkspaceInvitationKeyPublicNonce");
    t.nonNull.string("serializedUserChainEvent");
  },
});

export const FinishRegistrationResult = objectType({
  name: "FinishRegistrationResult",
  definition(t) {
    t.nonNull.string("id");
    t.string("verificationCode"); // TODO remove once email verifiaction is implemented
  },
});

export const finishRegistrationMutation = mutationField("finishRegistration", {
  type: FinishRegistrationResult,
  args: {
    input: nonNull(
      arg({
        type: FinishRegistrationInput,
      })
    ),
  },
  async resolve(root, args, context) {
    if (!process.env.OPAQUE_SERVER_SETUP) {
      throw new Error("Missing process.env.OPAQUE_SERVER_SETUP");
    }

    const createChainEvent = userChain.CreateUserChainEvent.parse(
      JSON.parse(args.input.serializedUserChainEvent)
    );

    const unverifiedUser = await finalizeRegistration({
      registrationRecord: args.input.registrationRecord,
      mainDevice: args.input.mainDevice,
      pendingWorkspaceInvitationId: args.input.pendingWorkspaceInvitationId,
      pendingWorkspaceInvitationKeySubkeyId:
        args.input.pendingWorkspaceInvitationKeySubkeyId,
      pendingWorkspaceInvitationKeyCiphertext:
        args.input.pendingWorkspaceInvitationKeyCiphertext,
      pendingWorkspaceInvitationKeyPublicNonce:
        args.input.pendingWorkspaceInvitationKeyPublicNonce,
      createChainEvent,
    });

    let verificationCode: null | string = null;

    // expose verification code to the client only in the following
    // environments: development, staging and e2e
    if (
      process.env.SERENITY_ENV === "e2e" ||
      process.env.SERENITY_ENV === "development" ||
      process.env.SERENITY_ENV === "staging"
    ) {
      verificationCode = unverifiedUser.confirmationCode;
    }

    return {
      id: unverifiedUser.id,
      verificationCode,
    };
  },
});
