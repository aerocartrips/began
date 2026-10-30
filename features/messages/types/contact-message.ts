export type ContactMessageInput = {
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
};

export type ContactMessage = ContactMessageInput & {
  id: string;
  createdAt: string;
  readAt: string | null;
  status: "new" | "read" | "archived";
};

export type ContactFieldErrors = Partial<Record<keyof ContactMessageInput, string>>;