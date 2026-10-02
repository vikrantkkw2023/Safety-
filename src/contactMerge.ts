export type MergeableContact = {
  id: string;
  name: string;
  phone: string;
  relationship: string;
};

export function mergeContacts(
  local: MergeableContact[],
  remote: Array<{
    id: string;
    name: string;
    phone: string;
    relationship: string | null;
  }>
): MergeableContact[] {
  const result = [...local];
  const existingPhones = new Set(local.map((contact) => contact.phone.replace(/\D/g, "")));

  for (const contact of remote) {
    const normalizedPhone = contact.phone.replace(/\D/g, "");
    if (!normalizedPhone || existingPhones.has(normalizedPhone)) continue;

    result.push({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship || "Trusted contact",
    });
    existingPhones.add(normalizedPhone);
  }

  return result;
}
