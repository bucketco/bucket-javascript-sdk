import {record as rrRecord} from "rrweb";

import { BulkEvent } from "./types";
import { getSessionId } from "./session";

const MAX_BUFFER_SIZE = 1024;
const MAX_BUFFER_TIME = 1000 * 20; // 20s


export default function record(userId: string, sessionExpirySec: number, bulkSend: (events: BulkEvent[]) => Promise<Response>){
  let buffer: BulkEvent[] = [];

  function flush() {
    if (buffer.length === 0) return;
    bulkSend(buffer);
    buffer = [] // don't use `.length=0` because we might have huge, one-off snapshots that we want gc'ed
  }

  const flushTimer = setInterval(flush, MAX_BUFFER_TIME);

  const stopRecording = rrRecord({
    emit({timestamp, ...event}) {
      buffer.push({
        timestamp,
        event,
        userId,
        sessionId: getSessionId(sessionExpirySec),
        recordingData: JSON.stringify(event),
        type: 'session-recording'
    });
      if (buffer.length >= MAX_BUFFER_SIZE) {
       flush()
      }
    }
  })

  return () => {
    clearInterval(flushTimer);
    flush();
    if (stopRecording) stopRecording();
  }
}
