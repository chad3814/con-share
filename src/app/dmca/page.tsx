import DmcaForm from "./DmcaForm";

export default function DmcaPage() {
  return (
    <section className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">DMCA / Copyright Takedown</h1>
      <p className="text-sm text-muted-foreground">
        If you believe a photo hosted on con-share infringes your copyright,
        use this form to file a takedown notice. We will review your report
        and take action on valid claims.
      </p>
      <DmcaForm />
    </section>
  );
}
