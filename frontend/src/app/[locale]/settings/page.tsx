"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useLogout } from "@/hooks/queries/useUserQuery";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { userApi } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { UserPlanBadge } from "@/components/UserPlanBadge";
import { UsageIndicator } from "@/components/UsageIndicator";
import LocaleLink from "@/components/ui/LocaleLink";
import { useLocaleRouter } from "@/lib/navigation";
import { locales } from "@/i18n";
import {
  Globe,
  CreditCard,
  Shield,
  BarChart3,
  AlertTriangle,
  ExternalLink,
  Trash2,
  Bell,
  Lock,
  User,
  Sparkles,
  ChevronRight,
  Check,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import { useUserContext } from "@/contexts/UserContext";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "@/components/ui/Avatar";

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

const languageOptions: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺" },
  { code: "zh", name: "Chinese", nativeName: "中文", flag: "🇨🇳" },
];

type SectionId =
  | "overview"
  | "notifications"
  | "language"
  | "usage"
  | "subscription"
  | "security"
  | "danger";

interface Section {
  id: SectionId;
  title: string;
  icon: React.ElementType;
  color: string;
  bgGradient: string;
  badge?: string;
}

export default function SettingsPage() {
  const { user, loading } = useUserContext();
  const userPermissions = useUserPermissions();
  const logoutMutation = useLogout();
  const t = useTranslations();
  const tSettings = useTranslations("user.settings");
  const tCommon = useTranslations("common");
  const params = useParams();
  const router = useLocaleRouter();
  const currentLocale = params.locale as string;

  // Mobile navigation state
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [isMobile, setIsMobile] = useState(false);

  // State for various sections
  const [selectedLanguage, setSelectedLanguage] = useState(
    currentLocale || "en"
  );
  const [isLanguageAutomatic, setIsLanguageAutomatic] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelSubscription, setShowCancelSubscription] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const confirmCancelRef = useRef<HTMLButtonElement | null>(null);

  // Loading states
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);

  // Email notification preferences
  const [pscEmailPref, setPscEmailPref] = useState<"intelligently" | "never">(
    "intelligently"
  );
  const [unreadEmailPref, setUnreadEmailPref] = useState<
    "intelligently" | "never"
  >("intelligently");
  const [isSavingEmailPrefs, setIsSavingEmailPrefs] = useState(false);

  // Alert Dialog states
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: "info" | "success" | "warning" | "error";
  }>({
    isOpen: false,
    title: "",
    message: "",
    variant: "info",
  });

  const sections: Section[] = [
    {
      id: "overview",
      title: tSettings("overview.title"),
      icon: User,
      color: "text-primary",
      bgGradient: "from-primary/20 to-primary/10",
    },
    {
      id: "notifications",
      title: tSettings("notifications.title"),
      icon: Bell,
      color: "text-blue-500",
      bgGradient: "from-blue-500/20 to-blue-500/10",
    },
    {
      id: "language",
      title: tSettings("language.title"),
      icon: Globe,
      color: "text-green-500",
      bgGradient: "from-green-500/20 to-green-500/10",
    },
    {
      id: "usage",
      title: tSettings("usage.title"),
      icon: BarChart3,
      color: "text-purple-500",
      bgGradient: "from-purple-500/20 to-purple-500/10",
    },
    {
      id: "subscription",
      title: tSettings("subscription.title"),
      icon: CreditCard,
      color: "text-yellow-500",
      bgGradient: "from-yellow-500/20 to-yellow-500/10",
      badge: user?.planInfo?.plan,
    },
    {
      id: "security",
      title: tSettings("security.title"),
      icon: Shield,
      color: "text-indigo-500",
      bgGradient: "from-indigo-500/20 to-indigo-500/10",
    },
    {
      id: "danger",
      title: tSettings("account.deleteAccount.title"),
      icon: AlertTriangle,
      color: "text-destructive",
      bgGradient: "from-destructive/20 to-destructive/10",
    },
  ];

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // On mobile, scroll to top when navigating into a section
  useEffect(() => {
    if (isMobile && activeSection !== "overview") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [isMobile, activeSection]);

  // Initialize language preference
  useEffect(() => {
    if (user?.preferredLanguage && user.preferredLanguage !== "") {
      setSelectedLanguage(user.preferredLanguage);
      setIsLanguageAutomatic(false);
      if (currentLocale !== user.preferredLanguage) {
        router.replace(`/${user.preferredLanguage}/settings`);
      }
    } else if (user?.preferredLanguage === "") {
      const browserLang = navigator.language.split("-")[0];
      const supportedLang = locales.includes(browserLang as any)
        ? browserLang
        : "en";
      setSelectedLanguage(supportedLang);
      setIsLanguageAutomatic(true);
      if (currentLocale !== supportedLang) {
        router.replace(`/${supportedLang}/settings`);
      }
    } else {
      const browserLang = navigator.language.split("-")[0];
      const isBrowserLangSupported = locales.includes(browserLang as any);
      const browserLangMatches =
        isBrowserLangSupported && browserLang === currentLocale;
      setSelectedLanguage(currentLocale);
      setIsLanguageAutomatic(browserLangMatches);
    }
  }, [currentLocale, user?.preferredLanguage, router]);

  // Initialize email preferences
  useEffect(() => {
    if (user?.emailPreferences) {
      if (user.emailPreferences.pscBalance) {
        setPscEmailPref(user.emailPreferences.pscBalance);
      }
      if (user.emailPreferences.unreadNotifications) {
        setUnreadEmailPref(user.emailPreferences.unreadNotifications);
      }
    }
  }, [user?.emailPreferences]);

  const showAlert = (
    title: string,
    message: string,
    variant: "info" | "success" | "warning" | "error" = "info"
  ) => {
    setAlertDialog({ isOpen: true, title, message, variant });
  };

  const closeAlert = () => {
    setAlertDialog({ isOpen: false, title: "", message: "", variant: "info" });
  };

  const updateEmailPreference = async (
    field: "pscBalance" | "unreadNotifications",
    value: "intelligently" | "never",
    prevValue: "intelligently" | "never"
  ) => {
    setIsSavingEmailPrefs(true);
    try {
      await userApi.updateProfile({
        emailPreferences: {
          [field]: value,
        },
      });
    } catch (error: unknown) {
      if (field === "pscBalance") setPscEmailPref(prevValue);
      else setUnreadEmailPref(prevValue);
      const errorMessage =
        error instanceof Error
          ? error.message
          : tSettings("messages.updateError");
      showAlert(tSettings("notifications.title"), errorMessage, "error");
    } finally {
      setIsSavingEmailPrefs(false);
    }
  };

  const handleLanguageChange = async (languageCode: string) => {
    setIsChangingLanguage(true);
    try {
      if (languageCode === "auto") {
        await userApi.updateLanguage("");
        const browserLang = navigator.language.split("-")[0];
        const supportedLang = locales.includes(browserLang as any)
          ? browserLang
          : "en";
        setIsLanguageAutomatic(true);
        setSelectedLanguage(supportedLang);
        if (currentLocale !== supportedLang) {
          router.push(`/${supportedLang}/settings`);
        }
      } else {
        await userApi.updateLanguage(languageCode);
        setIsLanguageAutomatic(false);
        setSelectedLanguage(languageCode);
        if (currentLocale !== languageCode) {
          router.push(`/${languageCode}/settings`);
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update language preference";
      showAlert(tSettings("language.title"), errorMessage, "error");
    } finally {
      setIsChangingLanguage(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.googleId) return;

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showAlert(
        tSettings("security.changePassword.title"),
        t("auth.validation.passwordsDoNotMatch"),
        "error"
      );
      return;
    }

    if (passwordData.newPassword.length < 8) {
      showAlert(
        tSettings("security.changePassword.title"),
        t("auth.validation.passwordTooShort"),
        "error"
      );
      return;
    }

    setIsChangingPassword(true);
    try {
      await userApi.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      showAlert(
        tSettings("security.changePassword.title"),
        tSettings("security.changePassword.success"),
        "success"
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : tSettings("messages.updateError");
      showAlert(
        tSettings("security.changePassword.title"),
        errorMessage,
        "error"
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      showAlert(
        tSettings("account.deleteAccount.title"),
        "Please type DELETE to confirm",
        "warning"
      );
      return;
    }

    setIsDeletingAccount(true);
    try {
      await userApi.deleteAccount();
      await logoutMutation.mutateAsync();
      router.push("/");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : tSettings("messages.updateError");
      showAlert(
        tSettings("account.deleteAccount.title"),
        errorMessage,
        "error"
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsUpdating(true);
    try {
      await userApi.cancelSubscription();
      showAlert(
        tSettings("subscription.title"),
        tSettings("messages.updateSuccess"),
        "success"
      );
      setShowCancelSubscription(false);
      window.location.reload();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : tSettings("messages.updateError");
      showAlert(tSettings("subscription.title"), errorMessage, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground animate-pulse">
            {tCommon("loading")}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-12">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Not authenticated
            </h2>
            <p className="text-muted-foreground mb-6">
              Please log in to access settings.
            </p>
            <LocaleLink href="/auth/login">
              <Button className="w-full sm:w-auto">{t("auth.signIn")}</Button>
            </LocaleLink>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPlan = userPermissions.getCurrentPlan();
  const planLimits = userPermissions.getPlanLimits();
  const usageStats = user.usageStats || {
    imagesGeneratedThisMonth: 0,
    imagesGeneratedToday: 0,
  };

  // Desktop View - All sections visible with sidebar
  const DesktopView = () => (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-8">
          {/* Sidebar */}
          <div className="col-span-3">
            <div className="sticky top-8">
              {/* User Profile Card */}
              <Card className="mb-6 overflow-hidden">
                <div className="h-20 bg-gradient-to-br from-primary to-primary/60"></div>
                <CardContent className="relative pt-0">
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                    <div className="h-20 w-20 rounded-full bg-card border-4 border-background flex items-center justify-center">
                      <Avatar user={user} size="medium" />
                    </div>
                  </div>
                  <div className="text-center pt-12 pb-4">
                    <h2 className="font-semibold text-lg">
                      {user.username || "User"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {user.email}
                    </p>
                    <div className="mt-3">
                      <UserPlanBadge plan={user.planInfo.plan} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Navigation */}
              <Card>
                <CardContent className="p-2">
                  <nav className="space-y-1">
                    {sections
                      .filter((s) => s.id !== "overview")
                      .map((section) => (
                        <a
                          key={section.id}
                          href={`#${section.id}`}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-muted ${
                            section.id === "danger"
                              ? "hover:bg-destructive/10"
                              : ""
                          }`}
                        >
                          <section.icon
                            className={`h-4 w-4 ${section.color}`}
                          />
                          <span className="text-sm font-medium">
                            {section.title}
                          </span>
                          {section.badge && (
                            <Badge
                              variant="outline"
                              className="ml-auto text-xs"
                            >
                              {section.badge}
                            </Badge>
                          )}
                        </a>
                      ))}
                  </nav>
                </CardContent>
              </Card>

              {/* Sign Out */}
              <Button
                variant="outline"
                onClick={() => logoutMutation.mutate()}
                className="w-full mt-4"
              >
                Sign Out
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-9 space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold mb-2">{tSettings("title")}</h1>
              <p className="text-muted-foreground">
                {tSettings("description")}
              </p>
            </div>

            {/* Sections */}
            <div id="notifications" className="scroll-mt-8">
              <NotificationsSection />
            </div>
            <div id="language" className="scroll-mt-8">
              <LanguageSection />
            </div>
            <div id="usage" className="scroll-mt-8">
              <UsageSection />
            </div>
            <div id="subscription" className="scroll-mt-8">
              <SubscriptionSection />
            </div>
            <div id="security" className="scroll-mt-8">
              <SecuritySection />
            </div>
            <div id="danger" className="scroll-mt-8">
              <DangerSection />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Mobile View - Single section at a time
  const MobileView = () => (
    <div className="min-h-screen bg-background">
      <AnimatePresence mode="wait">
        {activeSection === "overview" ? (
          <motion.div
            key="overview"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="min-h-screen flex flex-col"
          >
            {/* Header */}
            <div className="bg-card border-b">
              <div className="px-4 py-5">
                <div className="flex items-center gap-3">
                  <Avatar user={user} size="medium" />
                  <div className="flex-1">
                    <h1 className="text-lg font-semibold">
                      {user.username || "User"}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <UserPlanBadge plan={user.planInfo.plan} />
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="px-4 py-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card rounded-lg p-3 border">
                  <p className="text-xs text-muted-foreground">
                    Today&apos;s Usage
                  </p>
                  <p className="text-lg font-semibold">
                    {usageStats.imagesGeneratedToday}
                    <span className="text-sm text-muted-foreground font-normal">
                      {planLimits?.imagesPerDay !== "unlimited" &&
                        ` / ${planLimits?.imagesPerDay}`}
                    </span>
                  </p>
                </div>
                <div className="bg-card rounded-lg p-3 border">
                  <p className="text-xs text-muted-foreground">Monthly Usage</p>
                  <p className="text-lg font-semibold">
                    {usageStats.imagesGeneratedThisMonth}
                    <span className="text-sm text-muted-foreground font-normal">
                      {planLimits?.imagesPerMonth !== "unlimited" &&
                        ` / ${planLimits?.imagesPerMonth}`}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Settings List */}
            <div className="flex-1 px-4 py-4 space-y-2">
              {sections
                .filter((s) => s.id !== "overview")
                .map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className="w-full text-left"
                  >
                    <div
                      className={`flex items-center justify-between p-4 rounded-xl bg-card border transition-all active:scale-[0.98] ${
                        section.id === "danger" ? "border-destructive/20" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-10 w-10 rounded-lg bg-gradient-to-br ${section.bgGradient} flex items-center justify-center`}
                        >
                          <section.icon
                            className={`h-5 w-5 ${section.color}`}
                          />
                        </div>
                        <div>
                          <h3
                            className={`font-medium ${
                              section.id === "danger" ? "text-destructive" : ""
                            }`}
                          >
                            {section.title}
                          </h3>
                          {section.badge && (
                            <Badge variant="outline" className="mt-0.5 text-xs">
                              {section.badge}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </button>
                ))}
            </div>

            {/* Footer Actions */}
            <div className="px-4 pb-4">
              <Button
                variant="outline"
                onClick={() => logoutMutation.mutate()}
                className="w-full"
              >
                Sign Out
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="min-h-screen flex flex-col"
          >
            {/* Section Header */}
            <div className="sticky top-0 z-40 bg-card border-b">
              <div className="flex items-center px-2 py-3">
                <button
                  onClick={() => setActiveSection("overview")}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="flex-1 text-center text-lg font-semibold pr-9">
                  {sections.find((s) => s.id === activeSection)?.title}
                </h2>
              </div>
            </div>

            {/* Section Content */}
            <div className="flex-1 overflow-y-auto">
              {activeSection === "notifications" && (
                <MobileNotificationsSection />
              )}
              {activeSection === "language" && <MobileLanguageSection />}
              {activeSection === "usage" && <MobileUsageSection />}
              {activeSection === "subscription" && (
                <MobileSubscriptionSection />
              )}
              {activeSection === "security" && <MobileSecuritySection />}
              {activeSection === "danger" && <MobileDangerSection />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // Section Components
  const NotificationsSection = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              {tSettings("notifications.title")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {tSettings("notifications.description")}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium text-sm">
                {tSettings("notifications.pscBalance.label")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Get notified about your balance
              </p>
            </div>
            <select
              value={pscEmailPref}
              onChange={(e) => {
                const next = e.target.value as "intelligently" | "never";
                const prev = pscEmailPref;
                setPscEmailPref(next);
                updateEmailPreference("pscBalance", next, prev);
              }}
              disabled={isSavingEmailPrefs}
              className="px-3 py-1.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="intelligently">
                {tSettings("notifications.options.intelligently")}
              </option>
              <option value="never">
                {tSettings("notifications.options.never")}
              </option>
            </select>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium text-sm">
                {tSettings("notifications.unread.label")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Unread notifications reminders
              </p>
            </div>
            <select
              value={unreadEmailPref}
              onChange={(e) => {
                const next = e.target.value as "intelligently" | "never";
                const prev = unreadEmailPref;
                setUnreadEmailPref(next);
                updateEmailPreference("unreadNotifications", next, prev);
              }}
              disabled={isSavingEmailPrefs}
              className="px-3 py-1.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="intelligently">
                {tSettings("notifications.options.intelligently")}
              </option>
              <option value="never">
                {tSettings("notifications.options.never")}
              </option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const LanguageSection = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center">
            <Globe className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              {tSettings("language.title")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {tSettings("language.description")}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Auto Option */}
          <button
            onClick={() => handleLanguageChange("auto")}
            className={`w-full p-3 rounded-lg border transition-all ${
              isLanguageAutomatic
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50"
            }`}
            disabled={isChangingLanguage}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🌐</span>
                <div className="text-left">
                  <p className="font-medium text-sm">
                    {tSettings("language.automatic")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Use browser language
                  </p>
                </div>
              </div>
              {isLanguageAutomatic && (
                <Check className="h-5 w-5 text-primary" />
              )}
            </div>
          </button>

          {/* Language Options */}
          {languageOptions.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full p-3 rounded-lg border transition-all ${
                !isLanguageAutomatic && selectedLanguage === lang.code
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
              disabled={isChangingLanguage}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{lang.flag}</span>
                  <div className="text-left">
                    <p className="font-medium text-sm">{lang.nativeName}</p>
                    <p className="text-xs text-muted-foreground">{lang.name}</p>
                  </div>
                </div>
                {!isLanguageAutomatic && selectedLanguage === lang.code && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const UsageSection = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              {tSettings("usage.title")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {tSettings("usage.description")}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Daily Usage Card */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">{tSettings("usage.images.daily")}</h4>
              <Badge variant="outline" className="bg-background">
                {planLimits?.imagesPerDay === "unlimited"
                  ? "∞"
                  : `${usageStats.imagesGeneratedToday}/${
                      planLimits?.imagesPerDay || 0
                    }`}
              </Badge>
            </div>
            <UsageIndicator type="daily" />
            <p className="text-xs text-muted-foreground mt-2">
              {tSettings("usage.resetInfo.daily")}
            </p>
          </div>

          {/* Monthly Usage Card */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">
                {tSettings("usage.images.monthly")}
              </h4>
              <Badge variant="outline" className="bg-background">
                {planLimits?.imagesPerMonth === "unlimited"
                  ? "∞"
                  : `${usageStats.imagesGeneratedThisMonth}/${
                      planLimits?.imagesPerMonth || 0
                    }`}
              </Badge>
            </div>
            <UsageIndicator type="monthly" />
            <p className="text-xs text-muted-foreground mt-2">
              {tSettings("usage.resetInfo.billingCycle")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const SubscriptionSection = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-yellow-500/10 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              {tSettings("subscription.title")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {tSettings("subscription.description")}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Current Plan</span>
            <UserPlanBadge plan={user.planInfo.plan} />
          </div>
          <p className="text-xs text-muted-foreground">
            {currentPlan === "free"
              ? "Upgrade to unlock more features"
              : `Enjoy all ${currentPlan} features`}
          </p>
        </div>

        <div className="space-y-3">
          {currentPlan === "free" && (
            <LocaleLink href="/pricing" className="block">
              <Button className="w-full" size="lg">
                <Sparkles className="h-4 w-4 mr-2" />
                {tSettings("subscription.upgrade")}
              </Button>
            </LocaleLink>
          )}

          {currentPlan !== "free" && currentPlan !== "pro" && (
            <LocaleLink href="/pricing" className="block">
              <Button className="w-full" variant="outline">
                {tSettings("subscription.actions.upgradeTo", { plan: "Pro" })}
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </LocaleLink>
          )}

          {currentPlan !== "free" && (
            <Button
              variant="outline"
              onClick={() => setShowCancelSubscription(true)}
              className="w-full text-destructive hover:bg-destructive/10"
            >
              {tSettings("subscription.cancel")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const SecuritySection = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-500/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              {tSettings("security.title")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {tSettings("security.description")}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {user.googleId ? (
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {tSettings("security.unavailable.title")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tSettings("security.unavailable.message")}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                window.open("https://myaccount.google.com", "_blank")
              }
              className="w-full"
              size="sm"
            >
              {tSettings("security.unavailable.action")}
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          </div>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="text-sm font-medium" htmlFor="current-password">
                {tSettings("security.changePassword.currentPassword")}
              </label>
              <Input
                id="current-password"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    currentPassword: e.target.value,
                  })
                }
                required
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="new-password">
                {tSettings("security.changePassword.newPassword")}
              </label>
              <Input
                id="new-password"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    newPassword: e.target.value,
                  })
                }
                required
                minLength={8}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="confirm-password">
                {tSettings("security.changePassword.confirmPassword")}
              </label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    confirmPassword: e.target.value,
                  })
                }
                required
                minLength={8}
                className="mt-1"
              />
            </div>

            <p className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
              {tSettings("security.changePassword.requirements")}
            </p>

            <Button
              type="submit"
              disabled={
                isChangingPassword ||
                !passwordData.currentPassword ||
                !passwordData.newPassword ||
                !passwordData.confirmPassword
              }
              className="w-full"
            >
              {isChangingPassword ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white mr-2" />
                  {tCommon("loading")}
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  {tSettings("security.changePassword.button")}
                </>
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );

  const DangerSection = () => (
    <Card className="border-destructive/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-destructive/20 to-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-destructive">
              {tSettings("account.deleteAccount.title")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {tSettings("account.deleteAccount.description")}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
          <p className="text-sm text-destructive font-medium">
            ⚠️ {tSettings("account.deleteAccount.warning")}
          </p>
        </div>

        {!showDeleteConfirm ? (
          <Button
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {tSettings("account.deleteAccount.button")}
          </Button>
        ) : (
          <div className="space-y-4">
            <div>
              <label
                className="text-sm font-medium"
                htmlFor="delete-confirmation"
              >
                {tSettings("account.deleteAccount.confirmation.type")}
              </label>
              <Input
                id="delete-confirmation"
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={tSettings(
                  "account.deleteAccount.confirmation.placeholder"
                )}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Type &quot;DELETE&quot; to confirm
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount || deleteConfirmation !== "DELETE"}
                className="flex-1"
              >
                {isDeletingAccount ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white mr-2" />
                    {tCommon("loading")}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {tSettings("account.deleteAccount.confirmation.confirm")}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmation("");
                }}
                disabled={isDeletingAccount}
                className="flex-1"
              >
                {tSettings("account.deleteAccount.confirmation.cancel")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Mobile Section Components
  const MobileNotificationsSection = () => (
    <div className="p-4 space-y-4">
      <div className="bg-card rounded-xl border p-4">
        <div className="flex items-center gap-3 mb-3">
          <Bell className="h-5 w-5 text-blue-500" />
          <h3 className="font-medium">{tSettings("notifications.title")}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {tSettings("notifications.description")}
        </p>
      </div>

      <div className="space-y-3">
        {/* PSC Balance Notifications */}
        <div className="bg-card rounded-xl border p-4">
          <div className="space-y-3">
            <div>
              <p className="font-medium text-sm mb-1">
                {tSettings("notifications.pscBalance.label")}
              </p>
              <p className="text-xs text-muted-foreground">
                Get notified about your balance
              </p>
            </div>
            <div className="relative">
              <select
                value={pscEmailPref}
                onChange={(e) => {
                  const next = e.target.value as "intelligently" | "never";
                  const prev = pscEmailPref;
                  setPscEmailPref(next);
                  updateEmailPreference("pscBalance", next, prev);
                }}
                disabled={isSavingEmailPrefs}
                className="w-full px-4 py-2.5 pr-10 rounded-lg border bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="intelligently">
                  {tSettings("notifications.options.intelligently")}
                </option>
                <option value="never">
                  {tSettings("notifications.options.never")}
                </option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Unread Notifications */}
        <div className="bg-card rounded-xl border p-4">
          <div className="space-y-3">
            <div>
              <p className="font-medium text-sm mb-1">
                {tSettings("notifications.unread.label")}
              </p>
              <p className="text-xs text-muted-foreground">
                Unread notifications reminders
              </p>
            </div>
            <div className="relative">
              <select
                value={unreadEmailPref}
                onChange={(e) => {
                  const next = e.target.value as "intelligently" | "never";
                  const prev = unreadEmailPref;
                  setUnreadEmailPref(next);
                  updateEmailPreference("unreadNotifications", next, prev);
                }}
                disabled={isSavingEmailPrefs}
                className="w-full px-4 py-2.5 pr-10 rounded-lg border bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="intelligently">
                  {tSettings("notifications.options.intelligently")}
                </option>
                <option value="never">
                  {tSettings("notifications.options.never")}
                </option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const MobileLanguageSection = () => (
    <div className="p-4 space-y-4">
      <div className="bg-card rounded-xl border p-4">
        <div className="flex items-center gap-3 mb-3">
          <Globe className="h-5 w-5 text-green-500" />
          <h3 className="font-medium">{tSettings("language.title")}</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {tSettings("language.description")}
        </p>
      </div>

      <div className="space-y-2">
        {/* Auto Option */}
        <button
          onClick={() => handleLanguageChange("auto")}
          className={`w-full p-4 rounded-xl border transition-all ${
            isLanguageAutomatic
              ? "border-primary bg-primary/5"
              : "bg-card border-border"
          }`}
          disabled={isChangingLanguage}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌐</span>
              <div className="text-left">
                <p className="font-medium">{tSettings("language.automatic")}</p>
                <p className="text-xs text-muted-foreground">
                  Use browser language
                </p>
              </div>
            </div>
            {isLanguageAutomatic && <Check className="h-5 w-5 text-primary" />}
          </div>
        </button>

        {/* Language Options */}
        {languageOptions.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`w-full p-4 rounded-xl border transition-all ${
              !isLanguageAutomatic && selectedLanguage === lang.code
                ? "border-primary bg-primary/5"
                : "bg-card border-border"
            }`}
            disabled={isChangingLanguage}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{lang.flag}</span>
                <div className="text-left">
                  <p className="font-medium">{lang.nativeName}</p>
                  <p className="text-xs text-muted-foreground">{lang.name}</p>
                </div>
              </div>
              {!isLanguageAutomatic && selectedLanguage === lang.code && (
                <Check className="h-5 w-5 text-primary" />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const MobileUsageSection = () => (
    <div className="p-4 space-y-4">
      <div className="bg-card rounded-xl border p-4">
        <div className="flex items-center gap-3 mb-3">
          <BarChart3 className="h-5 w-5 text-purple-500" />
          <h3 className="font-medium">{tSettings("usage.title")}</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {tSettings("usage.description")}
        </p>
      </div>

      <div className="space-y-3">
        {/* Daily Usage */}
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">{tSettings("usage.images.daily")}</h4>
            <Badge variant="outline">
              {planLimits?.imagesPerDay === "unlimited"
                ? "∞"
                : `${usageStats.imagesGeneratedToday}/${
                    planLimits?.imagesPerDay || 0
                  }`}
            </Badge>
          </div>
          <UsageIndicator type="daily" />
          <p className="text-xs text-muted-foreground mt-3">
            {tSettings("usage.resetInfo.daily")}
          </p>
        </div>

        {/* Monthly Usage */}
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">{tSettings("usage.images.monthly")}</h4>
            <Badge variant="outline">
              {planLimits?.imagesPerMonth === "unlimited"
                ? "∞"
                : `${usageStats.imagesGeneratedThisMonth}/${
                    planLimits?.imagesPerMonth || 0
                  }`}
            </Badge>
          </div>
          <UsageIndicator type="monthly" />
          <p className="text-xs text-muted-foreground mt-3">
            {tSettings("usage.resetInfo.billingCycle")}
          </p>
        </div>
      </div>
    </div>
  );

  const MobileSubscriptionSection = () => (
    <div className="p-4 space-y-4">
      <div className="bg-card rounded-xl border p-4">
        <div className="flex items-center gap-3 mb-3">
          <CreditCard className="h-5 w-5 text-yellow-500" />
          <h3 className="font-medium">{tSettings("subscription.title")}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {tSettings("subscription.description")}
        </p>

        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Current Plan</span>
            <UserPlanBadge plan={user.planInfo.plan} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {currentPlan === "free" && (
          <LocaleLink href="/pricing" className="block">
            <Button className="w-full" size="lg">
              <Sparkles className="h-4 w-4 mr-2" />
              {tSettings("subscription.upgrade")}
            </Button>
          </LocaleLink>
        )}

        {currentPlan !== "free" && currentPlan !== "pro" && (
          <LocaleLink href="/pricing" className="block">
            <Button className="w-full" variant="outline">
              {tSettings("subscription.actions.upgradeTo", { plan: "Pro" })}
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </LocaleLink>
        )}

        {currentPlan !== "free" && (
          <Button
            variant="outline"
            onClick={() => setShowCancelSubscription(true)}
            className="w-full text-destructive hover:bg-destructive/10"
          >
            {tSettings("subscription.cancel")}
          </Button>
        )}
      </div>
    </div>
  );

  const MobileSecuritySection = () => (
    <div className="p-4 space-y-4">
      <div className="bg-card rounded-xl border p-4">
        <div className="flex items-center gap-3 mb-3">
          <Shield className="h-5 w-5 text-indigo-500" />
          <h3 className="font-medium">{tSettings("security.title")}</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {tSettings("security.description")}
        </p>
      </div>

      {user.googleId ? (
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <svg className="h-6 w-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {tSettings("security.unavailable.title")}
              </p>
              <p className="text-xs text-muted-foreground">
                {tSettings("security.unavailable.message")}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              window.open("https://myaccount.google.com", "_blank")
            }
            className="w-full"
          >
            {tSettings("security.unavailable.action")}
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </div>
      ) : (
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div className="bg-card rounded-xl border p-4 space-y-4">
            <div>
              <label
                className="text-sm font-medium block mb-2"
                htmlFor="current-password"
              >
                {tSettings("security.changePassword.currentPassword")}
              </label>
              <Input
                id="current-password"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    currentPassword: e.target.value,
                  })
                }
                required
              />
            </div>

            <div>
              <label
                className="text-sm font-medium block mb-2"
                htmlFor="new-password"
              >
                {tSettings("security.changePassword.newPassword")}
              </label>
              <Input
                id="new-password"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    newPassword: e.target.value,
                  })
                }
                required
                minLength={8}
              />
            </div>

            <div>
              <label
                className="text-sm font-medium block mb-2"
                htmlFor="confirm-password"
              >
                {tSettings("security.changePassword.confirmPassword")}
              </label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    confirmPassword: e.target.value,
                  })
                }
                required
                minLength={8}
              />
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                {tSettings("security.changePassword.requirements")}
              </p>
            </div>
          </div>

          <Button
            type="submit"
            disabled={
              isChangingPassword ||
              !passwordData.currentPassword ||
              !passwordData.newPassword ||
              !passwordData.confirmPassword
            }
            className="w-full"
          >
            {isChangingPassword ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white mr-2" />
                {tCommon("loading")}
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                {tSettings("security.changePassword.button")}
              </>
            )}
          </Button>
        </form>
      )}
    </div>
  );

  const MobileDangerSection = () => (
    <div className="p-4 space-y-4">
      <div className="bg-destructive/10 rounded-xl border border-destructive/20 p-4">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h3 className="font-medium text-destructive">
            {tSettings("account.deleteAccount.title")}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {tSettings("account.deleteAccount.description")}
        </p>
        <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
          <p className="text-sm text-destructive font-medium">
            ⚠️ {tSettings("account.deleteAccount.warning")}
          </p>
        </div>
      </div>

      {!showDeleteConfirm ? (
        <Button
          variant="destructive"
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {tSettings("account.deleteAccount.button")}
        </Button>
      ) : (
        <div className="bg-card rounded-xl border p-4 space-y-4">
          <div>
            <label
              className="text-sm font-medium block mb-2"
              htmlFor="delete-confirmation"
            >
              {tSettings("account.deleteAccount.confirmation.type")}
            </label>
            <Input
              id="delete-confirmation"
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={tSettings(
                "account.deleteAccount.confirmation.placeholder"
              )}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Type &quot;DELETE&quot; to confirm
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteConfirmation("");
              }}
              disabled={isDeletingAccount}
            >
              {tSettings("account.deleteAccount.confirmation.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount || deleteConfirmation !== "DELETE"}
            >
              {isDeletingAccount ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white mr-2" />
                  {tCommon("loading")}
                </>
              ) : (
                tSettings("account.deleteAccount.confirmation.confirm")
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  // Main render
  return (
    <>
      {isMobile ? (
        <MobileView />
      ) : (
        // Desktop view remains the same
        <DesktopView />
      )}

      {/* Modals */}
      <AnimatePresence>
        {showCancelSubscription && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isUpdating) {
                setShowCancelSubscription(false);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-xl border max-w-md w-full p-6 shadow-2xl"
            >
              <h3 className="text-lg font-semibold mb-2">
                {tSettings("subscription.confirmCancel.title")}
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                {tSettings("subscription.confirmCancel.message")}
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowCancelSubscription(false)}
                  disabled={isUpdating}
                  className="flex-1"
                >
                  {tSettings("subscription.confirmCancel.keep")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCancelSubscription}
                  disabled={isUpdating}
                  className="flex-1"
                  ref={confirmCancelRef}
                >
                  {isUpdating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white mr-2" />
                      {tCommon("loading")}
                    </>
                  ) : (
                    tSettings("subscription.confirmCancel.confirm")
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert Dialog */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={closeAlert}
        title={alertDialog.title}
        message={alertDialog.message}
        variant={alertDialog.variant}
      />
    </>
  );
}
