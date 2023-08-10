import Ably from "ably/promises";

const ablyChannel = "feedback"

export async function openAblyConnection(authUrl: string, userId: string, callback: (req: any) => void) {
  const client = new Ably.Realtime.Promise({
      authUrl: authUrl,
      authParams: {
          userId,
      }
  });
  const c = client.channels.get(ablyChannel);
  await c.subscribe((message) => {
      callback(message.data);
  });
  return client;
}

export function closeAblyConnection(client: Ably.Types.RealtimePromise) {
  client.channels.release(ablyChannel)
  client.close();
}
