import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import type { BookingDetail } from "@repo/api-contracts";
import { Dialog } from "../components/Dialog";
import { AppText, Badge, Banner, Button, Card, EmptyState, LoadingBlock, SegmentedControl } from "../components/ui";
import { MobileApiClient, type ClassesFilter } from "../lib/api-client";
import { formatDateTime, formatNumber, formatTime, minutesBetween } from "../lib/format";
import { openWebLink, WebLinks } from "../lib/links";
import { liveVideoAvailable } from "../live/registerGlobals";
import { useTheme } from "../theme/ThemeProvider";
import { layout, spacing } from "../theme/tokens";

const FILTERS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
] as const;

/**
 * A classroom opens 10 minutes before the scheduled start and closes 10 minutes
 * after the scheduled end — the same defaults the token endpoint enforces
 * (packages/live-classes getJoinWindow), so the button matches what the server accepts.
 */
const JOIN_OPENS_MINUTES_BEFORE = 10;
const JOIN_GRACE_MINUTES_AFTER = 10;

function joinWindow(booking: BookingDetail, now: number) {
  const start = new Date(booking.slotStart).getTime();
  const closesAt = new Date(booking.slotEnd).getTime() + JOIN_GRACE_MINUTES_AFTER * 60_000;
  const opensAt = start - JOIN_OPENS_MINUTES_BEFORE * 60_000;
  return { canJoin: now >= opensAt && now <= closesAt, opensAt: new Date(opensAt), ended: now > closesAt };
}

const STATUS_TONE = {
  PENDING: "action",
  CONFIRMED: "trust",
  COMPLETED: "brand",
  CANCELLED: "alert",
} as const;

const STATUS_LABEL = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;

export function ClassesScreen({
  onBrowseTeachers,
  onJoinLive,
}: {
  onBrowseTeachers: () => void;
  /** Opens the in-app live classroom for a class session. */
  onJoinLive: (classSessionId: string) => void;
}) {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<ClassesFilter>("upcoming");
  const [bookings, setBookings] = useState<BookingDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [joinTarget, setJoinTarget] = useState<BookingDetail | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Re-evaluate join windows while the screen is open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(
    async (mode: "replace" | "refresh") => {
      const id = ++requestId.current;
      setError(null);
      if (mode === "replace") setLoading(true);
      else setRefreshing(true);
      try {
        const result = await MobileApiClient.getClasses(filter);
        if (id !== requestId.current) return;
        const sorted = [...result.bookings].sort((a, b) => {
          const diff = new Date(a.slotStart).getTime() - new Date(b.slotStart).getTime();
          return filter === "upcoming" ? diff : -diff;
        });
        setBookings(sorted);
        setNow(Date.now());
      } catch (err) {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : "Couldn't load your classes.");
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [filter]
  );

  useEffect(() => {
    void load("replace");
  }, [load]);

  const emptyCopy: Record<ClassesFilter, { title: string; message: string }> = {
    upcoming: { title: "No upcoming classes", message: "Book a lesson with a verified teacher to get started." },
    past: { title: "No past classes yet", message: "Completed lessons will show up here." },
    cancelled: { title: "No cancelled classes", message: "Classes you cancel will show up here." },
  };

  return (
    <>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} tintColor={colors.action} colors={[colors.action]} />
        }
      >
        <AppText variant="h1">My classes</AppText>
        <AppText tone="muted" style={styles.subtitle}>
          Your 1-on-1 live lessons.
        </AppText>

        <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />

        {error ? <Banner tone="alert" message={error} actionLabel="Try again" onAction={() => void load("replace")} /> : null}
        {linkError ? <Banner tone="alert" message={linkError} /> : null}

        {loading ? (
          <LoadingBlock label="Loading classes…" />
        ) : bookings.length === 0 && !error ? (
          <EmptyState
            icon="📅"
            title={emptyCopy[filter].title}
            message={emptyCopy[filter].message}
            actionLabel={filter === "upcoming" ? "Find a teacher" : undefined}
            onAction={filter === "upcoming" ? onBrowseTeachers : undefined}
          />
        ) : (
          bookings.map((booking) => {
            const slotWindow = joinWindow(booking, now);
            const joinable = filter === "upcoming" && (booking.status === "CONFIRMED" || booking.status === "PENDING");
            return (
              <Card key={booking.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Badge label={formatDateTime(booking.slotStart)} tone="brand" />
                  <Badge label={STATUS_LABEL[booking.status]} tone={STATUS_TONE[booking.status]} />
                </View>
                <AppText variant="h3" style={{ marginTop: spacing.md }}>
                  {booking.teacherName}
                </AppText>
                <AppText variant="small" tone="muted">
                  1-on-1 lesson · {minutesBetween(booking.slotStart, booking.slotEnd)} min · 🪙 {formatNumber(booking.coinCost)} coins
                </AppText>

                {joinable ? (
                  slotWindow.canJoin ? (
                    <Button
                      label="Join classroom"
                      onPress={() => {
                        // In-app video needs the native LiveKit module (dev/release
                        // build) and a scheduled session; otherwise use the web classroom.
                        if (liveVideoAvailable && booking.sessionId) onJoinLive(booking.sessionId);
                        else setJoinTarget(booking);
                      }}
                      style={styles.joinButton}
                    />
                  ) : slotWindow.ended ? (
                    <AppText variant="small" tone="muted" style={styles.joinHint}>
                      This class time has passed.
                    </AppText>
                  ) : (
                    <AppText variant="small" tone="muted" style={styles.joinHint}>
                      Classroom opens at {formatTime(slotWindow.opensAt)} ({JOIN_OPENS_MINUTES_BEFORE} min before start).
                    </AppText>
                  )
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>

      <Dialog
        visible={Boolean(joinTarget)}
        title="Join your classroom"
        message={
          "Live video isn't available in this version of the app. " +
          "Your classroom will open on the Language Metrics student portal — sign in there with this same account."
        }
        onDismiss={() => setJoinTarget(null)}
        actions={[
          {
            label: "Open classroom",
            onPress: async () => {
              const target = joinTarget;
              setJoinTarget(null);
              if (!target) return;
              const opened = await openWebLink(WebLinks.classroom(target.sessionId ?? target.id));
              setLinkError(opened ? null : "Couldn't open your browser. Visit the student portal to join the class.");
            },
          },
          { label: "Not now", variant: "outline", onPress: () => setJoinTarget(null) },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: layout.screenPadding,
    paddingBottom: spacing["3xl"],
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.lg },
  card: { marginBottom: spacing.md },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  joinButton: { marginTop: spacing.lg },
  joinHint: { marginTop: spacing.md },
});
