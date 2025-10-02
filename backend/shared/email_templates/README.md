# Email Templates

<!--
@fileoverview Email Templates README
@description Documentation for email templates in the shared directory.
@notes
- Structure: HTML and TXT pairs for each template.
- Available templates: verification, welcome.
- Variables per template.
- Usage with EmailTemplateService.
- Design guidelines for HTML (responsive, dark theme) and text.
- Testing with validation methods.
-->

This directory contains HTML and text email templates for the PornSpot.ai application.

## Structure

Each email template consists of two files:

- `{template-name}.html` - HTML version of the email
- `{template-name}.txt` - Plain text version of the email

## Available Templates

### verification

- **Purpose**: Email verification for new user accounts
- **Variables**:
  - `{{subject}}` - Email subject line
  - `{{displayName}}` - User's display name (first name or email)
  - `{{verificationUrl}}` - Complete verification URL
  - `{{verificationToken}}` - Verification token code

### welcome

- **Purpose**: Welcome email sent after successful email verification
- **Variables**:
  - `{{subject}}` - Email subject line
  - `{{displayName}}` - User's display name (first name or email)
  - `{{loginUrl}}` - Login URL for the application

### unread-notifications

- **Purpose**: Notify user about unread notifications and link them to the notifications page
- **Variables**:
  - `{{subject}}` - Email subject line
  - `{{displayName}}` - User's display name (first name or email)
  - `{{unreadCount}}` - Number of unread notifications

### pornspotcoin-balance

- **Purpose**: Notify users that they've accumulated a PornSpotCoin (PSC) balance from their popular content and explain how to redeem it
- **Variables**:
  - `{{subject}}` - Email subject line
  - `{{displayName}}` - User's display name (first name or email)
  - `{{balancePSC}}` - Current PSC balance to display
  - `{{dashboardUrl}}` - Link to the PSC dashboard (e.g., <https://www.pornspot.ai/en/user/pornspotcoin>)

### new-follower

- **Purpose**: Notify users when they receive a new follower and provide a quick link to the follower's profile
- **Variables**:
  - `{{subject}}` - Email subject line
  - `{{displayName}}` - Followed user's display name
  - `{{followerName}}` - Follower's display name to show in the email
  - `{{profileUrl}}` - Direct link to the follower's profile page
  - `{{settingsUrl}}` - Link for the user to manage their email notification preferences

## Template Variables

Templates use the `{{variableName}}` syntax for variable substitution. All variables are replaced during template processing.

## Usage

Templates are loaded and processed using the `EmailTemplateService`:

```typescript
import { EmailTemplateService } from "./emailTemplates";

// Load and process a template
const { htmlBody, textBody } = await EmailTemplateService.loadTemplate(
  "verification",
  {
    subject: "Please verify your email",
    displayName: "John Doe",
    verificationUrl: "https://example.com/verify?token=abc123",
    verificationToken: "abc123",
  }
);
```

## Adding New Templates

1. Create both `.html` and `.txt` files with the same base name
2. Use `{{variableName}}` syntax for dynamic content
3. Follow the existing design patterns for HTML templates
4. Test templates using the `validateTemplate()` method

## Design Guidelines

### HTML Templates

- Use responsive design with max-width of 600px
- Dark theme with purple accent colors
- Consistent spacing and typography
- Include both button and text links for accessibility
- Mobile-friendly design

### Text Templates

- Clean, readable plain text format
- Include all important information from HTML version
- Use simple formatting with line breaks and dashes
- Keep URLs on separate lines for easy copying

## Testing

Use the validation methods to ensure templates are properly configured:

```typescript
// Check if both HTML and text templates exist
const isValid = await EmailTemplateService.validateTemplate("verification");

// Get list of available templates
const templates = await EmailTemplateService.getAvailableTemplates();
```
