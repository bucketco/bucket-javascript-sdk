import Ably from "ably/promises";

export async function openAblyConnection(authUrl: string, userId: string, channel: string, callback: (req: any) => void, debug?: boolean) {
  const client = new Ably.Realtime.Promise({
    authUrl: authUrl,
    log: { level: debug ? 4 : 1 },
    authParams: {
      userId,
    }
  });
  const c = client.channels.get(channel);
  await c.subscribe((message) => {
      callback(message.data);
  });
  return client;
}

export function closeAblyConnection(client: Ably.Types.RealtimePromise) {
  client.close();
}
