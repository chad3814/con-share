import Link from "next/link";
import { listOpenReports } from "@/lib/reports";
import { publicUrl } from "@/lib/s3";
import { takedownPhotoAction, dismissReportAction } from "./actions";

export default async function AdminReportsPage() {
  const reports = await listOpenReports();

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Moderation queue</h1>
      {reports.length === 0 ? (
        <p className="text-gray-500">No open reports.</p>
      ) : (
        <ul className="space-y-4">
          {reports.map((report) => {
            const photoHref = `/c/${report.photo.convention.slug}/p/${report.photo.id}`;
            const reporterLabel =
              report.reporter?.displayName ?? report.reporter?.email ?? "Anonymous";
            return (
              <li key={report.id} className="rounded border border-gray-200 p-4">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Link href={photoHref} className="block shrink-0">
                    {report.photo.thumbKey ? (
                      <img
                        src={publicUrl(report.photo.thumbKey)}
                        alt="Reported photo thumbnail"
                        className="h-24 w-24 rounded object-cover"
                      />
                    ) : (
                      <span className="flex h-24 w-24 items-center justify-center rounded bg-gray-100 p-2 text-center text-xs text-gray-500">
                        no preview (status: {report.photo.status})
                      </span>
                    )}
                  </Link>
                  <div className="flex-1 space-y-1 text-sm">
                    <p className="font-medium">{report.photo.convention.name}</p>
                    <p className="text-gray-700">Category: {report.category}</p>
                    {report.message ? <p className="text-gray-700">{report.message}</p> : null}
                    <p className="text-gray-500">Reporter: {reporterLabel}</p>
                    <p className="text-gray-500">
                      Reported: {report.createdAt.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <form
                    action={takedownPhotoAction.bind(null, report.photo.id)}
                    className="flex flex-1 gap-2"
                  >
                    <input
                      name="reason"
                      placeholder="Reason (optional)"
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      className="whitespace-nowrap rounded bg-red-700 px-3 py-1.5 text-sm text-white"
                    >
                      Take down photo
                    </button>
                  </form>
                  <form
                    action={dismissReportAction.bind(null, report.id)}
                    className="flex flex-1 gap-2"
                  >
                    <input
                      name="note"
                      placeholder="Note (optional)"
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      className="whitespace-nowrap rounded bg-gray-900 px-3 py-1.5 text-sm text-white"
                    >
                      Dismiss report
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
