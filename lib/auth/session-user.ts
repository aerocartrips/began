/** The signed-in user as the storefront shell shows it. Safe to send to the browser. */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
};

type UserRecord = {
  _id: unknown;
  name?: string | null;
  email?: string | null;
  avatar?: { url?: string | null } | null;
};

export function toSessionUser(user: UserRecord): SessionUser {
  return {
    id: String(user._id),
    name: user.name ?? "",
    email: user.email ?? "",
    avatarUrl: user.avatar?.url ?? "",
  };
}
