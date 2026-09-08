import React, { useState } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  TextInput,
} from "react-native";

type Tab = "discover" | "classes" | "wallet" | "profile";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("discover");
  const [selectedLanguage, setSelectedLanguage] = useState("All");

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0c29" />

      {/* Top App Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>LM</Text>
          </View>
          <Text style={styles.brandTitle}>
            Language <Text style={styles.brandHighlight}>Metrics</Text>
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Secure Enclave</Text>
        </View>
      </View>

      {/* Content Area */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeTab === "discover" && (
          <View>
            <Text style={styles.pageTitle}>Find Your Teacher</Text>
            <Text style={styles.pageSubtitle}>1-on-1 verified native language instructors</Text>

            {/* Search Input */}
            <View style={styles.searchBox}>
              <TextInput
                placeholder="Search by teacher or language..."
                placeholderTextColor="#71717a"
                style={styles.searchInput}
              />
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

            {/* Featured Teacher Cards */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitials}>MR</Text>
                </View>
                <View style={styles.teacherMeta}>
                  <Text style={styles.teacherName}>Maria Rodriguez</Text>
                  <Text style={styles.teacherLanguages}>Spanish (Native) · English</Text>
                </View>
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingText}>⭐ 4.95</Text>
                </View>
              </View>
              <Text style={styles.teacherBio}>
                Certified DELE examiner with 7+ years preparing students for fluent conversational mastery.
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.priceText}>
                  ₹499 <Text style={styles.priceSub}>/ hr (500 🪙)</Text>
                </Text>
                <TouchableOpacity style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Book Demo</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.avatarCircle, { backgroundColor: "#1e3a8a" }]}>
                  <Text style={styles.avatarInitials}>JD</Text>
                </View>
                <View style={styles.teacherMeta}>
                  <Text style={styles.teacherName}>Jean Dupont</Text>
                  <Text style={styles.teacherLanguages}>French (Native) · DELF B2/C1</Text>
                </View>
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingText}>⭐ 4.98</Text>
                </View>
              </View>
              <Text style={styles.teacherBio}>
                Sorbonne graduate specializing in practical business French and immersive pronunciation.
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.priceText}>
                  ₹599 <Text style={styles.priceSub}>/ hr (600 🪙)</Text>
                </Text>
                <TouchableOpacity style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Book Demo</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {activeTab === "classes" && (
          <View>
            <Text style={styles.pageTitle}>My Live Classes</Text>
            <Text style={styles.pageSubtitle}>LiveKit WebRTC 1-on-1 Classrooms</Text>

            <View style={[styles.card, { borderColor: "#f59e0b", borderWidth: 1 }]}>
              <View style={styles.upcomingBadge}>
                <Text style={styles.upcomingText}>UPCOMING · TODAY 6:00 PM</Text>
              </View>
              <Text style={styles.teacherName}>Conversational Spanish (Session #14)</Text>
              <Text style={styles.teacherLanguages}>With Maria Rodriguez · 60 mins</Text>
              <TouchableOpacity style={[styles.primaryButton, { marginTop: 16, backgroundColor: "#f59e0b" }]}>
                <Text style={[styles.primaryButtonText, { color: "#0f0c29" }]}>Join Live Classroom</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === "wallet" && (
          <View>
            <Text style={styles.pageTitle}>Student Wallet</Text>
            <Text style={styles.pageSubtitle}>Coins for booking live 1-on-1 lessons</Text>

            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>CURRENT COIN BALANCE</Text>
              <Text style={styles.balanceAmount}>🪙 1,250</Text>
              <Text style={styles.balanceInr}>≈ ₹1,250 INR (1 Coin = ₹1)</Text>
            </View>

            <View style={styles.complianceNotice}>
              <Text style={styles.complianceText}>
                ℹ️ Compliant with Apple StoreKit and Google Play Billing requirements. In-app coin purchases are processed securely.
              </Text>
            </View>
          </View>
        )}

        {activeTab === "profile" && (
          <View>
            <Text style={styles.pageTitle}>Student Profile</Text>
            <Text style={styles.pageSubtitle}>Account settings & security posture</Text>

            <View style={styles.card}>
              <Text style={styles.profileName}>Paarth Gupta</Text>
              <Text style={styles.profileEmail}>student@languagemetrics.com</Text>
              <View style={styles.divider} />
              <Text style={styles.infoRow}>Security: RS256 Bearer + OS Keychain Active</Text>
              <Text style={styles.infoRow}>Platform: Language Metrics Mobile v1.0.0 (Expo)</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          onPress={() => setActiveTab("discover")}
          style={[styles.navItem, activeTab === "discover" && styles.navItemActive]}
        >
          <Text style={styles.navIcon}>🔍</Text>
          <Text style={[styles.navLabel, activeTab === "discover" && styles.navLabelActive]}>
            Discover
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("classes")}
          style={[styles.navItem, activeTab === "classes" && styles.navItemActive]}
        >
          <Text style={styles.navIcon}>🎓</Text>
          <Text style={[styles.navLabel, activeTab === "classes" && styles.navLabelActive]}>
            Classes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("wallet")}
          style={[styles.navItem, activeTab === "wallet" && styles.navItemActive]}
        >
          <Text style={styles.navIcon}>🪙</Text>
          <Text style={[styles.navLabel, activeTab === "wallet" && styles.navLabelActive]}>
            Wallet
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("profile")}
          style={[styles.navItem, activeTab === "profile" && styles.navItemActive]}
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
    backgroundColor: "#0f0c29",
  },
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#0f0c29",
    fontWeight: "bold",
    fontSize: 14,
  },
  brandTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  brandHighlight: {
    color: "#f59e0b",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  statusText: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.6)",
    marginBottom: 16,
  },
  searchBox: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    color: "#ffffff",
    fontSize: 14,
  },
  chipsRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  chip: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: "#f59e0b",
  },
  chipText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#0f0c29",
    fontWeight: "700",
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarInitials: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  teacherMeta: {
    flex: 1,
  },
  teacherName: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  teacherLanguages: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    marginTop: 2,
  },
  ratingBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    color: "#f59e0b",
    fontSize: 11,
    fontWeight: "700",
  },
  teacherBio: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    paddingTop: 10,
  },
  priceText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  priceSub: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 11,
    fontWeight: "400",
  },
  primaryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 13,
  },
  upcomingBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  upcomingText: {
    color: "#f59e0b",
    fontSize: 10,
    fontWeight: "700",
  },
  balanceCard: {
    backgroundColor: "#1a1547",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    marginBottom: 16,
  },
  balanceLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  balanceAmount: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "800",
    marginVertical: 8,
  },
  balanceInr: {
    color: "#10b981",
    fontSize: 13,
    fontWeight: "500",
  },
  complianceNotice: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  complianceText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    lineHeight: 18,
  },
  profileName: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  profileEmail: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 12,
  },
  infoRow: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
    marginBottom: 6,
  },
  bottomNav: {
    height: 64,
    flexDirection: "row",
    backgroundColor: "#1a1547",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    paddingBottom: 4,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navItemActive: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  navIcon: {
    fontSize: 18,
  },
  navLabel: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  navLabelActive: {
    color: "#f59e0b",
    fontWeight: "700",
  },
});
