# TODO list

## Queue manager

### Review the concept, the utility

Currently we use the queue as a memo for prompts and parameters, not as a queue

## Launch

### Reset the dynamodb table and the S3 bucket then test everything

We must ensure a clean state before running tests.

### Set up dev environment

Add ssm parameters, subdomains, etc.

## Generate page

### Deleting an a recent image from the list under the main images should remove it from the page instantly

Currently, the image stays on the page and the lightbox do not close.

### Navigating to another page should not lose the current state

When I come back to generate page, state is lost.

## Websocket

## User Insights

## Homepage Discover

### Optimize filter by tags using indexes

Currently, we filter and it's not efficient at all.

## User Bookmarks page

## Content Cards

### When not logged in and try to like/bookmark, we need a visual feedback

Currently, nothing happens.

### On hover/tap an album card, I want to see changing thumbnails

When hovering or tapping on an album card, the thumbnail should change to another media of the album thumbnail, every 1 seconds. This will provide a more dynamic and engaging user experience.

## Error handling

### Write tests

I suggest to delete all the tests and write new ones. The current tests are not up to date and do not cover all the functionality. We should write tests for all the components, hooks, and utilities. Both frontend and backend should have tests.

## UI/UX

### Rework Welcome email

The "what you can do now" section is not coherent and should be reworked.

## User profile

## Videos

## Admin

### Dashboard page should show stats of global app

Refactor the admin dashboard to show stats and analytics for the entire application, not just the admin's own content. This will provide a better overview of the app's performance.

### All media page

We should implement an "All Media" page in the admin section to allow admins to view and manage all media content in one place.

### All albums page

Make sure the album page return all albums, not just the ones created by the user. This will allow admins to manage all albums effectively.

## Settings

## User Profile

## User albums

### Should have infinite loading

Currently, the virtualizedGrid is set to not load more.

## Optimization

### Translate all hardcoded strings

We should extract all hardcoded strings in the application and replace them with next-intl keys.

### Make tanstack leverage ssg data

We should optimize our use of TanStack to leverage Static Site Generation (SSG) data effectively. This will improve performance and reduce the load on our servers.

## Comments

## Media page

### We should show siblings

Right now they do not show a lot except the prompt.

## Infrastructure

### Migrate to Terraform

We should migrate our infrastructure to Terraform for better management and scalability.

### Migrate to Next.js 15

We should upgrade our Next.js version to 15 to take advantage of the latest features and improvements.

### Migrate to React.js 19

We should upgrade our React.js version to 19 to take advantage of the latest features and improvements.

## Login / Logout

### Forgot password page

We should implement forgot password page.
