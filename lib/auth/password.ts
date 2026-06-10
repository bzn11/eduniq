export const PASSWORD_MIN_LENGTH = 8;

export type PasswordRequirement = {
  id: string;
  label: string;
  met: boolean;
};

const REQUIREMENT_CHECKS: Array<{
  id: string;
  label: string;
  test: (password: string) => boolean;
}> = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "uppercase",
    label: "At least 1 uppercase letter",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "At least 1 lowercase letter",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "At least 1 number",
    test: (password) => /[0-9]/.test(password),
  },
];

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return REQUIREMENT_CHECKS.map(({ id, label, test }) => ({
    id,
    label,
    met: test(password),
  }));
}

export function isPasswordValid(password: string): boolean {
  return getPasswordRequirements(password).every((requirement) => requirement.met);
}

export function getPasswordValidationError(password: string): string | null {
  const unmet = getPasswordRequirements(password).find((requirement) => !requirement.met);
  return unmet ? unmet.label : null;
}
