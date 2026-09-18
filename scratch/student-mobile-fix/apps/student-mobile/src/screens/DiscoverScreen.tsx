import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import type { TeacherCard } from "@repo/api-contracts";
import { AppText, Avatar, Badge, Banner, Button, Card, Chip, EmptyState, LoadingBlock, TextField } from "../components/ui";
import { MobileApiClient } from "../lib/api-client";
import { formatNumber, initials } from "../lib/format";
import { useTheme } from "../theme/ThemeProvider";
import { layout, spacing } from "../theme/tokens";

/** Same language list as the web Discover page (`apps/student-web/.../discover/page.tsx`). */
const LANGUAGES = [
  "All",
  "English",
  "Spanish",
  "French",
  "Japanese",
  "German",
  "Chinese",
  "Korean",
  "Russian",
  "Arabic",
  "Hindi",
  "Portuguese",
  "Italian",
] as const;

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;

export function DiscoverScreen({ onBook }: { onBook: (teacher: TeacherCard) => void }) {
  const { colors } = useTheme();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>("All");

  const [teachers, setTeachers] = useState<TeacherCard[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(
    async (targetPage: number, mode: "replace" | "append" | "refresh") => {
      const id = ++requestId.current;
      setError(null);
      if (mode === "replace") setLoading(true);
      if (mode === "append") setLoadingMore(true);
      if (mode === "refresh") setRefreshing(true);

      try {
        const result = await MobileApiClient.searchTeachers({
          language: language === "All" ? undefined : language,
          search: search || undefined,
          page: targetPage,
          limit: PAGE_SIZE,
        });
        if (id !== requestId.current) return; // a newer search superseded this one
        setTeachers((prev) => (mode === "append" ? [...prev, ...result.teachers] : result.teachers));
        setPage(result.pagination.page);
        setTotalPages(result.pagination.totalPages);
        setTotal(result.pagination.total);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : "Couldn't load teachers.");
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [language, search]
  );

  useEffect(() => {
    void load(1, "replace");
  }, [load]);

  const hasFilters = language !== "All" || search.length > 0;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load(1, "refresh")}
          tintColor={colors.action}
          colors={[colors.action]}
        />
      }
    >
      <AppText variant="h1">Find a teacher</AppText>
      <AppText tone="muted" style={styles.subtitle}>
        Discover the perfect language tutor for your goals.
      </AppText>

      <TextField
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder="Search by name, language, or keyword..."
        leading="🔍"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search teachers"
        containerStyle={{ marginBottom: spacing.md }}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsContent}>
        {LANGUAGES.map((lang) => (
          <Chip key={lang} label={lang} selected={language === lang} onPress={() => setLanguage(lang)} />
        ))}
      </ScrollView>

      {error ? <Banner tone="alert" message={error} actionLabel="Try again" onAction={() => void load(1, "replace")} /> : null}

      {loading ? (
        <LoadingBlock label="Finding teachers…" />
      ) : teachers.length === 0 && !error ? (
        <EmptyState
          icon="🧑‍🏫"
          title={hasFilters ? "No teachers match your filters" : "No teachers available yet"}
          message={hasFilters ? "Try another language or clear your search." : "Verified teachers will appear here as soon as they're approved."}
          actionLabel={hasFilters ? "Clear filters" : undefined}
          onAction={
            hasFilters
              ? () => {
                  setLanguage("All");
                  setSearchInput("");
                  setSearch("");
                }
              : undefined
          }
        />
      ) : (
        <>
          {total > 0 ? (
            <AppText variant="small" tone="subtle" style={styles.count}>
              {total} {total === 1 ? "teacher" : "teachers"} found
            </AppText>
          ) : null}
          {teachers.map((teacher) => (
            <TeacherListItem key={teacher.id} teacher={teacher} onBook={() => onBook(teacher)} />
          ))}
          {page < totalPages ? (
            <Button
              label="Load more teachers"
              variant="outline"
              loading={loadingMore}
              onPress={() => void load(page + 1, "append")}
              style={{ marginTop: spacing.sm }}
            />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function TeacherListItem({ teacher, onBook }: { teacher: TeacherCard; onBook: () => void }) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <Avatar label={initials(teacher.name)} />
        <View style={styles.meta}>
          <View style={styles.nameRow}>
            <AppText variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
              {teacher.name}
            </AppText>
            {teacher.isVerified ? <Badge label="✓ Verified" tone="trust" style={{ marginLeft: spacing.sm }} /> : null}
          </View>
          <AppText variant="small" tone="muted" numberOfLines={1}>
            {teacher.languages.length > 0 ? teacher.languages.join(" · ") : "Languages coming soon"}
          </AppText>
        </View>
        <Badge label={`★ ${teacher.rating.toFixed(1)}`} tone="action" />
      </View>

      {teacher.headline ? (
        <AppText variant="body" tone="secondary" style={styles.headline} numberOfLines={3}>
          {teacher.headline}
        </AppText>
      ) : null}

      <View style={styles.footer}>
        <View style={{ flexShrink: 1 }}>
          <AppText variant="h3">
            🪙 {formatNumber(teacher.hourlyRate)}{" "}
            <AppText variant="small" tone="muted">
              coins / hr
            </AppText>
          </AppText>
          <AppText variant="caption" tone="subtle">
            {teacher.totalReviews} {teacher.totalReviews === 1 ? "review" : "reviews"}
          </AppText>
        </View>
        <Button label="Book lesson" size="sm" onPress={onBook} accessibilityHint={`Book a lesson with ${teacher.name}`} />
      </View>
    </Card>
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
  chips: { marginBottom: spacing.lg, flexGrow: 0 },
  chipsContent: { paddingRight: spacing.lg },
  count: { marginBottom: spacing.sm },
  card: { marginBottom: spacing.md },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  meta: { flex: 1, marginHorizontal: spacing.md },
  nameRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  headline: { marginTop: spacing.md },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    gap: spacing.md,
  },
});
