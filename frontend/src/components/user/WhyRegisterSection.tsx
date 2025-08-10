"use client";

import { useTranslations } from "next-intl";

export function WhyRegisterSection() {
  const t = useTranslations("auth.whyRegister");

  return (
    <div className="max-w-4xl mx-auto py-8 lg:py-0 px-4">
      <div className="text-center lg:text-left mb-6 lg:mb-8">
        <h3 className="text-xl lg:text-2xl font-bold text-foreground mb-2">
          {t("title")}
        </h3>
        <p className="text-muted-foreground text-sm lg:text-base">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
        {/* 5 générations gratuites */}
        <div className="flex lg:flex-col items-center lg:items-start text-center lg:text-left group p-4 lg:p-6 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 hover:shadow-lg transition-all duration-200">
          <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl lg:rounded-2xl flex items-center justify-center mr-4 lg:mr-0 mb-0 lg:mb-4 group-hover:scale-110 transition-transform duration-200 flex-shrink-0">
            <svg
              className="w-6 h-6 lg:w-8 lg:h-8 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-1 lg:mb-2 text-sm lg:text-base">
              {t("benefits.freeGenerations.title")}
            </h4>
            <p className="text-xs lg:text-sm text-muted-foreground">
              {t("benefits.freeGenerations.description")}
            </p>
          </div>
        </div>

        {/* Liste d'images */}
        <div className="flex lg:flex-col items-center lg:items-start text-center lg:text-left group p-4 lg:p-6 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all duration-200">
          <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl lg:rounded-2xl flex items-center justify-center mr-4 lg:mr-0 mb-0 lg:mb-4 group-hover:scale-110 transition-transform duration-200 flex-shrink-0">
            <svg
              className="w-6 h-6 lg:w-8 lg:h-8 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-1 lg:mb-2 text-sm lg:text-base">
              {t("benefits.saveImages.title")}
            </h4>
            <p className="text-xs lg:text-sm text-muted-foreground">
              {t("benefits.saveImages.description")}
            </p>
          </div>
        </div>

        {/* Albums */}
        <div className="flex lg:flex-col items-center lg:items-start text-center lg:text-left group p-4 lg:p-6 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 border border-purple-200 dark:border-purple-800 hover:shadow-lg transition-all duration-200">
          <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl lg:rounded-2xl flex items-center justify-center mr-4 lg:mr-0 mb-0 lg:mb-4 group-hover:scale-110 transition-transform duration-200 flex-shrink-0">
            <svg
              className="w-6 h-6 lg:w-8 lg:h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-1 lg:mb-2 text-sm lg:text-base">
              {t("benefits.createAlbums.title")}
            </h4>
            <p className="text-xs lg:text-sm text-muted-foreground">
              {t("benefits.createAlbums.description")}
            </p>
          </div>
        </div>

        {/* Communauté */}
        <div className="flex lg:flex-col items-center lg:items-start text-center lg:text-left group p-4 lg:p-6 rounded-xl bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 border border-red-200 dark:border-red-800 hover:shadow-lg transition-all duration-200">
          <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl lg:rounded-2xl flex items-center justify-center mr-4 lg:mr-0 mb-0 lg:mb-4 group-hover:scale-110 transition-transform duration-200 flex-shrink-0">
            <svg
              className="w-6 h-6 lg:w-8 lg:h-8 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-1 lg:mb-2 text-sm lg:text-base">
              {t("benefits.community.title")}
            </h4>
            <p className="text-xs lg:text-sm text-muted-foreground">
              {t("benefits.community.description")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
