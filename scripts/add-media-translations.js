#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const localesDir = path.join(__dirname, "../frontend/src/locales");

const translations = {
  en: {
    types: {
      image: "Image",
      video: "Video",
    },
    meta: {
      viewImage: "View this image on {siteName}",
      watchVideo: "Watch this video on {siteName}",
      aiGeneratedImage: "AI-generated adult image on {siteName}",
      aiGeneratedVideo: "AI-generated adult video on {siteName}",
    },
    keywords: {
      aiGeneratedImage: "AI generated image",
      aiGeneratedVideo: "AI generated video",
      adultImage: "adult image",
      adultVideo: "adult video",
      pornImage: "porn image",
      pornVideo: "porn video",
      aiArt: "AI art",
      aiNSFWVideo: "AI NSFW video",
    },
  },
  fr: {
    types: {
      image: "Image",
      video: "Vidéo",
    },
    meta: {
      viewImage: "Voir cette image sur {siteName}",
      watchVideo: "Regarder cette vidéo sur {siteName}",
      aiGeneratedImage: "Image adulte générée par IA sur {siteName}",
      aiGeneratedVideo: "Vidéo adulte générée par IA sur {siteName}",
    },
    keywords: {
      aiGeneratedImage: "image générée par IA",
      aiGeneratedVideo: "vidéo générée par IA",
      adultImage: "image adulte",
      adultVideo: "vidéo adulte",
      pornImage: "image porno",
      pornVideo: "vidéo porno",
      aiArt: "art IA",
      aiNSFWVideo: "vidéo IA NSFW",
    },
  },
  de: {
    types: {
      image: "Bild",
      video: "Video",
    },
    meta: {
      viewImage: "Sehen Sie sich dieses Bild auf {siteName} an",
      watchVideo: "Sehen Sie sich dieses Video auf {siteName} an",
      aiGeneratedImage: "KI-generiertes Erwachsenenbild auf {siteName}",
      aiGeneratedVideo: "KI-generiertes Erwachsenenvideo auf {siteName}",
    },
    keywords: {
      aiGeneratedImage: "KI-generiertes Bild",
      aiGeneratedVideo: "KI-generiertes Video",
      adultImage: "Erwachsenenbild",
      adultVideo: "Erwachsenenvideo",
      pornImage: "Pornobild",
      pornVideo: "Pornovideo",
      aiArt: "KI-Kunst",
      aiNSFWVideo: "KI NSFW-Video",
    },
  },
  es: {
    types: {
      image: "Imagen",
      video: "Video",
    },
    meta: {
      viewImage: "Ver esta imagen en {siteName}",
      watchVideo: "Ver este video en {siteName}",
      aiGeneratedImage: "Imagen adulta generada por IA en {siteName}",
      aiGeneratedVideo: "Video adulto generado por IA en {siteName}",
    },
    keywords: {
      aiGeneratedImage: "imagen generada por IA",
      aiGeneratedVideo: "video generado por IA",
      adultImage: "imagen adulta",
      adultVideo: "video adulto",
      pornImage: "imagen porno",
      pornVideo: "video porno",
      aiArt: "arte IA",
      aiNSFWVideo: "video IA NSFW",
    },
  },
  pt: {
    types: {
      image: "Imagem",
      video: "Vídeo",
    },
    meta: {
      viewImage: "Ver esta imagem em {siteName}",
      watchVideo: "Assistir este vídeo em {siteName}",
      aiGeneratedImage: "Imagem adulta gerada por IA em {siteName}",
      aiGeneratedVideo: "Vídeo adulto gerado por IA em {siteName}",
    },
    keywords: {
      aiGeneratedImage: "imagem gerada por IA",
      aiGeneratedVideo: "vídeo gerado por IA",
      adultImage: "imagem adulta",
      adultVideo: "vídeo adulto",
      pornImage: "imagem pornô",
      pornVideo: "vídeo pornô",
      aiArt: "arte IA",
      aiNSFWVideo: "vídeo IA NSFW",
    },
  },
  ru: {
    types: {
      image: "Изображение",
      video: "Видео",
    },
    meta: {
      viewImage: "Посмотреть это изображение на {siteName}",
      watchVideo: "Посмотреть это видео на {siteName}",
      aiGeneratedImage:
        "ИИ-сгенерированное изображение для взрослых на {siteName}",
      aiGeneratedVideo: "ИИ-сгенерированное видео для взрослых на {siteName}",
    },
    keywords: {
      aiGeneratedImage: "изображение, сгенерированное ИИ",
      aiGeneratedVideo: "видео, сгенерированное ИИ",
      adultImage: "изображение для взрослых",
      adultVideo: "видео для взрослых",
      pornImage: "порно изображение",
      pornVideo: "порно видео",
      aiArt: "ИИ искусство",
      aiNSFWVideo: "ИИ NSFW видео",
    },
  },
  hi: {
    types: {
      image: "छवि",
      video: "वीडियो",
    },
    meta: {
      viewImage: "{siteName} पर यह छवि देखें",
      watchVideo: "{siteName} पर यह वीडियो देखें",
      aiGeneratedImage: "{siteName} पर AI-जनित वयस्क छवि",
      aiGeneratedVideo: "{siteName} पर AI-जनित वयस्क वीडियो",
    },
    keywords: {
      aiGeneratedImage: "AI जनित छवि",
      aiGeneratedVideo: "AI जनित वीडियो",
      adultImage: "वयस्क छवि",
      adultVideo: "वयस्क वीडियो",
      pornImage: "पोर्न छवि",
      pornVideo: "पोर्न वीडियो",
      aiArt: "AI कला",
      aiNSFWVideo: "AI NSFW वीडियो",
    },
  },
  zh: {
    types: {
      image: "图片",
      video: "视频",
    },
    meta: {
      viewImage: "在{siteName}上查看此图片",
      watchVideo: "在{siteName}上观看此视频",
      aiGeneratedImage: "在{siteName}上的AI生成成人图片",
      aiGeneratedVideo: "在{siteName}上的AI生成成人视频",
    },
    keywords: {
      aiGeneratedImage: "AI生成图片",
      aiGeneratedVideo: "AI生成视频",
      adultImage: "成人图片",
      adultVideo: "成人视频",
      pornImage: "色情图片",
      pornVideo: "色情视频",
      aiArt: "AI艺术",
      aiNSFWVideo: "AI NSFW视频",
    },
  },
};

// Process each locale file
Object.keys(translations).forEach((locale) => {
  const filePath = path.join(localesDir, `${locale}.json`);

  try {
    const content = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // Check if media section exists
    if (content.media) {
      // Add new keys if they don't exist
      if (!content.media.types) {
        content.media.types = translations[locale].types;
      }
      if (!content.media.meta) {
        content.media.meta = translations[locale].meta;
      }
      if (!content.media.keywords) {
        content.media.keywords = translations[locale].keywords;
      }

      // Write back to file
      fs.writeFileSync(
        filePath,
        JSON.stringify(content, null, 2) + "\n",
        "utf8"
      );
      console.log(`✅ Updated ${locale}.json`);
    } else {
      console.warn(`⚠️  No media section found in ${locale}.json`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${locale}.json:`, error.message);
  }
});

console.log("\n✨ Translation update complete!");
