"use client";

export function WhyRegisterSection() {
  return (
    <div className="max-w-4xl mx-auto py-8 lg:py-0 px-4">
      <div className="text-center lg:text-left mb-6 lg:mb-8">
        <h3 className="text-xl lg:text-2xl font-bold text-foreground mb-2">
          Pourquoi s&apos;inscrire ?
        </h3>
        <p className="text-muted-foreground text-sm lg:text-base">
          Découvrez tous les avantages de rejoindre notre communauté
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
              5 générations gratuites
            </h4>
            <p className="text-xs lg:text-sm text-muted-foreground">
              Créez vos premières images IA sans engagement
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
              Conservez vos images
            </h4>
            <p className="text-xs lg:text-sm text-muted-foreground">
              Gardez une liste personnalisée de vos créations
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
              Créez des albums
            </h4>
            <p className="text-xs lg:text-sm text-muted-foreground">
              Organisez vos images par thèmes et collections
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
              Engagez avec la communauté
            </h4>
            <p className="text-xs lg:text-sm text-muted-foreground">
              Commentez, likez et gérez vos favoris
            </p>
          </div>
        </div>
      </div>

      {/* Preview gallery */}
      <div className="bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 rounded-xl lg:rounded-2xl p-4 lg:p-8 border border-primary/10">
        <div className="text-center lg:text-left mb-4 lg:mb-6">
          <h4 className="text-base lg:text-lg font-semibold text-foreground mb-2">
            Exemples de créations
          </h4>
          <p className="text-xs lg:text-sm text-muted-foreground">
            Voici quelques exemples de ce que vous pourrez créer
          </p>
        </div>

        <div className="flex justify-center lg:justify-start space-x-3 lg:space-x-4 overflow-hidden">
          {[
            { color: "from-pink-400 to-purple-500", icon: "image" },
            { color: "from-blue-400 to-cyan-500", icon: "heart" },
            { color: "from-green-400 to-emerald-500", icon: "grid" },
            { color: "from-orange-400 to-red-500", icon: "star" },
            { color: "from-indigo-400 to-purple-500", icon: "image" },
          ].map((item, index) => (
            <div
              key={index}
              className={`w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br ${item.color} rounded-lg lg:rounded-xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105`}
              style={{
                animationDelay: `${index * 0.1}s`,
                animation: "fadeInUp 0.6s ease-out forwards",
              }}
            >
              {item.icon === "image" && (
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
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              )}
              {item.icon === "heart" && (
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
              )}
              {item.icon === "grid" && (
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
                    d="M5 5a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2V5zM5 13a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6zM13 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM13 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              )}
              {item.icon === "star" && (
                <svg
                  className="w-6 h-6 lg:w-8 lg:h-8 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
