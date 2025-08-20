[x] On desktop, user/bookmarks and user/likes show grid-cols-1 instead of grid-cols-3 until you navigate or change viewmode.

[x] In Admin zone, last images I uploaded were 2 by 2 instead of bulk upload. This should be fixed to allow bulk uploads for images. WONT FIX.

[x] The optimistic update for view counts does not work correctly when navigating from page to page. We need to ensure that the view count is updated consistently across all pages.

[x] User/bookmarks page grid consider all items as media. Albums appear as media.

[x] User profiles does not work, it shows Anonymous.

[x] View all generated medias and last generated media of a user does not work.

[x] LoRA are not used correctly by the workflow API probably because images are really different from Comfy UI client images with the same parameters.

[ ] Sur la page generate, le plan se charge pas des fois, certaines fois il disparait completement après un certain usage je crois, et des fois le plan apparait correctement (le pro).

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

[ ] If I open another tab while generating image, my websocket connection id is replaced by a new one and I don't receive generation updates anymore.

[x] On media page and album page, optimist update of likes does not work anymore. It works on user comments page.

[ ] Progress card on generate page should not show estimated wait time because it's broken.

[ ] If add an image to album already in album, we must display a message informative.

[x] Bulk remove media from album in edit album dialog does not work

[x] Last liked user media does not appear in the user profile.

[ ] Like status is not updated on the user profile for albums and media in last...

[ ] Like count not showing on most pages in ContentCard.

[ ] Bookmark status do not show on last created albums on user profile.
