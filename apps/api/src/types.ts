import type { Auth } from "./auth";
import type { DB } from "./db";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    db: DB;
    auth: Auth;
    userId: string;
  };
};
