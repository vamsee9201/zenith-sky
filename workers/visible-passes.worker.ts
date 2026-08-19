/// <reference lib="webworker" />

import { predictVisiblePasses } from "@/lib/visibility";
import type { PassWorkerRequest, PassWorkerResponse } from "@/lib/types";

const worker = self as DedicatedWorkerGlobalScope;

worker.addEventListener("message", (event: MessageEvent<PassWorkerRequest>) => {
  const request = event.data;
  if (request.type !== "predict") return;
  try {
    const passes = predictVisiblePasses(request.objects, request.observer, new Date(request.calculationTime));
    const response: PassWorkerResponse = { type: "result", requestId: request.requestId, passes };
    worker.postMessage(response);
  } catch (error) {
    const response: PassWorkerResponse = {
      type: "error",
      requestId: request.requestId,
      message: error instanceof Error ? error.message : "Pass prediction failed.",
    };
    worker.postMessage(response);
  }
});

export {};
