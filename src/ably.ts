import Ably from "ably/promises";

export async function openAblyConnection(
  authUrl: string,
  userId: string,
  channel: string,
  callback: (req: object) => void,
  debug?: boolean
) {
  const client = new Ably.Realtime.Promise({
    authUrl: authUrl,
    log: { level: debug ? 4 : 1 },
    authParams: {
      userId,
    },
  });
  const c = client.channels.get(channel, {
    params: {
      rewind: "1",
    },
  });
  await c.subscribe((message) => {
    callback(message.data);
  });
  return client;
}

export function closeAblyConnection(client: Ably.Types.RealtimePromise) {
  client.close();
}
