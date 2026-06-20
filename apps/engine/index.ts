import { reply } from "./redis/publisher";
import { dispatch } from "./handlers";
import { reader, publisher } from "./redis/client";
import {
  loadSnapshot,
  restoreSnapshot,
  startSnapshotScheduler,
} from "./snapshot";

startSnapshotScheduler();
const snapshot = await loadSnapshot();
if (snapshot) restoreSnapshot(snapshot);

const GROUP = "engine";
const CONSUMER = "engine-1";
const STREAM = "to-engine";

await reader.connect();
await publisher.connect();

async function ensureGroup() {
  try {
    await reader.xGroupCreate(STREAM, GROUP, "$", { MKSTREAM: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("BUSYGROUP")) {
      // if the group already exists, we don't need to throe an error
      return;
    }
    throw error;
  }
}

while (true) {
  await ensureGroup();
  const response = await reader.xReadGroup(
    GROUP,
    CONSUMER,
    {
      key: STREAM,
      id: ">",
    },
    {
      BLOCK: 1000,
      COUNT: 1,
    },
  );
  if (!response || response.length === 0) {
    console.log("no response");
    continue;
  }
  console.log("response received in engine", response);
  for (const batch of response) {
    for (const messages of batch.messages) {
      const message = messages.message;
      try {
        const result = await dispatch(message);
        await reply(message.correlationId, result);
        console.log(
          "engine replied to to-backend",
          message.correlationId,
          result,
        );
      } catch (error) {
        await reply(message.correlationId, {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "failed to dispatch message",
        });
      }
      await reader.xAck(STREAM, GROUP, messages.id);
    }
  }
}
