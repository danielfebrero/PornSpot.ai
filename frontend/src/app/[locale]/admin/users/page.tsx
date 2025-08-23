"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useAdminUsersQuery,
  useDisableUserMutation,
  useEnableUserMutation,
} from "@/hooks/queries/useAdminUsersQuery";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatDistanceToNow } from "@/lib/dateUtils";
import {
  User,
  UserCheck,
  UserX,
  Eye,
  Calendar,
  Clock,
  Mail,
  Shield,
  AlertCircle,
  Loader2,
} from "lucide-react";

export default function AdminUsersPage() {
  const router = useRouter();
  const {
    data: usersData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAdminUsersQuery({ limit: 20 });
  const disableUserMutation = useDisableUserMutation();
  const enableUserMutation = useEnableUserMutation();
  const [disablingUser, setDisablingUser] = useState<string | null>(null);
  const [enablingUser, setEnablingUser] = useState<string | null>(null);
  const [disableConfirm, setDisableConfirm] = useState<{
    isOpen: boolean;
    userId?: string;
  }>({ isOpen: false });
  const [enableConfirm, setEnableConfirm] = useState<{
    isOpen: boolean;
    userId?: string;
  }>({ isOpen: false });

  // Flatten all users from all pages
  const allUsers = useMemo(() => {
    if (!usersData?.pages) return [];
    return usersData.pages.flatMap((page) => page.users);
  }, [usersData]);

  // Handle loading more users
  const handleLoadMore = useCallback(async () => {
    if (!hasNextPage || isFetchingNextPage) return;

    try {
      await fetchNextPage();
    } catch (error) {
      console.error("Failed to load more users:", error);
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleViewUser = (username: string) => {
    router.push(`/profile/${username}`);
  };

  const handleDisableUser = async (userId: string) => {
    setDisableConfirm({ isOpen: true, userId });
  };

  const handleConfirmDisableUser = async () => {
    if (!disableConfirm.userId) return;

    try {
      setDisablingUser(disableConfirm.userId);
      setDisableConfirm({ isOpen: false });
      await disableUserMutation.mutateAsync(disableConfirm.userId);
    } catch (error) {
      console.error("Failed to disable user:", error);
      alert("Erreur lors de la désactivation de l'utilisateur.");
    } finally {
      setDisablingUser(null);
    }
  };

  const handleEnableUser = async (userId: string) => {
    setEnableConfirm({ isOpen: true, userId });
  };

  const handleConfirmEnableUser = async () => {
    if (!enableConfirm.userId) return;

    try {
      setEnablingUser(enableConfirm.userId);
      setEnableConfirm({ isOpen: false });
      await enableUserMutation.mutateAsync(enableConfirm.userId);
    } catch (error) {
      console.error("Failed to enable user:", error);
      alert("Erreur lors de la réactivation de l'utilisateur.");
    } finally {
      setEnablingUser(null);
    }
  };

  const getRoleBadgeColor = (role: string | undefined) => {
    switch (role?.toLowerCase()) {
      case "admin":
        return "bg-red-100 text-red-800 border-red-200";
      case "moderator":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "google":
        return "🔗";
      case "email":
        return "📧";
      default:
        return "👤";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl p-6 border border-admin-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-muted/50 rounded-lg animate-pulse"></div>
              <div>
                <div className="h-6 bg-muted/50 rounded w-32 mb-2 animate-pulse"></div>
                <div className="h-4 bg-muted/50 rounded w-48 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table Skeleton */}
        <Card className="p-6">
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-muted/50 rounded-full"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-muted/50 rounded w-32"></div>
                      <div className="h-3 bg-muted/50 rounded w-48"></div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <div className="h-8 w-16 bg-muted/50 rounded"></div>
                    <div className="h-8 w-20 bg-muted/50 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h2 className="text-xl font-semibold text-foreground">
          Erreur de chargement
        </h2>
        <p className="text-muted-foreground text-center max-w-md">
          Une erreur s&apos;est produite lors du chargement de la liste des
          utilisateurs. Veuillez réessayer plus tard.
        </p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl p-6 border border-admin-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-admin-primary/20 p-3 rounded-lg">
              <User className="w-6 h-6 text-admin-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Gestion des utilisateurs
              </h1>
              <p className="text-muted-foreground">
                Gérez les comptes utilisateurs, consultez les profils et
                désactivez les comptes si nécessaire
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-admin-primary">
              {allUsers.length}
            </div>
            <div className="text-sm text-muted-foreground">
              Utilisateurs{hasNextPage ? " (partiels)" : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <Card className="overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-foreground">
            Liste des utilisateurs
          </h2>

          {allUsers.length === 0 ? (
            <div className="text-center py-8">
              <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun utilisateur trouvé</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allUsers.map((user) => (
                <div
                  key={user.userId}
                  className={`flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                          user.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="absolute -bottom-1 -right-1 text-xs">
                        {getProviderIcon(user.provider)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-foreground truncate">
                          {user.username}
                        </h3>
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {user.role === "admin" && (
                            <Shield className="w-3 h-3 mr-1" />
                          )}
                          {user.role}
                        </Badge>
                        {!user.isActive && (
                          <Badge className="bg-red-100 text-red-800 border-red-200">
                            <UserX className="w-3 h-3 mr-1" />
                            Désactivé
                          </Badge>
                        )}
                        {user.isEmailVerified ? (
                          <UserCheck className="w-4 h-4 text-green-600" />
                        ) : (
                          <Mail className="w-4 h-4 text-yellow-600" />
                        )}
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span className="flex items-center space-x-1">
                          <Mail className="w-3 h-3" />
                          <span className="truncate max-w-48">
                            {user.email}
                          </span>
                        </span>

                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDistanceToNow(user.createdAt)}</span>
                        </span>

                        {user.lastLoginAt && (
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              Last active{" "}
                              {formatDistanceToNow(user.lastActive!)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewUser(user.username)}
                      className="whitespace-nowrap"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Voir
                    </Button>

                    {user.isActive ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDisableUser(user.userId)}
                        disabled={disablingUser === user.userId}
                        className="whitespace-nowrap"
                      >
                        <UserX className="w-4 h-4 mr-1" />
                        {disablingUser === user.userId
                          ? "Désactivation..."
                          : "Désactiver"}
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleEnableUser(user.userId)}
                        disabled={enablingUser === user.userId}
                        className="whitespace-nowrap bg-green-600 hover:bg-green-700 text-white"
                      >
                        <UserCheck className="w-4 h-4 mr-1" />
                        {enablingUser === user.userId
                          ? "Réactivation..."
                          : "Réactiver"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Load More Button */}
              {hasNextPage && (
                <div className="flex justify-center pt-6">
                  <Button
                    onClick={handleLoadMore}
                    disabled={isFetchingNextPage}
                    variant="outline"
                    className="min-w-32"
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Chargement...
                      </>
                    ) : (
                      "Charger plus"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={disableConfirm.isOpen}
        onClose={() => setDisableConfirm({ isOpen: false })}
        onConfirm={handleConfirmDisableUser}
        title="Désactiver l'utilisateur"
        message="Êtes-vous sûr de vouloir désactiver cet utilisateur ? Cette action supprimera également toutes ses sessions actives."
        confirmText="Désactiver"
        confirmVariant="danger"
      />

      <ConfirmDialog
        isOpen={enableConfirm.isOpen}
        onClose={() => setEnableConfirm({ isOpen: false })}
        onConfirm={handleConfirmEnableUser}
        title="Réactiver l'utilisateur"
        message="Êtes-vous sûr de vouloir réactiver cet utilisateur ?"
        confirmText="Réactiver"
        confirmVariant="primary"
      />
    </div>
  );
}
