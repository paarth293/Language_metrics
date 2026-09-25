import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BookingDetail, TeacherCard } from "@repo/api-contracts";
import { useAuth } from "../auth/AuthProvider";
import { AppText, Avatar, Banner, Button, Chip, Divider, SegmentedControl } from "../components/ui";
import { ApiError, MobileApiClient } from "../lib/api-client";
import { formatDateTime, formatDayLabel, formatNumber, formatTime, initials } from "../lib/format";
import { useTheme } from "../theme/ThemeProvider";
import { radii, spacing } from "../theme/tokens";

const DURATIONS = [
  { value: "30", label: "30 min" },
  { value: "60", label: "60 min" },
  { value: "90", label: "90 min" },
] as const;
type DurationValue = (typeof DURATIONS)[number]["value"];

const DAYS_AHEAD = 7;
const FIRST_HOUR = 8; // 08:00
const LAST_HOUR = 21; // last slot starts 21:00
/** Server rejects past start times; keep a buffer so a slot can't expire mid-checkout. */
const MIN_LEAD_MINUTES = 30;

function buildDays(now: Date): Date[] {
  return Array.from({ length: DAYS_AHEAD }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i));
}

function buildSlots(day: Date): Date[] {
  const slots: Date[] = [];
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour++) {
    slots.push(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0));
  }
  return slots;
}

function isSlotAvailable(slot: Date, now: Date): boolean {
  return slot.getTime() >= now.getTime() + MIN_LEAD_MINUTES * 60_000;
}

/**
 * Booking flow (mirrors web: select slot → review cost → pay with coins → confirmation).
 * Calls POST /api/v1/bookings, which checks the balance and deducts coins inside a
 * Serializable transaction; the balance shown afterwards comes from the server.
 */
export function BookingSheet({
  teacher,
  onClose,
  onViewClasses,
  onTopUp,
}: {
  teacher: TeacherCard | null;
  onClose: () => void;
  onViewClasses: () => void;
  onTopUp: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { coinBalance, refreshBalance } = useAuth();

  const [now, setNow] = useState(() => new Date());
  const days = useMemo(() => buildDays(now), [now]);
  const [dayIndex, setDayIndex] = useState(0);
  const [slot, setSlot] = useState<Date | null>(null);
  const [duration, setDuration] = useState<DurationValue>("60");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<BookingDetail | null>(null);

  // Reset whenever the sheet opens for a (new) teacher.
  useEffect(() => {
    if (!teacher) return;
    const current = new Date();
    setNow(current);
    const firstDayWithSlots = buildDays(current).findIndex((d) => buildSlots(d).some((s) => isSlotAvailable(s, current)));
    setDayIndex(Math.max(0, firstDayWithSlots));
    setSlot(null);
    setDuration("60");
    setError(null);
    setBooked(null);
    setSubmitting(false);
    void refreshBalance();
  }, [teacher, refreshBalance]);

  if (!teacher) return null;

  const durationMinutes = Number(duration);
  const cost = Math.round((teacher.hourlyRate * durationMinutes) / 60);
  const insufficient = coinBalance < cost;
  const slots = buildSlots(days[dayIndex]);

  const confirm = async () => {
    if (!slot || submitting) return;
    if (!isSlotAvailable(slot, new Date())) {
      setError("That time is no longer available. Please pick a later slot.");
      setSlot(null);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const booking = await MobileApiClient.createBooking({
        teacherId: teacher.id,
        slotStart: slot.toISOString(),
        durationMinutes,
      });
      setBooked(booking);
      await refreshBalance();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Booking failed. Please try again.");
      await refreshBalance();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.scrim, { backgroundColor: colors.overlay }]}>
        <Pressable style={styles.dismissArea} accessibilityRole="button" accessibilityLabel="Close booking" onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />

          {booked ? (
            <View style={styles.success}>
              <View style={[styles.successIcon, { backgroundColor: colors.trustSubtle }]}>
                <AppText variant="h1" tone="trust">
                  ✓
                </AppText>
              </View>
              <AppText variant="h2" style={styles.centerText}>
                Lesson booked
              </AppText>
              <AppText tone="muted" style={[styles.centerText, { marginTop: spacing.sm }]}>
                {booked.teacherName} · {formatDateTime(booked.slotStart)}
              </AppText>
              <AppText variant="small" tone="subtle" style={[styles.centerText, { marginTop: spacing.xs }]}>
                {formatNumber(booked.coinCost)} coins paid · New balance {formatNumber(coinBalance)} coins
              </AppText>
              <Button label="View my classes" onPress={onViewClasses} style={styles.fullWidth} />
              <Button label="Done" variant="outline" onPress={onClose} style={[styles.fullWidth, { marginTop: spacing.sm }]} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <View style={styles.teacherRow}>
                <Avatar label={initials(teacher.name)} size={44} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <AppText variant="h3">Book a lesson with {teacher.name}</AppText>
                  <AppText variant="small" tone="muted">
                    {teacher.languages.join(", ") || "1-on-1 lesson"} · 🪙 {formatNumber(teacher.hourlyRate)} coins / hr
                  </AppText>
                </View>
              </View>

              <AppText variant="label" tone="subtle" style={styles.sectionLabel}>
                Select class duration
              </AppText>
              <SegmentedControl options={DURATIONS} value={duration} onChange={setDuration} />

              <AppText variant="label" tone="subtle" style={styles.sectionLabel}>
                Pick a day
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
                {days.map((day, index) => {
                  const hasSlots = buildSlots(day).some((s) => isSlotAvailable(s, now));
                  return (
                    <Chip
                      key={day.toISOString()}
                      label={formatDayLabel(day, now)}
                      selected={index === dayIndex}
                      disabled={!hasSlots}
                      onPress={() => {
                        setDayIndex(index);
                        setSlot(null);
                      }}
                    />
                  );
                })}
              </ScrollView>

              <AppText variant="label" tone="subtle" style={styles.sectionLabel}>
                Pick a start time
              </AppText>
              <View style={styles.timeGrid}>
                {slots.map((s) => {
                  const available = isSlotAvailable(s, now);
                  const selected = slot?.getTime() === s.getTime();
                  return (
                    <Pressable
                      key={s.toISOString()}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: !available }}
                      disabled={!available}
                      onPress={() => setSlot(s)}
                      style={[
                        styles.timeSlot,
                        {
                          backgroundColor: selected ? colors.brandSolid : colors.surfaceInset,
                          borderColor: selected ? colors.brandSolid : colors.border,
                          opacity: available ? 1 : 0.35,
                        },
                      ]}
                    >
                      <AppText variant="small" weight="600" tone={selected ? "onBrand" : "default"}>
                        {formatTime(s)}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>

              <Divider />

              <View style={styles.summaryRow}>
                <AppText tone="muted">Lesson cost</AppText>
                <AppText weight="700">🪙 {formatNumber(cost)} coins</AppText>
              </View>
              <View style={styles.summaryRow}>
                <AppText tone="muted">Your balance</AppText>
                <AppText weight="600" tone={insufficient ? "alert" : "default"}>
                  🪙 {formatNumber(coinBalance)} coins
                </AppText>
              </View>
              {slot ? (
                <View style={styles.summaryRow}>
                  <AppText tone="muted">Starts</AppText>
                  <AppText weight="600">{formatDateTime(slot.toISOString())}</AppText>
                </View>
              ) : null}

              <View style={{ marginTop: spacing.lg }}>
                {insufficient ? (
                  <Banner
                    tone="alert"
                    message={`You need ${formatNumber(cost)} coins for this lesson but have ${formatNumber(coinBalance)}.`}
                    actionLabel="Top up coins →"
                    onAction={onTopUp}
                  />
                ) : null}
                {error ? <Banner tone="alert" message={error} /> : null}
              </View>

              <Button
                label={slot ? `Pay ${formatNumber(cost)} coins & book` : "Select a start time"}
                onPress={confirm}
                loading={submitting}
                disabled={!slot || insufficient}
              />
              <Button label="Cancel" variant="outline" onPress={onClose} style={{ marginTop: spacing.sm }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: "flex-end" },
  dismissArea: { flex: 1 },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  body: { padding: spacing.xl },
  teacherRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm },
  row: { flexGrow: 0 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  timeSlot: {
    minWidth: 84,
    minHeight: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  success: { padding: spacing.xxl, alignItems: "center" },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  centerText: { textAlign: "center" },
  fullWidth: { alignSelf: "stretch", marginTop: spacing.xxl },
});
