"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/Card";
import { ExternalLink } from "lucide-react";

interface FriendLink {
  title: string;
  url: string;
  description: string;
  logo: string;
}

export function OurFriendsClient() {
  const t = useTranslations("ourFriends");

  // Friends list - can be expanded in the future
  const friends: FriendLink[] = [
    {
      title: "SlyKiwi - Tag Analytics for Fansly",
      url: "https://slykiwi.com/",
      description: t("friends.slykiwi.description"),
      logo: "/our-friends/slykiwi.webp",
    },
    {
      title: "Fabularius Chatbot",
      url: "https://fabularius.ai/18",
      description: t("friends.fabularius.description"),
      logo: "/our-friends/fabularius.png",
    },
    {
      title: "Build Your Own Female (BYOF)",
      url: "https://byof.app",
      description: t("friends.byof.description"),
      logo: "/our-friends/byof.avif",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          {t("title")}
        </h1>
        <p className="text-lg text-muted-foreground mb-6">{t("subtitle")}</p>
      </div>

      {/* Friends List */}
      <div className="space-y-6">
        {friends.map((friend, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                {/* Friend Logo */}
                <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center overflow-hidden">
                  <img
                    src={friend.logo}
                    alt={`${friend.title} logo`}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    <a
                      href={friend.url}
                      target="_blank"
                      rel="noopener"
                      className="hover:text-primary transition-colors inline-flex items-center gap-2"
                    >
                      {friend.title}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {friend.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Info */}
      <div className="mt-12 text-center">
        <Card className="bg-muted/30">
          <CardContent className="p-6">
            <p className="text-muted-foreground">{t("additionalInfo")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
