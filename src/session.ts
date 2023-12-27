interface Session {
  id: string;
  updated: number;
}

function putSessionId(id?: string) {
  if (!id) {
    id = [Math.random(), Math.random()]
      .map((m) => m.toString(36).substring(2))
      .join("");
  }
  
  const session = JSON.stringify({
    id,
    updated: Date.now(),
  } satisfies Session);

  sessionStorage.setItem("bucket-session", session);
}

export const getSessionId = (expirySec: number): string => {
  let val = sessionStorage.getItem("bucket-session");
  if (!val) {
    putSessionId();
    return getSessionId(expirySec);
  }

  const { id, updated } = JSON.parse(val) as Session;
  if (new Date(updated + expirySec * 1000) < new Date()) {
    putSessionId();
    return getSessionId(expirySec);
  }

  // update expiry
  putSessionId(id);

  return id;
};
