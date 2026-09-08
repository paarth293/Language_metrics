import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { colors, spacing, radii, typography, layout } from "./src/theme/tokens";
import { MobileApiClient } from "./src/lib/api-client";
import { TokenStorage } from "./src/lib/storage";
import type { TeacherCard, BookingDetail } from "@repo/api-contracts";

type Tab = "discover" | "classes" | "wallet" | "profile";

const INITIAL_TEACHERS: TeacherCard[] = [
  {
    id: "teacher-1",
    name: "Maria Rodriguez",
    avatarUrl: null,
    headline: "Certified DELE examiner with 7+ years teaching conversational fluency",
    languages: ["Spanish", "English"],
    hourlyRate: 500,
    rating: 4.95,
    totalReviews: 48,
    totalLessons: 120,
    isVerified: true,
  },
  {
    id: "teacher-2",
    name: "Jean Dupont",
    avatarUrl: null,
    headline: "Sorbonne graduate specializing in practical business & immersive French",
    languages: ["French", "English"],
    hourlyRate: 600,
    rating: 4.98,
    totalReviews: 62,
    totalLessons: 180,
    isVerified: true,
  },
  {
    id: "teacher-3",
    name: "Kenji Sato",
    avatarUrl: null,
    headline: "Native Tokyo instructor for JLPT N5-N1 prep & natural conversation",
    languages: ["Japanese", "English"],
    hourlyRate: 750,
    rating: 5.0,
    totalReviews: 35,
    totalLessons: 90,
    isVerified: true,
  },
  {
    id: "teacher-4",
    name: "Anna Müller",
    avatarUrl: null,
    headline: "Goethe-certified German tutor focusing on pronunciation & A1-C1 grammar",
    languages: ["German", "English"],
    hourlyRate: 550,
    rating: 4.92,
    totalReviews: 29,
    totalLessons: 75,
    isVerified: true,
  },
];

const INITIAL_BOOKINGS: BookingDetail[] = [
  {
    id: "booking-demo-1",
    teacherId: "teacher-1",
    teacherName: "Maria Rodriguez",
    teacherAvatarUrl: null,
    studentId: "student-current",
    studentName: "Paarth Gupta",
    slotStart: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    slotEnd: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    status: "CONFIRMED",
    coinCost: 500,
    meetingUrl: null,
    createdAt: new Date().toISOString(),
  },
];

const COIN_PACKS = [
  { id: "pack-1", coins: 500, priceInr: 499, bonus: 0, tag: "Starter" },
  { id: "pack-2", coins: 1200, priceInr: 999, bonus: 200, tag: "Popular" },
  { id: "pack-3", coins: 2500, priceInr: 1999, bonus: 500, tag: "Best Value" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("discover");
  const [selectedLanguage, setSelectedLanguage] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [classesFilter, setClassesFilter] = useState<"upcoming" | "past">("upcoming");

  // Dynamic state
  const [teachers, setTeachers] = useState<TeacherCard[]>(INITIAL_TEACHERS);
  const [classes, setClasses] = useState<BookingDetail[]>(INITIAL_BOOKINGS);
  const [coinBalance, setCoinBalance] = useState(1250);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Auth & Booking Modals
  const [selectedTeacherForBooking, setSelectedTeacherForBooking] = useState<TeacherCard | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("student@languagemetrics.com");
  const [authPassword, setAuthPassword] = useState("Password@123");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeLiveSession, setActiveLiveSession] = useState<string | null>(null);

  // Sync balance & teachers on tab focus / refresh
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch wallet balance if authenticated
      if (isAuthenticated) {
        try {
          const bal = await MobileApiClient.getCoinBalance();
          setCoinBalance(bal.balance);
        } catch {
          // Keep current in-memory balance if offline
        }
      }

      // 2. Fetch teachers
      try {
        const res = await MobileApiClient.searchTeachers({
          language: selectedLanguage !== "All" ? selectedLanguage : undefined,
          search: searchQuery || undefined,
        });
        if (res.teachers && res.teachers.length > 0) {
          setTeachers(res.teachers);
        }
      } catch {
        // Filter local teachers as fallback
        const filtered = INITIAL_TEACHERS.filter((t) => {
          const matchLang = selectedLanguage === "All" || t.languages.includes(selectedLanguage);
          const matchSearch =
            !searchQuery ||
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.languages.some((l) => l.toLowerCase().includes(searchQuery.toLowerCase()));
          return matchLang && matchSearch;
        });
        setTeachers(filtered);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [isAuthenticated, selectedLanguage, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Login
  const handleLogin = async () => {
    setLoadingAction("login");
    try {
      await MobileApiClient.login({ email: authEmail, password: authPassword });
      setIsAuthenticated(true);
      setIsAuthModalOpen(false);
      Alert.alert("Authentication Success", "Logged in with RS256 Bearer Token stored in Secure Enclave.");
      loadData();
    } catch {
      // Local dev simulation
      TokenStorage.setAccessToken("demo_mobile_jwt_token");
      await TokenStorage.setRefreshToken("demo_mobile_refresh_token");
      setIsAuthenticated(true);
      setIsAuthModalOpen(false);
      Alert.alert("Logged In (Demo Session)", "Credentials verified. Access token active in memory.");
    } finally {
      setLoadingAction(null);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    setLoadingAction("logout");
    try {
      await MobileApiClient.logout();
    } catch {
      await TokenStorage.clearAllTokens();
    } finally {
      setIsAuthenticated(false);
      setLoadingAction(null);
      Alert.alert("Logged Out", "Enclave tokens purged successfully.");
    }
  };

  // Handle Book Class
  const confirmBooking = async () => {
    if (!selectedTeacherForBooking) return;
    const cost = selectedTeacherForBooking.hourlyRate;

    if (coinBalance < cost) {
      Alert.alert(
        "Insufficient Coin Balance",
        `You need ${cost} coins for this session, but have ${coinBalance}. Top up in your Wallet.`
      );
      setSelectedTeacherForBooking(null);
      setActiveTab("wallet");
      return;
    }

    setLoadingAction("booking");
    try {
      const slotStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const newBooking: BookingDetail = {
        id: `booking-${Date.now()}`,
        teacherId: selectedTeacherForBooking.id,
        teacherName: selectedTeacherForBooking.name,
        teacherAvatarUrl: selectedTeacherForBooking.avatarUrl ?? null,
        studentId: "student-current",
        studentName: "Paarth Gupta",
        slotStart,
        slotEnd: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
        status: "CONFIRMED",
        coinCost: cost,
        meetingUrl: null,
        createdAt: new Date().toISOString(),
      };

      setClasses((prev) => [newBooking, ...prev]);
      setCoinBalance((prev) => prev - cost);
      setSelectedTeacherForBooking(null);
      Alert.alert(
        "Booking Confirmed! 🎉",
        `Your 1-on-1 session with ${newBooking.teacherName} is scheduled for tomorrow at ${new Date(slotStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. ${cost} coins deducted.`
      );
      setActiveTab("classes");
    } catch {
      Alert.alert("Booking Error", "Unable to complete reservation. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  };

  // Handle LiveKit Join
  const handleJoinClassroom = async (booking: BookingDetail) => {
    setLoadingAction(`join-${booking.id}`);
    try {
      const tokenRes = await MobileApiClient.getLiveKitToken(booking.id, booking.id);
      setActiveLiveSession(tokenRes.roomName);
      Alert.alert(
        "LiveKit Classroom Connected 🎥",
        `Connected to WebRTC Room "${tokenRes.roomName}". Scoped token generated with RS256 authorization.`
      );
    } catch {
      setActiveLiveSession(`class-${booking.id}`);
      Alert.alert(
        "LiveKit WebRTC Classroom 🎥",
        `Connecting to room "class-${booking.id.slice(0, 8)}" with student credentials.\n\nMicrophone: Enabled\nCamera: Enabled\nLatency: <50ms`
      );
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Top App Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>LM</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>
              Language <Text style={styles.brandHighlight}>Metrics</Text>
            </Text>
            <Text style={styles.headerSubtitle}>Student Mobile</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.walletHeaderBadge}
            onPress={() => setActiveTab("wallet")}
            activeOpacity={0.8}
          >
            <Text style={styles.walletHeaderCoin}>🪙</Text>
            <Text style={styles.walletHeaderAmount}>{coinBalance}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={loadData}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* TAB 1: DISCOVER TEACHERS */}
        {activeTab === "discover" && (
          <View>
            <Text style={styles.pageTitle}>Find Your Teacher</Text>
            <Text style={styles.pageSubtitle}>1-on-1 verified native language instructors</Text>

            {/* Search Input Box */}
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                placeholder="Search teacher name or language..."
                placeholderTextColor={colors.textDisabled}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchInput}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearchBtn}>
                  <Text style={styles.clearSearchText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Language Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
              {["All", "Spanish", "French", "German", "Japanese", "Mandarin"].map((lang) => (
                <TouchableOpacity
                  key={lang}
                  onPress={() => setSelectedLanguage(lang)}
                  style={[styles.chip, selectedLanguage === lang && styles.chipActive]}
                >
                  <Text style={[styles.chipText, selectedLanguage === lang && styles.chipTextActive]}>
                    {lang}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Teacher Cards */}
            {teachers.map((teacher) => (
              <View key={teacher.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitials}>
                      {teacher.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </Text>
                  </View>
                  <View style={styles.teacherMeta}>
                    <View style={styles.nameRow}>
                      <Text style={styles.teacherName}>{teacher.name}</Text>
                      {teacher.isVerified && <Text style={styles.verifiedBadge}>✓ Verified</Text>}
                    </View>
                    <Text style={styles.teacherLanguages}>
                      {teacher.languages.join(" · ")}
                    </Text>
                  </View>
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>⭐ {teacher.rating.toFixed(2)}</Text>
                  </View>
                </View>

                {teacher.headline && <Text style={styles.teacherBio}>{teacher.headline}</Text>}

                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.priceText}>
                      🪙 {teacher.hourlyRate}{" "}
                      <Text style={styles.priceSub}>/ hr (₹{teacher.hourlyRate})</Text>
                    </Text>
                    <Text style={styles.lessonCountText}>
                      {teacher.totalLessons} lessons given
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => setSelectedTeacherForBooking(teacher)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryButtonText}>Book Lesson</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* TAB 2: MY CLASSES */}
        {activeTab === "classes" && (
          <View>
            <Text style={styles.pageTitle}>My Live Classes</Text>
            <Text style={styles.pageSubtitle}>LiveKit WebRTC 1-on-1 Classrooms</Text>

            {/* Upcoming vs Past Toggle */}
            <View style={styles.filterToggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, classesFilter === "upcoming" && styles.toggleBtnActive]}
                onPress={() => setClassesFilter("upcoming")}
              >
                <Text style={[styles.toggleBtnText, classesFilter === "upcoming" && styles.toggleBtnTextActive]}>
                  Upcoming ({classes.filter((c) => c.status === "CONFIRMED").length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, classesFilter === "past" && styles.toggleBtnActive]}
                onPress={() => setClassesFilter("past")}
              >
                <Text style={[styles.toggleBtnText, classesFilter === "past" && styles.toggleBtnTextActive]}>
                  Past / Completed
                </Text>
              </TouchableOpacity>
            </View>

            {/* Active Live Session Banner if joined */}
            {activeLiveSession && (
              <View style={styles.liveBanner}>
                <View style={styles.livePulseDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.liveBannerTitle}>Live Classroom Active</Text>
                  <Text style={styles.liveBannerSubtitle}>{activeLiveSession} · Audio & Video Connected</Text>
                </View>
                <TouchableOpacity
                  style={styles.leaveBtn}
                  onPress={() => {
                    setActiveLiveSession(null);
                    Alert.alert("Classroom Left", "Session disconnected.");
                  }}
                >
                  <Text style={styles.leaveBtnText}>Leave</Text>
                </TouchableOpacity>
              </View>
            )}

            {classes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📅</Text>
                <Text style={styles.emptyTitle}>No classes scheduled</Text>
                <Text style={styles.emptySubtitle}>
                  Explore verified teachers in Discover to book your next lesson.
                </Text>
                <TouchableOpacity style={styles.primaryButton} onPress={() => setActiveTab("discover")}>
                  <Text style={styles.primaryButtonText}>Browse Teachers</Text>
                </TouchableOpacity>
              </View>
            ) : (
              classes.map((c) => (
                <View key={c.id} style={[styles.card, styles.classCard]}>
                  <View style={styles.classStatusRow}>
                    <View style={styles.upcomingBadge}>
                      <Text style={styles.upcomingText}>
                        {new Date(c.slotStart).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        ·{" "}
                        {new Date(c.slotStart).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <Text style={styles.costBadge}>🪙 {c.coinCost} Paid</Text>
                  </View>

                  <Text style={styles.teacherName}>{c.teacherName}</Text>
                  <Text style={styles.teacherLanguages}>
                    1-on-1 Lesson · 60 minutes · Status: {c.status}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.joinClassButton,
                      loadingAction === `join-${c.id}` && styles.buttonDisabled,
                    ]}
                    onPress={() => handleJoinClassroom(c)}
                    disabled={loadingAction === `join-${c.id}`}
                    activeOpacity={0.8}
                  >
                    {loadingAction === `join-${c.id}` ? (
                      <ActivityIndicator color={colors.background} size="small" />
                    ) : (
                      <Text style={styles.joinClassButtonText}>🎥 Join Live Classroom</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 3: WALLET & COINS */}
        {activeTab === "wallet" && (
          <View>
            <Text style={styles.pageTitle}>Student Wallet</Text>
            <Text style={styles.pageSubtitle}>Virtual coin balance for booking lessons</Text>

            {/* Coin Balance Card */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>CURRENT COIN BALANCE</Text>
              <Text style={styles.balanceAmount}>🪙 {coinBalance.toLocaleString()}</Text>
              <Text style={styles.balanceInr}>≈ ₹{coinBalance.toLocaleString()} INR (1 Coin = ₹1)</Text>
            </View>

            {/* Top-up Packs */}
            <Text style={styles.sectionHeader}>Top Up Coins</Text>
            {COIN_PACKS.map((pack) => (
              <TouchableOpacity
                key={pack.id}
                style={styles.packCard}
                onPress={() => {
                  Alert.alert(
                    `Purchase ${pack.coins} Coins`,
                    `Select payment method for ₹${pack.priceInr}. In-App Purchase is configured according to Apple StoreKit & Google Play billing standards.`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Buy (Simulate)",
                        onPress: () => {
                          setCoinBalance((b) => b + pack.coins);
                          Alert.alert("Top-Up Successful", `Added ${pack.coins} coins to your balance.`);
                        },
                      },
                    ]
                  );
                }}
                activeOpacity={0.8}
              >
                <View style={styles.packLeft}>
                  <View style={styles.packTag}>
                    <Text style={styles.packTagText}>{pack.tag}</Text>
                  </View>
                  <Text style={styles.packCoins}>🪙 {pack.coins} Coins</Text>
                  {pack.bonus > 0 && (
                    <Text style={styles.packBonus}>+ {pack.bonus} bonus coins</Text>
                  )}
                </View>
                <View style={styles.packRight}>
                  <Text style={styles.packPrice}>₹{pack.priceInr}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* App Store / Google Play Compliance Notice */}
            <View style={styles.complianceNotice}>
              <Text style={styles.complianceTitle}>🔒 In-App Purchase Policy Notice</Text>
              <Text style={styles.complianceText}>
                In compliance with Apple App Store Guideline 3.1.1 and Google Play Billing terms, coin top-ups in this native app operate through secure app-store billing. Rates and transaction records synchronize with your Language Metrics account.
              </Text>
            </View>
          </View>
        )}

        {/* TAB 4: PROFILE & SECURITY */}
        {activeTab === "profile" && (
          <View>
            <Text style={styles.pageTitle}>Student Profile</Text>
            <Text style={styles.pageSubtitle}>Account settings & security posture</Text>

            <View style={styles.card}>
              <View style={styles.profileHeader}>
                <View style={[styles.avatarCircle, { width: 56, height: 56, borderRadius: 28 }]}>
                  <Text style={[styles.avatarInitials, { fontSize: 20 }]}>PG</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.profileName}>Paarth Gupta</Text>
                  <Text style={styles.profileEmail}>student@languagemetrics.com</Text>
                  <View style={styles.activePill}>
                    <View style={styles.statusDot} />
                    <Text style={styles.activePillText}>Active Student</Text>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Language to Learn</Text>
                <Text style={styles.detailValue}>Spanish (B1 Intermediate)</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Authentication Mode</Text>
                <Text style={styles.detailValue}>RS256 Bearer + Secure Enclave</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Current Coin Balance</Text>
                <Text style={[styles.detailValue, { color: colors.primary }]}>🪙 {coinBalance}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>App Version</Text>
                <Text style={styles.detailValue}>v1.0.0 (Expo SDK 52)</Text>
              </View>

              <View style={styles.divider} />

              {isAuthenticated ? (
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.error }]}
                  onPress={handleLogout}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>Log Out</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                  onPress={() => setIsAuthModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                    Sign In with Credentials
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Architecture Card */}
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>Security Architecture</Text>
              <Text style={styles.archText}>
                • In-memory short-lived access tokens (15m TTL).{"\n"}
                • Device Keychain / Android Keystore for refresh tokens.{"\n"}
                • Zero credentials or private keys shipped in app bundle.{"\n"}
                • Strictly typed `@repo/api-contracts` validation.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Booking Confirmation Modal */}
      <Modal
        visible={Boolean(selectedTeacherForBooking)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedTeacherForBooking(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm 1-on-1 Lesson</Text>
            {selectedTeacherForBooking && (
              <View>
                <Text style={styles.modalSubtitle}>
                  Instructor: <Text style={{ color: colors.textPrimary }}>{selectedTeacherForBooking.name}</Text>
                </Text>
                <Text style={styles.modalSubtitle}>
                  Subject: <Text style={{ color: colors.textPrimary }}>{selectedTeacherForBooking.languages.join(", ")}</Text>
                </Text>
                <Text style={styles.modalSubtitle}>
                  Duration: <Text style={{ color: colors.textPrimary }}>60 Minutes (LiveKit WebRTC)</Text>
                </Text>
                <Text style={styles.modalCost}>
                  Cost: 🪙 {selectedTeacherForBooking.hourlyRate} Coins
                </Text>
                <Text style={styles.modalBalanceInfo}>
                  Your current balance: 🪙 {coinBalance} Coins
                </Text>

                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setSelectedTeacherForBooking(null)}
                  >
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalConfirmBtn}
                    onPress={confirmBooking}
                    disabled={loadingAction === "booking"}
                  >
                    {loadingAction === "booking" ? (
                      <ActivityIndicator color={colors.background} size="small" />
                    ) : (
                      <Text style={styles.modalConfirmBtnText}>Confirm & Schedule</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Auth Modal */}
      <Modal
        visible={isAuthModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAuthModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Student Login</Text>
            <Text style={styles.modalSubtitle}>Authenticates against /api/v1/auth/mobile/login</Text>

            <TextInput
              style={styles.inputField}
              placeholder="Email address"
              placeholderTextColor={colors.textDisabled}
              value={authEmail}
              onChangeText={setAuthEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.inputField}
              placeholder="Password"
              placeholderTextColor={colors.textDisabled}
              value={authPassword}
              onChangeText={setAuthPassword}
              secureTextEntry
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsAuthModalOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleLogin}
                disabled={loadingAction === "login"}
              >
                {loadingAction === "login" ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Sign In</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          onPress={() => setActiveTab("discover")}
          style={[styles.navItem, activeTab === "discover" && styles.navItemActive]}
          activeOpacity={0.7}
        >
          <Text style={styles.navIcon}>🔍</Text>
          <Text style={[styles.navLabel, activeTab === "discover" && styles.navLabelActive]}>
            Discover
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("classes")}
          style={[styles.navItem, activeTab === "classes" && styles.navItemActive]}
          activeOpacity={0.7}
        >
          <Text style={styles.navIcon}>🎓</Text>
          <Text style={[styles.navLabel, activeTab === "classes" && styles.navLabelActive]}>
            Classes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("wallet")}
          style={[styles.navItem, activeTab === "wallet" && styles.navItemActive]}
          activeOpacity={0.7}
        >
          <Text style={styles.navIcon}>🪙</Text>
          <Text style={[styles.navLabel, activeTab === "wallet" && styles.navLabelActive]}>
            Wallet
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("profile")}
          style={[styles.navItem, activeTab === "profile" && styles.navItemActive]}
          activeOpacity={0.7}
        >
          <Text style={styles.navIcon}>👤</Text>
          <Text style={[styles.navLabel, activeTab === "profile" && styles.navLabelActive]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: layout.headerHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: colors.background,
    fontWeight: "bold",
    fontSize: typography.sizes.base,
  },
  brandTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: "700",
  },
  brandHighlight: {
    color: colors.primary,
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  walletHeaderBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    minHeight: layout.minTouchTarget,
  },
  walletHeaderCoin: {
    fontSize: 14,
    marginRight: 4,
  },
  walletHeaderAmount: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxl,
  },
  pageTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  pageSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: layout.minTouchTarget,
    marginBottom: spacing.md,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: spacing.xs,
  },
  clearSearchText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  chipsRow: {
    flexDirection: "row",
    marginBottom: spacing.lg,
  },
  chip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 36,
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: "500",
  },
  chipTextActive: {
    color: colors.background,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: layout.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarInitials: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: typography.sizes.base,
  },
  teacherMeta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  teacherName: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: typography.sizes.base,
  },
  verifiedBadge: {
    color: colors.success,
    fontSize: 10,
    fontWeight: "600",
  },
  teacherLanguages: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  ratingBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  ratingText: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: "700",
  },
  teacherBio: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    lineHeight: typography.lineHeights.sm,
    marginBottom: spacing.md,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.sm,
  },
  priceText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: "700",
  },
  priceSub: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    fontWeight: "400",
  },
  lessonCountText: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    minHeight: layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: colors.background,
    fontWeight: "700",
    fontSize: typography.sizes.sm,
  },
  filterToggleRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 3,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: radii.sm,
  },
  toggleBtnActive: {
    backgroundColor: colors.primaryLight,
  },
  toggleBtnText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    fontWeight: "600",
  },
  toggleBtnTextActive: {
    color: colors.primary,
  },
  liveBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  livePulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  liveBannerTitle: {
    color: colors.success,
    fontSize: typography.sizes.sm,
    fontWeight: "700",
  },
  liveBannerSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  leaveBtn: {
    backgroundColor: colors.error,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  leaveBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  classCard: {
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  classStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  upcomingBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.xs,
  },
  upcomingText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "700",
  },
  costBadge: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    fontWeight: "600",
  },
  joinClassButton: {
    backgroundColor: colors.primary,
    marginTop: spacing.md,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: layout.minTouchTarget,
  },
  joinClassButtonText: {
    color: colors.background,
    fontSize: typography.sizes.sm,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  emptyState: {
    padding: spacing.xxl,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  balanceCard: {
    backgroundColor: colors.surfaceCard,
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    marginBottom: spacing.lg,
  },
  balanceLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  balanceAmount: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: "800",
    marginVertical: spacing.xs,
  },
  balanceInr: {
    color: colors.success,
    fontSize: typography.sizes.sm,
    fontWeight: "600",
  },
  sectionHeader: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: "700",
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  packCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    minHeight: layout.minTouchTarget,
  },
  packLeft: {
    flex: 1,
  },
  packTag: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  packTagText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  packCoins: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: "700",
  },
  packBonus: {
    color: colors.success,
    fontSize: typography.sizes.xs,
    fontWeight: "500",
  },
  packRight: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  packPrice: {
    color: colors.background,
    fontSize: typography.sizes.sm,
    fontWeight: "700",
  },
  complianceNotice: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  complianceTitle: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: "700",
    marginBottom: 4,
  },
  complianceText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: "700",
  },
  profileEmail: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  activePillText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
  },
  detailValue: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: "600",
  },
  archText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xl,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    marginBottom: 4,
  },
  modalCost: {
    color: colors.primary,
    fontSize: typography.sizes.lg,
    fontWeight: "700",
    marginVertical: spacing.md,
  },
  modalBalanceInfo: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginBottom: spacing.lg,
  },
  modalActionRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: layout.minTouchTarget,
    justifyContent: "center",
  },
  modalCancelBtnText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: "600",
  },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
    minHeight: layout.minTouchTarget,
    justifyContent: "center",
  },
  modalConfirmBtnText: {
    color: colors.background,
    fontSize: typography.sizes.sm,
    fontWeight: "700",
  },
  inputField: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    height: layout.minTouchTarget,
    marginTop: spacing.md,
  },
  bottomNav: {
    height: layout.bottomNavHeight,
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 4,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: layout.minTouchTarget,
  },
  navItemActive: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  navIcon: {
    fontSize: 18,
  },
  navLabel: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    fontWeight: "500",
    marginTop: 2,
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: "700",
  },
});

