# TODO list

[x] Image titles must be better than Comfyui_Generated_000043.png.

[ ] Review the concept of queue and estimated waiting time.

[x] Reset database before launch.

[ ] Set up dev environment, ssm parameters, subdomains, etc.

[x] Set up stage environment, ssm parameters, subdomains, etc.

[x] Deleting a recent image from the list under the main images should remove it from the page instantly and close the lightbox.

[x] Navigating to another page should not lose the current state of image generation.

[x] Optimize filter by tags using indexes.

[x] When not logged in and try to like/bookmark, we need a visual feedback.

[x] On hover/tap an album card, I want to see changing thumbnails.

[ ] Write tests for backend and frontend.

[x] Implement admin users page.

[x] User albums virtualizedGrid is not set to load more for infinite loading.

[x] Translate all hardcoded strings.

[x] We should show siblings on media page.

[ ] Migrate to Terraform.

[ ] Migrate to Next.js 15.

[ ] Migrate to React.js 19.

[x] Implement forgot password page.

[x] Always show lora models and strength on media page, even if selected automatically.

[x] Remove all console logs.

[ ] Implement additional image credit, so we can do promotions and offer 10 images on signup.

[x] Review or implement Change password.

[x] Review how to generate images for anonymous users as they cannot generate jwt tokens.

[x] If I login after website load, make sure to get a new jwt token and websocket connection.

[ ] Verify the entire mobile and tablet experience.

[ ] Review page titles and meta descriptions.

[x] Hardcode things in negative prompt to prevent CSM.

[x] Implement private beta: invitation code wall + free users get all pro features.

[x] Add default cover image if no cover is selected.

[x] Add more parameters (cfg_scale, seed, steps, etc) to generation page and show them on Media page.

[ ] Button to cancel generation pending job (for if the pipeline fail and do not update queue entry status, such as missing websocket message).

[x] Implement payments.

[x] Implement Discover page algorithm that mix recent/popular contents and albums.

[x] Set custom max image size.

[x] Add more LoRA.

[x] When navigating then going backward, we must not lose infinite scroll position.

[x] Revalidate Discover page every 10 minutes.

[x] Update documentation (data models, apis...).

[x] Notification system on like received and comment received.

[x] In media page, do not show loRA safetensor name but loRA name.

[ ] "Boost my media" feature to appear on the Discover page.

[x] Feature to change media/album privacy after generation.

[x] Be able to change images titles.

[x] Remove usage stats from Admin default page.

[x] Ability to follow users.

[x] Button to delete the prompt.

[x] Remember user preferences on Generate page.

[x] Support anthropomorphic characters on Generate page.

[x] On pages showing a counter (likes, albums, etc) show 20+ instead of 20 if there is a cursor.

[ ] Be able to reply and tag users in comments.

[x] Replace all Initials with Avatars, including Profile comments.

[x] Add delete icon in fullscreen images of Generate page.

[x] In media, bookmarks and likes user page, place "count" in locale instead of two separate strings.

[x] Be able to like and bookmark album from album page, not only its content card.

[x] Send original prompt additionally to the optimized prompt, on the Generate page, so we can select loRAs based on original prompt always. If not, the second generation row do not use the same loRA because they are selected based on optimized one.

[ ] Add a button to copy prompt from media page.

[x] Add to album dialog album zone should be scrollable.

[x] Add "play" button in lightbox to auto play images.

[x] Handle user plans valid until date.

[ ] On delete from Discover, must optimistically disappear.

[x] Sort discover for most Popular.

[x] Check if "save image" step needs to be parallelized in generate image.

[x] Bulk download in zip.

[x] Bulk download to album.

[x] Bulk delete.

[ ] Tutorial of how the advanced controls work.

[x] Prevent screensaver when lightbox in slideshow mode.

[x] Auto reset generation param of users when their plan end.

[x] Redesign Generate page for mobile.

[x] Integrate "select many" in admin page.

[ ] Integrate "select many" in other users pages and Generate page.

[x] Send email when users have unread notifications.

[x] Send email when they accumulate PornSpotCoin.

[x] Improve setting page on mobile.

[ ] If content media or album is private, I should not be able to access it via direct link if not the owner.

[ ] If content media or albums is private but I liked it or bookmarked it before when it was public, I should not be able to access it via direct link if not the owner and it should disappear from my likes and bookmarks list.

[ ] Grant 3 images to new users on signup.

[ ] Divide PSC distribution in 6\*4h instead of 24h.

[ ] In admin, after delete on select many, stay in select many mode.

[ ] Possibility to optimize i2v prompt.

[x] Reconvert videos after i2v to ensure broad compatibility across navigators.

[x] Pass the prompt to LLM as a judge for i2v.

[x] Save the same meta data as image when creating a video.

[x] Remove "related images" from media page if media is video.

[x] Generating a media should increment generated medias count.

[x] Add isPublic option on i2v page.

[x] On create album or select cover image, take it from the media entity instead of creating a new one.

[ ] Changing album cover image should update the cover optimistically in the client.

[ ] Prevent recursive loop in poll job by auto stopping after x minutes.

[ ] Add TTL to I2V jobs in case they fail so they do not show indefinitely on Videos page.

[ ] Auto recredit seconds on failed videos generation.

[ ] Implement ReturnTo when logging in or registering.

[x] Improve pricing page cards design, complete plan features and FAQ.

[x] In renewal plan scheduled lambda, clean user plans of users that have cancelled.

[ ] Add and auto select loras when a user does I2V based on the prompt.
