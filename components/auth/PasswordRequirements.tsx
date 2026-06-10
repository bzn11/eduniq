import { getPasswordRequirements } from "@/lib/auth/password";

type PasswordRequirementsProps = {
  password: string;
};

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const requirements = getPasswordRequirements(password);

  return (
    <ul className="mt-2 space-y-1" aria-label="Password requirements">
      {requirements.map((requirement) => (
        <li
          key={requirement.id}
          className={`flex items-center gap-2 text-xs ${
            requirement.met ? "text-emerald-700" : "text-zinc-500"
          }`}
        >
          <span aria-hidden="true">{requirement.met ? "✓" : "○"}</span>
          <span>{requirement.label}</span>
        </li>
      ))}
    </ul>
  );
}
