import "server-only";
import { memoryStore } from "./memory";
import type { StallStore } from "./types";

// The Supabase-backed store plugs in here once the project keys are set.
export const store: StallStore = memoryStore;
