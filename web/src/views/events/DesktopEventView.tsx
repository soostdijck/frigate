import NewReviewData from "@/components/dynamic/NewReviewData";
import ReviewFilterGroup from "@/components/filter/ReviewFilterGroup";
import PreviewThumbnailPlayer from "@/components/player/PreviewThumbnailPlayer";
import EventReviewTimeline from "@/components/timeline/EventReviewTimeline";
import ActivityIndicator from "@/components/ui/activity-indicator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FrigateConfig } from "@/types/frigateConfig";
import { ReviewFilter, ReviewSegment, ReviewSeverity } from "@/types/review";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LuFolderCheck } from "react-icons/lu";
import { MdCircle } from "react-icons/md";
import useSWR from "swr";

type DesktopEventViewProps = {
  reviewPages?: ReviewSegment[][];
  relevantPreviews?: Preview[];
  timeRange: { before: number; after: number };
  reachedEnd: boolean;
  isValidating: boolean;
  filter?: ReviewFilter;
  severity: ReviewSeverity;
  setSeverity: (severity: ReviewSeverity) => void;
  loadNextPage: () => void;
  markItemAsReviewed: (reviewId: string) => void;
  onSelectReview: (reviewId: string) => void;
  pullLatestData: () => void;
  updateFilter: (filter: ReviewFilter) => void;
};
export default function DesktopEventView({
  reviewPages,
  relevantPreviews,
  timeRange,
  reachedEnd,
  isValidating,
  filter,
  severity,
  setSeverity,
  loadNextPage,
  markItemAsReviewed,
  onSelectReview,
  pullLatestData,
  updateFilter,
}: DesktopEventViewProps) {
  const { data: config } = useSWR<FrigateConfig>("config");
  const contentRef = useRef<HTMLDivElement | null>(null);

  // review paging

  const reviewItems = useMemo(() => {
    const all: ReviewSegment[] = [];
    const alerts: ReviewSegment[] = [];
    const detections: ReviewSegment[] = [];
    const motion: ReviewSegment[] = [];

    reviewPages?.forEach((page) => {
      page.forEach((segment) => {
        all.push(segment);

        switch (segment.severity) {
          case "alert":
            alerts.push(segment);
            break;
          case "detection":
            detections.push(segment);
            break;
          default:
            motion.push(segment);
            break;
        }
      });
    });

    return {
      all: all,
      alert: alerts,
      detection: detections,
      significant_motion: motion,
    };
  }, [reviewPages]);

  const currentItems = useMemo(() => {
    const current = reviewItems[severity];

    if (!current || current.length == 0) {
      return null;
    }

    return current;
  }, [reviewItems, severity]);

  const showMinimap = useMemo(() => {
    if (!contentRef.current) {
      return false;
    }

    return contentRef.current.scrollHeight > contentRef.current.clientHeight;
  }, [contentRef.current?.scrollHeight, severity]);

  // review interaction

  const pagingObserver = useRef<IntersectionObserver | null>();
  const lastReviewRef = useCallback(
    (node: HTMLElement | null) => {
      if (isValidating) return;
      if (pagingObserver.current) pagingObserver.current.disconnect();
      try {
        pagingObserver.current = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting && !reachedEnd) {
            loadNextPage();
          }
        });
        if (node) pagingObserver.current.observe(node);
      } catch (e) {
        // no op
      }
    },
    [isValidating, reachedEnd]
  );

  const [minimap, setMinimap] = useState<string[]>([]);
  const minimapObserver = useRef<IntersectionObserver | null>();
  useEffect(() => {
    if (!contentRef.current) {
      return;
    }

    const visibleTimestamps = new Set<string>();
    minimapObserver.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const start = (entry.target as HTMLElement).dataset.start;

          if (!start) {
            return;
          }

          if (entry.isIntersecting) {
            visibleTimestamps.add(start);
          } else {
            visibleTimestamps.delete(start);
          }

          setMinimap([...visibleTimestamps]);
        });
      },
      { root: contentRef.current, threshold: 0.1 }
    );

    return () => {
      minimapObserver.current?.disconnect();
    };
  }, [contentRef]);
  const minimapRef = useCallback(
    (node: HTMLElement | null) => {
      if (!minimapObserver.current) {
        return;
      }

      try {
        if (node) minimapObserver.current.observe(node);
      } catch (e) {
        // no op
      }
    },
    [minimapObserver.current]
  );
  const minimapBounds = useMemo(() => {
    const data = {
      start: Math.floor(Date.now() / 1000) - 35 * 60,
      end: Math.floor(Date.now() / 1000) - 21 * 60,
    };
    const list = minimap.sort();

    if (list.length > 0) {
      data.end = parseFloat(list.at(-1)!!);
      data.start = parseFloat(list[0]);
    }

    return data;
  }, [minimap]);

  if (!config) {
    return <ActivityIndicator />;
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex justify-between mb-2">
        <ToggleGroup
          type="single"
          defaultValue="alert"
          size="sm"
          onValueChange={(value: ReviewSeverity) => setSeverity(value)}
        >
          <ToggleGroupItem
            className={`px-3 py-4 rounded-2xl ${
              severity == "alert" ? "" : "text-gray-500"
            }`}
            value="alert"
            aria-label="Select alerts"
          >
            <MdCircle className="w-2 h-2 mr-[10px] text-severity_alert" />
            Alerts
          </ToggleGroupItem>
          <ToggleGroupItem
            className={`px-3 py-4 rounded-2xl ${
              severity == "detection" ? "" : "text-gray-500"
            }`}
            value="detection"
            aria-label="Select detections"
          >
            <MdCircle className="w-2 h-2 mr-[10px] text-severity_detection" />
            Detections
          </ToggleGroupItem>
          <ToggleGroupItem
            className={`px-3 py-4 rounded-2xl ${
              severity == "significant_motion" ? "" : "text-gray-500"
            }`}
            value="significant_motion"
            aria-label="Select motion"
          >
            <MdCircle className="w-2 h-2 mr-[10px] text-severity_motion" />
            Motion
          </ToggleGroupItem>
        </ToggleGroup>
        <ReviewFilterGroup filter={filter} onUpdateFilter={updateFilter} />
      </div>

      <div className="flex h-full overflow-hidden">
        <div
          ref={contentRef}
          className="flex flex-1 flex-wrap content-start gap-2 overflow-y-auto no-scrollbar"
        >
          <NewReviewData
            className="absolute w-full z-30"
            contentRef={contentRef}
            severity={severity}
            pullLatestData={pullLatestData}
          />

          {reachedEnd && currentItems == null && (
            <div className="w-full h-full flex flex-col justify-center items-center">
              <LuFolderCheck className="w-16 h-16" />
              There are no {severity} items to review
            </div>
          )}

          <div className="w-full mr-4 md:grid md:grid-cols-3 3xl:grid-cols-4 gap-4">
            {currentItems ? (
              currentItems.map((value, segIdx) => {
                const lastRow = segIdx == reviewItems[severity].length - 1;
                const relevantPreview = Object.values(
                  relevantPreviews || []
                ).find(
                  (preview) =>
                    preview.camera == value.camera &&
                    preview.start < value.start_time &&
                    preview.end > value.end_time
                );

                return (
                  <div
                    key={value.id}
                    ref={lastRow ? lastReviewRef : minimapRef}
                    data-start={value.start_time}
                  >
                    <div className="aspect-video rounded-lg overflow-hidden">
                      <PreviewThumbnailPlayer
                        review={value}
                        relevantPreview={relevantPreview}
                        setReviewed={markItemAsReviewed}
                        onClick={onSelectReview}
                      />
                    </div>
                    {lastRow && !reachedEnd && <ActivityIndicator />}
                  </div>
                );
              })
            ) : (
              <div ref={lastReviewRef} />
            )}
          </div>
        </div>
        <div className="md:w-[100px] overflow-y-auto no-scrollbar">
          <EventReviewTimeline
            segmentDuration={60}
            timestampSpread={15}
            timelineStart={timeRange.before}
            timelineEnd={timeRange.after}
            showMinimap={showMinimap}
            minimapStartTime={minimapBounds.start}
            minimapEndTime={minimapBounds.end}
            events={reviewItems.all}
            severityType={severity}
            contentRef={contentRef}
          />
        </div>
      </div>
    </div>
  );
}
