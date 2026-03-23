import { EmptyState } from "@/components/StateBlock";

function videoTypeFor(url: string) {
  if (url.endsWith('.mp4')) return 'video/mp4';
  if (url.endsWith('.webm')) return 'video/webm';
  return undefined;
}

export function ReplayVideo({
  url,
  className,
  maxHeightClass = 'max-h-[320px]',
}: {
  url?: string | null;
  className?: string;
  maxHeightClass?: string;
}) {
  if (!url) return <EmptyState message="No replay yet for this run." className="bg-transparent" />;

  const mp4Url = url.endsWith('.webm') ? url.replace(/\.webm$/, '.mp4') : url;
  const webmUrl = url.endsWith('.mp4') ? url.replace(/\.mp4$/, '.webm') : url;

  return (
    <video controls playsInline preload="metadata" className={`${maxHeightClass} w-full rounded-lg border border-border bg-black ${className || ''}`.trim()}>
      <source src={mp4Url} type={videoTypeFor(mp4Url)} />
      {webmUrl !== mp4Url ? <source src={webmUrl} type={videoTypeFor(webmUrl)} /> : null}
      <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">Open replay</a>
    </video>
  );
}
