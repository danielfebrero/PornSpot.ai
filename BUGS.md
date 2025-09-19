[x] On desktop, user/bookmarks and user/likes show grid-cols-1 instead of grid-cols-3 until you navigate or change viewmode.

[x] In Admin zone, last images I uploaded were 2 by 2 instead of bulk upload. This should be fixed to allow bulk uploads for images. WONT FIX.

[x] The optimistic update for view counts does not work correctly when navigating from page to page. We need to ensure that the view count is updated consistently across all pages.

[x] User/bookmarks page grid consider all items as media. Albums appear as media.

[x] User profiles does not work, it shows Anonymous.

[x] View all generated medias and last generated media of a user does not work.

[x] LoRA are not used correctly by the workflow API probably because images are really different from Comfy UI client images with the same parameters.

[x] Sur la page generate, le plan se charge pas des fois, certaines fois il disparait completement après un certain usage je crois, et des fois le plan apparait correctement (le pro).

[x] From user Albums page, delete album do not close the popup immediately. CANNOT REPRODUCE.

[x] Cannot open media page of a generated media, error 500.

[x] The user likes page do not sort by most recent.

[x] When creating the first album in user albums page, it appears in list mode instead of grid. But correctly set to grid.

[x] Homepage Discover is cached incorrectly because after navigating away and back, the state is not preserved. WONT FIX: IT HAPPENS ONLY WHEN DISCOVER PAGE IS EMPTY THEN ONE ALBUM IS ADDED. WILL NEVER HAPPEN IN PROD.

[x] I think deleting an album do not decrease user total albums count.

[x] Discover: filter by tag do not work, no album found.

[x] On media page, view count is not correctly reflected on ContentCard.

[x] Adding a like or a bookmark should update optimistically the User likes and bookmarks pages.

[x] Add to album dialog should update album media count optimistically.

[x] Edit album dialog should update album media count optimistically.

[x] Remove media from Admin manage album media should update optimistically top page media count.

[x] If I open another tab while generating image, my websocket connection id is replaced by a new one and I don't receive generation updates anymore.

[x] On media page and album page, optimist update of likes does not work anymore. It works on user comments page.

[x] Progress card on generate page should not show estimated wait time because it's broken.

[x] If add an image to album already in album, we must display a message informative.

[x] Bulk remove media from album in edit album dialog does not work

[x] Last liked user media does not appear in the user profile.

[x] Like status is not updated on the user profile for albums and media in last...

[x] Bookmark status do not show on last created albums on user profile.

[x] After content #20, interaction status does not show on user likes page (and probably other pages).

[x] When visiting another user profile, I see my plan instead of his plan (or I always see free plan may be).

[x] Free users have 0 generation remaining instead of 1.

[x] Last generated image added from media page to an album do not display "in albums" album card on media page.

[x] Album cover image not showing cover but first image of the album.

[x] On mobile, cannot pinch and zoom on an image because of swipe gesture.

[x] After deleting my account, cannot sign in with Google.

[x] Auto signing after verify email did not work.

[x] Trop d’appels aux API Location ou History dans un court laps de temps dans Lightbox.

[x] On register, I do not receive the welcome email. WONT FIX, DO NOT SEND WELCOME EMAIL ANYMORE.

[x] On generate page, revert to original prompt is not showing anymore.

[x] The magic text effect does not happen anymore.

[x] On refresh generate page, it sometimes fail and show an error.

[x] On generate page, "remaining generation" is not in sync with server rate limit.

[x] On User Albums Create page, thumbnails overlap and show be infinite scroll.

[ ] On settings page, in quotas section, the monthly usage indicate it's based on billing cycle but currently it's based on 1-30 cycle - use billing cycle instead.

[x] On generate page, when I navigate, it add again last images to recent images.

[x] In lightbox, I do not see the like and bookmark icons.

[x] Admin Users load more is not working.

[x] On Generate page, cannot change the seed.

[x] Comments do not show user avatar.

[x] When dropping a comment, it first show "anonymous user" instead of real username.

[ ] Update media title show back the original media title until PUT request is successful.

[x] When I change privacy of an image from Media Detail Client, username is replaced with user id and metadata disappears.

[x] Fix the recurring lambda issue.

[x] View last created user albums in profile in List view does not works correctly, glitch effect and album disappearing.

[x] View last generated user media in profile in List view does not works correctly, no media shows and load all media in api calls.

[x] View My Albums in list view has the same glitch as View last created user albums in profile in List view.

[ ] In view My Likes in list view, it glitches when I hover an album.

[x] Albums items from api do not contain thumbnailsUrls.

[x] Total views in analytics is not working.

[x] On generate page, recent generations only shows the first 10-12 images.

[x] Cannot set seed to 0 manually.

[x] On generate page, lightbox delete image does not work as expected.

[x] Delete image from admin media page does not work.

[ ] In an album, when I fullscreen an image, it's view count is set to 1 instead of +1.

[x] Do not show empty albums on discover page.

[ ] Images often exclude the face, depending on how you prompt.

[x] Fix all the missing translations from vercel build logs.

[x] Analytics daily shows 23 points instead of 24 (a complete day).

[ ] If I delete cover image, auto attribute another cover image.

[x] On media page, delete sibling dialog and add to albums appears in the scrollable container instead of in the middle of the page. Add to albums is not usable.

[ ] Admin edit album missing locales.

[x] Edit album does not work on mobile.

[ ] frontend/src/components/ui/ContentCard.tsx ConfirmDialog texts are hardcoded.

[ ] On user album page content cards Delete button should not appear because it's already in the custom actions.

[ ] User profile last generated media should show 20+ instead of 20.

[ ] Sort by popularity takes too long, revise GSI.

[ ] The PornSpotCoin page on mobile is ugly.

[ ] On mobile, I cannot drag lora strength in generate page.

[ ] The user PornSpotCoin Transactions page loads ALL transactions instead of paginating.

[ ] On videos page, incomplete video progression do not progress, I have to re render the page to see updated progress.

[ ] Videos page, when 1 video, load more videos in loop.

[ ] On mobile, on I2V page, the source image blink when I change settings.

[ ] On video page, when video is pass from incomplete to complete status, it disappear optimistically but do not reappear as ContentCard video.

[x] On images page, the video appear but shouldn't.

[ ] On mobile, I can follow myself by going on my profile from a {username} link.
