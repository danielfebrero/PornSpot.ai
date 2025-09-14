"use client";

import { useState, useEffect } from "react";
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
  Settings as SettingsIcon,
  Globe,
  CreditCard,
  Shield,
  BarChart3,
  AlertTriangle,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { useUserContext } from "@/contexts/UserContext";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { Mail } from "lucide-react";

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

const languageOptions: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
];

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

  const showAlert = (
    title: string,
    message: string,
    variant: "info" | "success" | "warning" | "error" = "info"
  ) => {
    setAlertDialog({
      isOpen: true,
      title,
      message,
      variant,
    });
  };

  const closeAlert = () => {
    setAlertDialog({
      isOpen: false,
      title: "",
      message: "",
      variant: "info",
    });
  };

  useEffect(() => {
    // Check if user has a language preference
    if (user?.preferredLanguage && user.preferredLanguage !== "") {
      // User has a specific language preference set
      setSelectedLanguage(user.preferredLanguage);
      setIsLanguageAutomatic(false);
      // If current locale doesn't match preference, redirect
      if (currentLocale !== user.preferredLanguage) {
        router.replace(`/${user.preferredLanguage}/settings`);
      }
    } else if (user?.preferredLanguage === "") {
      // User explicitly chose "auto" mode (empty string)
      const browserLang = navigator.language.split("-")[0];
      const supportedLang = locales.includes(browserLang as any)
        ? browserLang
        : "en";

      setSelectedLanguage(supportedLang);
      setIsLanguageAutomatic(true);

      // If current locale doesn't match browser language, redirect
      if (currentLocale !== supportedLang) {
        router.replace(`/${supportedLang}/settings`);
      }
    } else {
      // User has never set a preference (undefined/null)
      // Show automatic if browser language matches current locale
      const browserLang = navigator.language.split("-")[0];
      const isBrowserLangSupported = locales.includes(browserLang as any);
      const browserLangMatches =
        isBrowserLangSupported && browserLang === currentLocale;

      setSelectedLanguage(currentLocale);
      setIsLanguageAutomatic(browserLangMatches);
    }
  }, [currentLocale, user?.preferredLanguage, router]);

  // Initialize email preferences from user
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
      // revert on error
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

  // Handle language change
  const handleLanguageChange = async (languageCode: string) => {
    setIsChangingLanguage(true);

    try {
      if (languageCode === "auto") {
        // Clear user's language preference to enable automatic detection
        await userApi.updateLanguage("");

        // Get browser language and determine target locale
        const browserLang = navigator.language.split("-")[0];
        const supportedLang = locales.includes(browserLang as any)
          ? browserLang
          : "en";

        // Set the UI state to show automatic mode
        setIsLanguageAutomatic(true);
        setSelectedLanguage(supportedLang);

        // Only navigate if we need to change locale
        if (currentLocale !== supportedLang) {
          router.push(`/${supportedLang}/settings`);
        }
      } else {
        // Save language preference to user profile
        await userApi.updateLanguage(languageCode);

        // Set manual mode and selection
        setIsLanguageAutomatic(false);
        setSelectedLanguage(languageCode);

        // Navigate to selected language if different
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

  // Handle password change
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

  // Handle account deletion
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

      // Log out the user automatically after successful account deletion
      await logoutMutation.mutateAsync();

      // Redirect to home page after deletion and logout
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

  // Handle subscription cancellation
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
      // Refresh user data
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{tCommon("loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Not authenticated
          </h2>
          <p className="text-muted-foreground mb-4">
            Please log in to access settings.
          </p>
          <LocaleLink href="/auth/login">
            <Button>{t("auth.signIn")}</Button>
          </LocaleLink>
        </div>
      </div>
    );
  }

  const currentPlan = userPermissions.getCurrentPlan();
  const planLimits = userPermissions.getPlanLimits();
  const userWithPlan = user;
  const usageStats = userWithPlan.usageStats || {
    imagesGeneratedThisMonth: 0,
    imagesGeneratedToday: 0,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <SettingsIcon className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">
              {tSettings("title")}
            </h1>
          </div>
          <p className="text-muted-foreground">{tSettings("description")}</p>
        </div>

        <div className="space-y-8">
          {/* Notifications Settings */}
          <Card>
            <CardHeader className="flex flex-row items-center space-y-0 pb-4">
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold">
                    {tSettings("notifications.title")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {tSettings("notifications.description")}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">
                    {tSettings("notifications.pscBalance.label")}
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
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="intelligently">
                      {tSettings("notifications.options.intelligently")}
                    </option>
                    <option value="never">
                      {tSettings("notifications.options.never")}
                    </option>
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">
                    {tSettings("notifications.unread.label")}
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
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
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

              {/* Auto-save on change; no explicit save button */}
            </CardContent>
          </Card>
          {/* Language Settings */}
          <Card>
            <CardHeader className="flex flex-row items-center space-y-0 pb-4">
              <div className="flex items-center space-x-3">
                <Globe className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold">
                    {tSettings("language.title")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {tSettings("language.description")}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {tSettings("language.current")}
                  </div>
                  <select
                    id="language-select"
                    value={isLanguageAutomatic ? "auto" : selectedLanguage}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    disabled={isChangingLanguage}
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="auto">
                      {tSettings("language.automatic")}
                    </option>
                    {languageOptions.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.nativeName} ({lang.name})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong>{tSettings("language.current")}:</strong>{" "}
                  {isChangingLanguage ? (
                    <span className="inline-flex items-center gap-2">
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-primary"></div>
                      {tCommon("loading")}
                    </span>
                  ) : (
                    languageOptions.find((l) => l.code === currentLocale)
                      ?.nativeName || "English"
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage & Quotas */}
          <Card>
            <CardHeader className="flex flex-row items-center space-y-0 pb-4">
              <div className="flex items-center space-x-3">
                <BarChart3 className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold">
                    {tSettings("usage.title")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {tSettings("usage.description")}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {tSettings("subscription.currentPlan")}
                </span>
                <UserPlanBadge plan={user.planInfo.plan} />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Daily Usage */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">
                      {tSettings("usage.images.daily")}
                    </h3>
                    <Badge variant="outline">
                      {planLimits?.imagesPerDay === "unlimited"
                        ? tSettings("usage.quotas.unlimited")
                        : `${usageStats.imagesGeneratedToday} / ${
                            planLimits?.imagesPerDay || 0
                          }`}
                    </Badge>
                  </div>
                  <UsageIndicator type="daily" />
                  <p className="text-xs text-muted-foreground">
                    {tSettings("usage.resetInfo.daily")}
                  </p>
                </div>

                {/* Monthly Usage */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">
                      {tSettings("usage.images.monthly")}
                    </h3>
                    <Badge variant="outline">
                      {planLimits?.imagesPerMonth === "unlimited"
                        ? tSettings("usage.quotas.unlimited")
                        : `${usageStats.imagesGeneratedThisMonth} / ${
                            planLimits?.imagesPerMonth || 0
                          }`}
                    </Badge>
                  </div>
                  <UsageIndicator type="monthly" />
                  <p className="text-xs text-muted-foreground">
                    {tSettings("usage.resetInfo.billingCycle")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Management */}
          <Card>
            <CardHeader className="flex flex-row items-center space-y-0 pb-4">
              <div className="flex items-center space-x-3">
                <CreditCard className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold">
                    {tSettings("subscription.title")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {tSettings("subscription.description")}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {tSettings(`subscription.plans.${currentPlan}`)}
                </span>
                <UserPlanBadge plan={user.planInfo.plan} />
              </div>

              <div className="flex flex-wrap gap-3">
                {currentPlan === "free" && (
                  <LocaleLink href="/pricing">
                    <Button className="flex items-center space-x-2">
                      <span>{tSettings("subscription.upgrade")}</span>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </LocaleLink>
                )}

                {currentPlan !== "free" && currentPlan !== "pro" && (
                  <LocaleLink href="/pricing">
                    <Button className="flex items-center space-x-2">
                      <span>
                        {tSettings("subscription.actions.upgradeTo", {
                          plan: "Pro",
                        })}
                      </span>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </LocaleLink>
                )}

                {currentPlan !== "free" && (
                  <Button
                    variant="outline"
                    onClick={() => setShowCancelSubscription(true)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    {tSettings("subscription.cancel")}
                  </Button>
                )}
              </div>

              {/* Cancellation Confirmation Modal */}
              {showCancelSubscription && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-card rounded-lg border max-w-md w-full p-6">
                    <h3 className="text-lg font-semibold mb-2">
                      {tSettings("subscription.confirmCancel.title")}
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      {tSettings("subscription.confirmCancel.message")}
                    </p>
                    <div className="flex space-x-3">
                      <Button
                        variant="destructive"
                        onClick={handleCancelSubscription}
                        disabled={isUpdating}
                      >
                        {isUpdating
                          ? tCommon("loading")
                          : tSettings("subscription.confirmCancel.confirm")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowCancelSubscription(false)}
                        disabled={isUpdating}
                      >
                        {tSettings("subscription.confirmCancel.keep")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader className="flex flex-row items-center space-y-0 pb-4">
              <div className="flex items-center space-x-3">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold">
                    {tSettings("security.title")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {tSettings("security.description")}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {user.googleId ? (
                // OAuth user - can't change password
                <div className="bg-muted/50 rounded-lg p-4">
                  <h3 className="font-medium mb-2">
                    {tSettings("security.unavailable.title")}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {tSettings("security.unavailable.message")}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() =>
                      window.open("https://myaccount.google.com", "_blank")
                    }
                    className="flex items-center space-x-2"
                  >
                    <span>{tSettings("security.unavailable.action")}</span>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                // Regular user - can change password
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-4">
                      {tSettings("security.changePassword.title")}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {tSettings("security.changePassword.description")}
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <div className="text-sm font-medium text-foreground mb-2">
                        {tSettings("security.changePassword.currentPassword")}
                      </div>
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
                      <div className="text-sm font-medium text-foreground mb-2">
                        {tSettings("security.changePassword.newPassword")}
                      </div>
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
                      <div className="text-sm font-medium text-foreground mb-2">
                        {tSettings("security.changePassword.confirmPassword")}
                      </div>
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
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {tSettings("security.changePassword.requirements")}
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      isChangingPassword ||
                      !passwordData.currentPassword ||
                      !passwordData.newPassword ||
                      !passwordData.confirmPassword
                    }
                  >
                    {isChangingPassword
                      ? tCommon("loading")
                      : tSettings("security.changePassword.button")}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone - Account Deletion */}
          <Card className="border-destructive/20">
            <CardHeader className="flex flex-row items-center space-y-0 pb-4">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <h2 className="text-xl font-semibold text-destructive">
                    {tSettings("account.deleteAccount.title")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {tSettings("account.deleteAccount.description")}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive font-medium">
                  {tSettings("account.deleteAccount.warning")}
                </p>
              </div>

              {!showDeleteConfirm ? (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center space-x-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{tSettings("account.deleteAccount.button")}</span>
                </Button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-foreground mb-2">
                      {tSettings("account.deleteAccount.confirmation.type")}
                    </div>
                    <Input
                      id="delete-confirmation"
                      type="text"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder={tSettings(
                        "account.deleteAccount.confirmation.placeholder"
                      )}
                    />
                  </div>

                  <div className="flex space-x-3">
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAccount}
                      disabled={
                        isDeletingAccount || deleteConfirmation !== "DELETE"
                      }
                      className="flex items-center space-x-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>
                        {isDeletingAccount
                          ? tCommon("loading")
                          : tSettings(
                              "account.deleteAccount.confirmation.confirm"
                            )}
                      </span>
                    </Button>
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
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Alert Dialog */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={closeAlert}
        title={alertDialog.title}
        message={alertDialog.message}
        variant={alertDialog.variant}
      />
    </div>
  );
}
