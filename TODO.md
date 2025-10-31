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

[x] Migrate to Next.js 15.

[x] Migrate to React.js 19.

[x] Implement forgot password page.

[x] Always show lora models and strength on media page, even if selected automatically.

[x] Remove all console logs.

[x] Implement additional image credit, so we can do promotions and offer 10 images on signup.

[x] Review or implement Change password.

[x] Review how to generate images for anonymous users as they cannot generate jwt tokens.

[x] If I login after website load, make sure to get a new jwt token and websocket connection.

[x] Verify the entire mobile and tablet experience.

[x] Review page titles and meta descriptions.

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

[x] If content media or album is private, I should not be able to access it via direct link if not the owner.

[x] If content media or albums is private but I liked it or bookmarked it before when it was public, I should not be able to access it via direct link if not the owner and it should disappear from my likes and bookmarks list.

[x] Grant 3 images to new users on signup.

[ ] Divide PSC distribution in 6\*4h instead of 24h.

[ ] In admin, after delete on select many, stay in select many mode.

[x] Possibility to optimize i2v prompt.

[x] Reconvert videos after i2v to ensure broad compatibility across navigators.

[x] Pass the prompt to LLM as a judge for i2v.

[x] Save the same meta data as image when creating a video.

[x] Remove "related images" from media page if media is video.

[x] Generating a media should increment generated medias count.

[x] Add isPublic option on i2v page.

[x] On create album or select cover image, take it from the media entity instead of creating a new one.

[ ] Changing album cover image should update the cover optimistically in the client.

[x] Auto recredit seconds on failed videos generation.

[x] Implement ReturnTo when logging in or registering.

[x] Improve pricing page cards design, complete plan features and FAQ.

[x] In renewal plan scheduled lambda, clean user plans of users that have cancelled.

[x] Add and auto select loras when a user does I2V based on the prompt.

[x] On video media page, show original media in meta sections.

[x] Purchasing a plan should reset the Monthly and Daily Usage to 0.

[x] Include 20s of video in the unlimited plan.

[x] Create a FAQ page (list of lora models, how long does it take to generate a video, etc)

[x] Send an email to user when someone follow him.

[ ] Send a weekly email with recap of new followers, likes, bookmarks, comments, etc.

[x] Add a "cookie" bar at the bottom of the page.

[x] Make PornSpot free until we choose it's paid. Use a constant.

[x] Find why it does not show advantages of registering anymore.

[x] Play video from content cards in one click.

[x] Media GSI5SK should be {isPublic}#{createdAt} instead of just {isPublic} to allow fetching recent public media.

[x] Set up GSI3SK for albums the same way as media.

[ ] Add promotion: buy 1 month, get 1 month free.

[x] Add "always" mode to notification email frequency setting.

[x] TrustPilot promotion 1 month free.

[ ] "Generation limit reached" should not appear if there is a job in progress or queued on screen.

[x] Download album as zip.

[x] Redesign the PricingPage.

[x] Updated albums should appear in Discover.

[ ] Modal asking for Name on Card and Billing country on checkout.

[ ] On I2V generate page, make "advanced settings" more visible with color or something.

[x] SSR is blocked by AgeGate and therefore do not render the page.

[x] Generate images 7-days streak bonus of 20 images. 30-days streak bonus of 100 images. 90-days streak bonus of 500 images.

[ ] Make a sitemap for videos.

[ ] On user profile page, section for most popular content.

[ ] On user profile page, section for highlighted content.

[x] Sort albums by most recent items added.

[ ] Images and video page split by generation date.

[ ] Current streak 90 + 1 = 1

[ ] Set up sales channel events for GA.
