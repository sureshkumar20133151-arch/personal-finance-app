export const OWNER_EMAILS = [
  'sureshkumar20133151@gmail.com',
  'solodeveloper.suresh@gmail.com'
];

export function isAppOwner(email) {
  if (!email) return false;
  return OWNER_EMAILS.includes(email.toLowerCase().trim());
}
