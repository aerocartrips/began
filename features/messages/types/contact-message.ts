export type ContactMessageInput = {
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
};

export type ContactFieldErrors = Partial<Record<keyof ContactMessageInput, string>>;
