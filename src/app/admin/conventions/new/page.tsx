import ConventionForm from "../ConventionForm";
import { createConventionAction } from "../actions";

export default function NewConventionPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">New convention</h1>
      <ConventionForm action={createConventionAction} submitLabel="Create" />
    </section>
  );
}
