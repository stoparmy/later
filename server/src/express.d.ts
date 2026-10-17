import type { DashboardActor, DashboardAuthBundle } from "./types";

declare global {
  namespace Express {
    interface Request {
      laterActor?: DashboardActor;
      laterDashboardAuth?: DashboardAuthBundle;
    }
  }
}

export {};
