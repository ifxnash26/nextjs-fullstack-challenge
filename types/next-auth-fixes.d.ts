declare module "next-auth" {
  export type AuthOptions = import("next-auth/core/types").AuthOptions;
}

declare module "next-auth/next" {
  import type { AuthOptions, Session } from "next-auth";
  export function getServerSession(...args: any[]): Promise<Session | null>;
  const _default: (options: AuthOptions) => any;
  export default _default;
}
